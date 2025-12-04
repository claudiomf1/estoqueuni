import { randomUUID } from 'crypto';
import ConfiguracaoSincronizacao from '../models/ConfiguracaoSincronizacao.js';
import EventoProcessado from '../models/EventoProcessado.js';
import Produto from '../models/Produto.js';
import blingEstoqueUnificadoService from './blingEstoqueUnificadoService.js';
import blingService from './blingService.js';
import BlingConfig from '../models/BlingConfig.js';
import autoUpdateTracker from './autoUpdateTracker.js'; 
import { getBrazilNow } from '../utils/timezone.js'; 
import inconsistenciasService from './inconsistenciaEstoqueService.js';

const logWithTimestamp = (fn, message) => {
  const iso = getBrazilNow().toISOString();
  fn(`[${iso}] ${message}`);
};

/**
 * Serviço responsável por sincronizar estoques manualmente e fornecer
 * o mesmo contrato utilizado pelo processador de eventos e pela UI.
 */
class SincronizadorEstoqueService {
  /**
   * Executa sincronização para um produto específico.
   * @param {string} produtoId - SKU/ID do produto no Bling
   * @param {string} tenantId - Tenant responsável
   * @param {string} origem - manual | webhook
   * @param {Object} options - Opções extras
   * @returns {Promise<Object>}
   */
  async sincronizarEstoque(produtoId, tenantId, origem = 'manual', options = {}) {
    if (!produtoId) {
      throw new Error('produtoId é obrigatório');
    }

    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }

    const config = await ConfiguracaoSincronizacao.findOne({ tenantId });
    if (!config) {
      throw new Error('Configuração de sincronização não encontrada');
    }

    const contasAtivas = await this._filtrarContasReaisAtivas(config, tenantId);
    const configObj = config.toObject();

    if (contasAtivas.length === 0) {
      logWithTimestamp(
        console.warn,
        `[SINCRONIZADOR] ⚠️ Nenhuma conta Bling ativa para o tenant ${tenantId}. Ignorando sincronização para ${produtoId}.`
      );
      return {
        success: false,
        ignorado: true,
        produtoId,
        tenantId,
        origem,
        mensagem: 'Nenhuma conta Bling ativa',
      };
    }
    // Resolve SKU canônico (caso chegue productId de outra conta)
    const skuResolvido = await this._resolverSkuCanonical(produtoId, tenantId, contasAtivas);

    const produtoDetalhes = await this._validarProdutoSimples(
      skuResolvido,
      tenantId,
      { ...configObj, contasBling: contasAtivas }
    );
    const mapaDepositosMonitorados = await this._mapearDepositosPrincipaisPorConta(
      configObj,
      contasAtivas,
      tenantId
    );

    const contasPermitidas = contasAtivas.map((c) => c.blingAccountId);
    const operacaoEstoque =
      options?.eventoDados?.tipoOperacaoEstoque ||
      (options?.origemEvento === 'venda'
        ? 'saida'
        : options?.origemEvento === 'venda_removida'
          ? 'entrada'
          : null);
    const ajustarCompartilhadoPorVenda = options?.eventoDados?.ajustarCompartilhadoPorVenda === true;

    // Para vendas, usar saldoVirtual (como nos JSONs do Make)
    const usarSaldoVirtual = operacaoEstoque === 'saida' || operacaoEstoque === 'entrada';
    
    const { total, estoquePorConta, erros, detalhesPorConta } =
      await blingEstoqueUnificadoService.buscarEstoqueUnificado(
        tenantId,
        skuResolvido,
        mapaDepositosMonitorados,
        contasPermitidas,
        { usarSaldoVirtual }
      );

    const saldosArray = await this._mapearSaldosPrincipais(
      configObj,
      detalhesPorConta || estoquePorConta,
      contasAtivas,
      tenantId
    );
    const soma = this.calcularSoma(saldosArray);

    // Novo cálculo: compartilhado = fornecedor + virtual (quando existir nos depósitos principais)
    const valorFornecedor = saldosArray
      .filter((s) => /fornecedor/i.test(s.nomeDeposito || s.depositoId || ''))
      .reduce((acc, s) => acc + (Number(s.valor) || 0), 0);
    const valorVirtual = saldosArray
      .filter((s) => /virtual/i.test(s.nomeDeposito || s.depositoId || ''))
      .reduce((acc, s) => acc + (Number(s.valor) || 0), 0);
    const somaFornecedorVirtual = valorFornecedor + valorVirtual;
    const usandoFormulaFornecedorVirtual = somaFornecedorVirtual > 0;
    if (usandoFormulaFornecedorVirtual) {
      logWithTimestamp(
        console.log,
        `[SINCRONIZADOR] 🧮 Cálculo compartilhado (fornecedor + virtual): fornecedor=${valorFornecedor}, virtual=${valorVirtual}, total=${somaFornecedorVirtual}`
      );
    }

    const deltaQuantidade = Number(options?.deltaQuantidade);
    const deltaQuantidadeValida = Number.isFinite(deltaQuantidade);
    const aplicarAbatimentoCompartilhados =
      ajustarCompartilhadoPorVenda &&
      operacaoEstoque === 'saida' &&
      deltaQuantidadeValida &&
      deltaQuantidade > 0;
    const aplicarDeltaSaida =
      operacaoEstoque === 'saida' &&
      deltaQuantidadeValida &&
      deltaQuantidade > 0 &&
      !usandoFormulaFornecedorVirtual;
    const aplicarDeltaEntrada =
      operacaoEstoque === 'entrada' &&
      deltaQuantidadeValida &&
      deltaQuantidade > 0 &&
      !usandoFormulaFornecedorVirtual;

    // Novo comportamento: depósitos compartilhados recebem quantidade priorizando:
    // quantidade do evento (prioridade máxima) -> saldo total do evento -> saldo depósito do evento -> deltaQuantidade -> total unificado -> soma dos principais
    const quantidadeBase = usandoFormulaFornecedorVirtual ? somaFornecedorVirtual : soma;
    const quantidadeUnificadaTotal = Number.isFinite(Number(total)) ? Number(total) : null;
    const quantidadeEvento = Number.isFinite(Number(options?.eventoDados?.quantidade))
      ? Number(options.eventoDados.quantidade)
      : null;
    const saldoFisicoTotalEvento = Number.isFinite(
      Number(options?.eventoDados?.saldoFisicoTotal)
    )
      ? Number(options.eventoDados.saldoFisicoTotal)
      : null;
    const saldoDepositoEvento = Number.isFinite(
      Number(options?.eventoDados?.saldoDepositoFisico)
    )
      ? Number(options.eventoDados.saldoDepositoFisico)
      : null;

    let quantidadeParaCompartilhado = quantidadeBase;
    let fonteQuantidade = 'soma_principais';
    
    // IMPORTANTE: Para vendas, o total unificado já reflete o estoque APÓS a venda
    // A quantidade do evento é apenas o delta (quantidade vendida), não o saldo total
    // Para compartilhados, precisamos do saldo total atualizado, não do delta
    // Por isso, para vendas/entradas, priorizamos saldo total do evento ou total unificado
    
    // Prioridades:
    // 1. Saldo total do evento (se disponível) - reflete o estado após a operação
    // 2. Saldo do depósito do evento (se disponível) - reflete o estado após a operação
    // 3. Total unificado (para vendas/entradas, já reflete o estado após a operação)
    // 4. Quantidade do evento (apenas se não for venda/entrada, pois é o delta, não o saldo total)
    // 5. Delta quantidade (fallback)
    // 6. Soma dos principais (fallback final)
    
    if (aplicarAbatimentoCompartilhados) {
      quantidadeParaCompartilhado = deltaQuantidade;
      fonteQuantidade = 'delta_venda_order_created';
      logWithTimestamp(
        console.log,
        `[SINCRONIZADOR] ➖ order.created detectado: abatendo ${deltaQuantidade} do estoque dos depósitos compartilhados antes do cálculo padrão`
      );
    } else if (saldoFisicoTotalEvento !== null) {
      quantidadeParaCompartilhado = saldoFisicoTotalEvento;
      fonteQuantidade = 'saldo_evento';
    } else if (saldoDepositoEvento !== null) {
      quantidadeParaCompartilhado = saldoDepositoEvento;
      fonteQuantidade = 'saldo_deposito_evento';
    } else if (quantidadeUnificadaTotal !== null) {
      // Para vendas/entradas, o total unificado já reflete o estado após a operação
      quantidadeParaCompartilhado = quantidadeUnificadaTotal;
      fonteQuantidade = 'total_unificado';
    } else if (quantidadeEvento !== null && operacaoEstoque === null) {
      // Apenas usar quantidade do evento se NÃO for venda/entrada (pois é o delta, não o saldo total)
      quantidadeParaCompartilhado = quantidadeEvento;
      fonteQuantidade = 'quantidade_evento';
    } else if (deltaQuantidadeValida && deltaQuantidade > 0) {
      quantidadeParaCompartilhado = deltaQuantidade;
      fonteQuantidade = 'delta_evento';
    }
    
    // Log detalhado para debug
    logWithTimestamp(
      console.log,
      `[SINCRONIZADOR] 📊 Cálculo quantidadeParaCompartilhado: ${quantidadeParaCompartilhado} (fonte: ${fonteQuantidade}) | quantidadeEvento: ${quantidadeEvento} | deltaQuantidade: ${deltaQuantidade} | operacaoEstoque: ${operacaoEstoque} | totalUnificado: ${quantidadeUnificadaTotal} | saldoFisicoTotal: ${saldoFisicoTotalEvento}`
    );

    const compartilhadosAtualizados = await this._atualizarDepositosCompartilhados(
      skuResolvido,
      tenantId,
      quantidadeParaCompartilhado,
      configObj,
      origem,
      contasAtivas,
      produtoDetalhes,
      {
        deltaAplicado:
          (aplicarDeltaSaida || aplicarDeltaEntrada) && !usandoFormulaFornecedorVirtual
            ? deltaQuantidade
            : null,
        somaOriginal: soma,
        modoAbater: aplicarAbatimentoCompartilhados,
        quantidadeAbater: aplicarAbatimentoCompartilhados ? deltaQuantidade : null,
        fonteQuantidade,
        aplicarDelta: (aplicarDeltaSaida || aplicarDeltaEntrada) && !usandoFormulaFornecedorVirtual,
        calcFornecedorVirtual: usandoFormulaFornecedorVirtual
          ? { fornecedor: valorFornecedor, virtual: valorVirtual }
          : null,
        operacaoEstoque,
        eventoQuantidade: quantidadeEvento,
        eventoSaldoTotal: saldoFisicoTotalEvento,
      }
    );
    const errosCompartilhados = compartilhadosAtualizados
      .filter(item => item && item.sucesso === false && item.erro)
      .map(item => `[Depósito ${item.depositoId}] ${item.erro}`);

    await this._atualizarProdutoLocal(skuResolvido, tenantId, estoquePorConta, total);
    // Se não houve erros, remove da lista de suspeitos
    await inconsistenciasService.resolverSuspeito(tenantId, skuResolvido);

    config.ultimaSincronizacao = getBrazilNow();
    config.incrementarEstatistica(origem);
    await config.save();

    const resultado = {
      success: true,
      produtoId: skuResolvido,
      tenantId,
      origem,
      soma,
      saldosArray,
      estoquePorConta,
      compartilhadosAtualizados,
      erros: Array.isArray(erros)
        ? [...erros, ...errosCompartilhados]
        : [...errosCompartilhados],
      debugInfo: {
        quantidadeParaCompartilhado,
        quantidadeBase: quantidadeBase,
        deltaAplicado: null,
        aplicarDelta: false,
        operacaoEstoque,
        depositosCompartilhados: configObj?.regraSincronizacao?.depositosCompartilhados || [],
        contasAtivas: contasAtivas.map((c) => c.blingAccountId),
        calcFornecedorVirtual: usandoFormulaFornecedorVirtual
          ? { fornecedor: valorFornecedor, virtual: valorVirtual }
          : null,
        eventoQuantidade: quantidadeEvento,
        eventoSaldoTotal: saldoFisicoTotalEvento,
        eventoSaldoDeposito: saldoDepositoEvento,
        fonteQuantidade,
        totalUnificado: quantidadeUnificadaTotal,
      },
      mensagem:
        'Sincronização local concluída. Atualização automática de depósitos será habilitada em breve.',
    };

    await this._registrarEvento(resultado);

    return resultado;
  }

  /**
   * Resolve um SKU canônico usando productId em alguma conta ativa.
   */
  async _resolverSkuCanonical(produtoId, tenantId, contasAtivas = []) {
    // se já é SKU com letras, devolve
    if (typeof produtoId === 'string' && /\D/.test(produtoId)) {
      return produtoId;
    }

    const accountNameMap = await this._buildAccountNameMap(tenantId, contasAtivas);

    for (const conta of contasAtivas) {
      try {
        const produto = await blingService.getProdutoPorId(
          produtoId,
          tenantId,
          conta.blingAccountId,
          true
        );
        if (produto?.codigo) {
        logWithTimestamp(
          console.log,
          `[SINCRONIZADOR] 🔎 SKU resolvido via productId ${produtoId} na conta ${conta.blingAccountId}: ${produto.codigo}`
        );
          return produto.codigo;
        }
      } catch (error) {
        const nomeConta = accountNameMap.get(conta.blingAccountId) || conta.accountName || conta.blingAccountId;
        if (error?.code === 'INVALID_TOKEN') {
          logWithTimestamp(
            console.warn,
            `[SINCRONIZADOR] ⚠️ Conta ${nomeConta} (${conta.blingAccountId}) com token inválido ao resolver SKU. Pulando.`
          );
          continue;
        }
        logWithTimestamp(
          console.warn,
          `[SINCRONIZADOR] ⚠️ Falha ao resolver SKU ${produtoId} na conta ${nomeConta} (${conta.blingAccountId}): ${error.message}`
        );
      }
    }
    return produtoId;
  }

  calcularSoma(saldos) {
    return saldos.reduce((acc, saldo) => acc + (Number(saldo.valor) || 0), 0);
  }

  async _buildAccountNameMap(tenantId, contasAtivas) {
    if (!tenantId || !Array.isArray(contasAtivas) || contasAtivas.length === 0) {
      return new Map();
    }

    const registros = await BlingConfig.find({
      tenantId,
      blingAccountId: { $in: contasAtivas },
    }).lean();

    const map = new Map();
    registros.forEach((registro) => {
      if (registro?.blingAccountId) {
        map.set(
          registro.blingAccountId,
          registro.accountName || registro.store_name || registro.blingAccountId
        );
      }
    });

    return map;
  }

  async _mapearDepositosPrincipaisPorConta(config, contasAtivas = [], tenantId) {
    const mapa = {};
    const depositosPrincipais = config?.regraSincronizacao?.depositosPrincipais || [];
    if (!Array.isArray(depositosPrincipais) || depositosPrincipais.length === 0) {
      return mapa;
    }

    const contasAtivasSet = new Set(
      (contasAtivas || [])
        .filter((c) => c?.blingAccountId)
        .map((c) => c.blingAccountId)
    );

    (config.depositos || []).forEach((deposito) => {
      if (
        deposito?.id &&
        deposito?.contaBlingId &&
        depositosPrincipais.includes(deposito.id) &&
        contasAtivasSet.has(deposito.contaBlingId)
      ) {
        mapa[deposito.id] = deposito.contaBlingId;
      }
    });

    return mapa;
  }

  async _mapearSaldosPrincipais(config, detalhesPorConta = {}, contasAtivas = [], tenantId) {
    const depositosPrincipais = config?.regraSincronizacao?.depositosPrincipais || [];
    if (depositosPrincipais.length === 0) {
      return [];
    }

    const contasAtivasSet = new Set(
      (config?.contasBling || [])
        .filter(
          (c) =>
            c &&
            c.blingAccountId &&
            c.isActive !== false &&
            c.is_active !== false
        )
        .map((c) => c.blingAccountId)
    );

    const mapaDepositos = this._criarMapaDepositos(config);
    const saldos = [];

    for (const depositoId of depositosPrincipais) {
      const deposito = mapaDepositos.get(depositoId) || { nome: 'Depósito', contaBlingId: null };
      const contaId = deposito.contaBlingId;
      if (contaId && !contasAtivasSet.has(contaId)) {
        logWithTimestamp(
          console.warn,
          `[SINCRONIZADOR] ⚠️ Conta ${contaId} inativa. Ignorando depósito principal ${depositoId}.`
        );
        continue;
      }
      const contaDetalhes = contaId ? detalhesPorConta?.[contaId] : null;
      const valor = contaId
        ? this._obterSaldoPorDeposito(contaDetalhes, depositoId, contaId)
        : 0;
      saldos.push({
        depositoId,
        nomeDeposito: deposito.nome || depositoId,
        valor,
        origemConta: contaId,
      });
    }

    return saldos;
  }

  _obterSaldoPorDeposito(contaDetalhes, depositoId, contaId) {
    if (contaDetalhes === undefined || contaDetalhes === null) {
      logWithTimestamp(
        console.warn,
        `[SINCRONIZADOR] ⚠️ Saldo não encontrado para conta ${contaId} ao buscar depósito ${depositoId}.`
      );
      return 0;
    }

    if (typeof contaDetalhes === 'number') {
      return contaDetalhes;
    }

    if (typeof contaDetalhes === 'object') {
      if (contaDetalhes.monitorados && depositoId) {
        const chave = String(depositoId);
        if (Object.prototype.hasOwnProperty.call(contaDetalhes.monitorados, chave)) {
          return contaDetalhes.monitorados[chave];
        }
      }

      if (contaDetalhes.depositos && depositoId) {
        const chave = String(depositoId);
        if (Object.prototype.hasOwnProperty.call(contaDetalhes.depositos, chave)) {
          return contaDetalhes.depositos[chave];
        }
      }

      if (typeof contaDetalhes.total === 'number') {
        logWithTimestamp(
          console.warn,
          `[SINCRONIZADOR] ⚠️ Depósito ${depositoId} não encontrado na conta ${contaId}. Utilizando total da conta (${contaDetalhes.total}).`
        );
        return contaDetalhes.total;
      }
    }

    return 0;
  }

  async _atualizarDepositosCompartilhados(
    sku,
    tenantId,
    quantidade,
    config,
    origem,
    contasAtivas = [],
    produtoDetalhesCache = new Map(),
    opcoesExtras = {}
  ) {
    const quantidadeNormalizada = Number.isFinite(Number(quantidade))
      ? Number(quantidade)
      : 0;
    const aplicarDelta = opcoesExtras?.aplicarDelta !== false;
    const deltaAplicado = Number.isFinite(opcoesExtras?.deltaAplicado)
      ? Number(opcoesExtras.deltaAplicado)
      : null;
    const abaterNosCompartilhados = opcoesExtras?.modoAbater === true;
    const quantidadeParaAbater = Number.isFinite(Number(opcoesExtras?.quantidadeAbater))
      ? Number(opcoesExtras.quantidadeAbater)
      : null;
    const fonteQuantidadeCompartilhado = opcoesExtras?.fonteQuantidade || 'soma_principais';
    const depositosCompartilhados =
      config?.regraSincronizacao?.depositosCompartilhados || [];
    if (!depositosCompartilhados.length) {
      return [
        {
          depositoId: 'n/a',
          nomeDeposito: 'Nenhum depósito compartilhado configurado',
          sucesso: false,
          erro: 'Nenhum depósito compartilhado configurado',
          quantidade: quantidadeNormalizada,
          quantidadeBase: quantidadeNormalizada,
          saldoAtual: null,
          deltaAplicado,
          aplicarDelta,
        },
      ];
    }

    const contasAtivasSet = new Set(
      (contasAtivas || [])
        .filter((c) => c?.blingAccountId)
        .map((c) => c.blingAccountId)
    );

    const configsBling = await BlingConfig.find({
      tenantId,
      blingAccountId: { $in: Array.from(contasAtivasSet) },
    }).lean();

    const contaNomeMap = new Map();
    configsBling.forEach((registro) => {
      if (registro?.blingAccountId) {
        contaNomeMap.set(
          registro.blingAccountId,
          registro.accountName || registro.store_name || registro.blingAccountId
        );
      }
    });

    (config?.contasBling || []).forEach((contaConfig) => {
      if (
        contaConfig?.blingAccountId &&
        !contaNomeMap.has(contaConfig.blingAccountId)
      ) {
        contaNomeMap.set(
          contaConfig.blingAccountId,
          contaConfig.accountName || contaConfig.blingAccountId
        );
      }
    });

    const mapaDepositos = this._criarMapaDepositos(config);
    const produtoCache = new Map(produtoDetalhesCache);
    const resultados = [];

    if (deltaAplicado !== null && aplicarDelta) {
      logWithTimestamp(
        console.log,
        `[SINCRONIZADOR] ⚙️ Ajuste por venda - quantidade original somada: ${opcoesExtras?.somaOriginal ?? quantidadeNormalizada}, delta aplicado: ${deltaAplicado}, quantidade final para depósitos compartilhados: ${quantidadeNormalizada}`
      );
    }
    if (abaterNosCompartilhados && quantidadeParaAbater !== null) {
      logWithTimestamp(
        console.log,
        `[SINCRONIZADOR] ➖ Abatimento em depósitos compartilhados ativado via webhook order.created | quantidadeParaAbater=${quantidadeParaAbater} | fonte=${fonteQuantidadeCompartilhado}`
      );
    }

    for (const depositoId of depositosCompartilhados) {
      const deposito = mapaDepositos.get(depositoId);
      if (!deposito) {
        await inconsistenciasService.marcarSuspeito(
          tenantId,
          sku,
          `Depósito ${depositoId} não encontrado na configuração`
        );
        resultados.push({
          depositoId,
          nomeDeposito: depositoId,
          sucesso: false,
          erro: 'Depósito não encontrado na configuração',
          quantidade: quantidadeNormalizada,
          quantidadeBase: quantidadeNormalizada,
          saldoAtual: null,
          deltaAplicado,
          aplicarDelta,
        });
        continue;
      }

      if (!contasAtivasSet.has(deposito.contaBlingId)) {
        await inconsistenciasService.marcarSuspeito(
          tenantId,
          sku,
          `Conta inativa para depósito ${depositoId}`
        );
        resultados.push({
          depositoId,
          nomeDeposito: deposito.nome || depositoId,
          contaBlingId: deposito.contaBlingId,
          sucesso: false,
          erro: 'Conta Bling inativa para este depósito',
          quantidade: quantidadeNormalizada,
          quantidadeBase: quantidadeNormalizada,
          saldoAtual: null,
          deltaAplicado,
          aplicarDelta,
        });
        continue;
      }

      if (!deposito.contaBlingId) {
        await inconsistenciasService.marcarSuspeito(
          tenantId,
          sku,
          `Depósito ${depositoId} sem conta Bling vinculada`
        );
        resultados.push({
          depositoId,
          nomeDeposito: deposito.nome || depositoId,
          sucesso: false,
          erro: 'Depósito não possui conta Bling vinculada',
          quantidade: quantidadeNormalizada,
          quantidadeBase: quantidadeNormalizada,
          saldoAtual: null,
          deltaAplicado,
          aplicarDelta,
        });
        continue;
      }

      try {
        let produtoInfo = produtoCache.get(deposito.contaBlingId);
        if (!produtoInfo) {
          let produtoBling = await blingService.getProdutoPorSku(
            sku,
            tenantId,
            deposito.contaBlingId,
            true
          );

          // Fallback: se SKU for numérico/id e não retornar, tenta por ID diretamente
          if (!produtoBling) {
            produtoBling = await blingService.getProdutoPorId(
              sku,
              tenantId,
              deposito.contaBlingId,
              true
            );
          }

          if (!produtoBling || !produtoBling.id) {
            await inconsistenciasService.marcarSuspeito(
              tenantId,
              sku,
              `Produto não encontrado no Bling para conta ${deposito.contaBlingId}`
            );
            throw new Error('Produto não encontrado no Bling para esta conta');
          }

          if (blingService.isProdutoComposto(produtoBling)) {
            const composicaoError = new Error(
              `Produto '${sku}' é um produto composto (formato ${produtoBling.formato || 'E'}) e não suporta atualização automática.`
            );
            composicaoError.code = 'PRODUTO_COMPOSTO';
            composicaoError.codigoErro = 'PRODUTO_COMPOSTO_NAO_SUPORTADO';
            throw composicaoError;
          }

          produtoInfo = {
            id: produtoBling.id,
            nome: produtoBling.nome || produtoBling.descricao || sku,
          };
          produtoCache.set(deposito.contaBlingId, produtoInfo);
        }

        const contaNome = contaNomeMap.get(deposito.contaBlingId) || deposito.contaBlingId;
        // IMPORTANTE: quantidadeNormalizada já contém o valor correto para os compartilhados
        // (já foi calculado considerando a quantidade do evento, saldo total, etc.)
        // Para vendas e entradas, os compartilhados devem receber o valor final já calculado
        // A lógica de aplicarDelta era usada para ajustes internos, mas não deve alterar
        // a quantidade que vai para os compartilhados, pois quantidadeNormalizada já está correta
        let quantidadeDestino = quantidadeNormalizada;
        let saldoAtualDeposito = null;
        
        // Buscar saldo atual para idempotência (verificar se já está no valor desejado)

        // Buscar saldo atual se ainda não foi obtido (para idempotência)
        // Para vendas/entradas, usar saldoVirtual (como nos JSONs do Make)
        const usarSaldoVirtualParaIdempotencia = opcoesExtras?.operacaoEstoque === 'saida' || opcoesExtras?.operacaoEstoque === 'entrada';
        if (saldoAtualDeposito === null) {
          try {
            saldoAtualDeposito = await blingService.getSaldoProdutoPorDeposito(
              produtoInfo.id,
              deposito.id,
              tenantId,
              deposito.contaBlingId,
              { usarSaldoVirtual: usarSaldoVirtualParaIdempotencia }
            );
            if (abaterNosCompartilhados) {
              logWithTimestamp(
                console.log,
                `[SINCRONIZADOR] 📥 Saldo atual retornado pelo Bling para depósito ${deposito.id} (conta ${contaNome}): ${saldoAtualDeposito}`
              );
            }
          } catch (errorSaldo) {
            logWithTimestamp(
              console.warn,
              `[SINCRONIZADOR] ⚠️ Falha ao ler saldo do depósito ${deposito.id} para idempotência: ${errorSaldo.message}`
            );
          }
        }

        if (abaterNosCompartilhados && quantidadeParaAbater !== null) {
          const saldoBaseParaAbater = Number.isFinite(Number(saldoAtualDeposito))
            ? Number(saldoAtualDeposito)
            : Number.isFinite(Number(opcoesExtras?.somaOriginal))
              ? Number(opcoesExtras.somaOriginal)
              : quantidadeNormalizada;
          quantidadeDestino = Math.max(0, saldoBaseParaAbater - quantidadeParaAbater);
          logWithTimestamp(
            console.log,
            `[SINCRONIZADOR] ➖ Aplicando abatimento nos compartilhados | depósito=${deposito.id} | saldoBase=${saldoBaseParaAbater} | abater=${quantidadeParaAbater} | destino=${quantidadeDestino} | fonte=${fonteQuantidadeCompartilhado} | tenant=${tenantId}`
          );
        }

        // Se já está no valor desejado, evita movimentação e loga
        const saldoAtualComparacao =
          saldoAtualDeposito !== null && saldoAtualDeposito !== undefined
            ? Number(saldoAtualDeposito)
            : null;
        if (saldoAtualComparacao !== null && saldoAtualComparacao === Number(quantidadeDestino)) {
          logWithTimestamp(
            console.log,
            `[SINCRONIZADOR] ⏭️ Depósito ${deposito.id} já está na quantidade alvo (${quantidadeDestino}). Pulando movimentação.`
          );
          resultados.push({
            depositoId: deposito.id,
            nomeDeposito: deposito.nome || deposito.id,
            contaBlingId: deposito.contaBlingId,
            sucesso: true,
            mensagem: 'Depósito já estava na quantidade alvo (idempotente)',
            quantidade: quantidadeDestino,
            quantidadeBase: quantidadeNormalizada,
            saldoAtual: saldoAtualDeposito,
            deltaAplicado,
            aplicarDelta,
            retornoBling: null,
          });
          autoUpdateTracker.registrarAtualizacaoAutomatica({
            tenantId,
            depositoId: deposito.id,
            produtoId: String(produtoInfo.id || sku),
          });
          continue;
        }

        logWithTimestamp(
          console.log,
          `[SINCRONIZADOR] 🔄 Atualizando depósito compartilhado ${deposito.id} (${deposito.nome}) na conta ${contaNome} (${deposito.contaBlingId})` +
            ` | destino=${quantidadeDestino}` +
            ` | base=${quantidadeNormalizada}` +
            ` | saldoAtual=${saldoAtualDeposito ?? 'n/a'}` +
            ` | deltaAplicado=${deltaAplicado ?? 'n/a'}` +
            ` | aplicarDelta=${aplicarDelta ? 'sim' : 'não'}` +
            ` | abatimento=${abaterNosCompartilhados ? 'sim' : 'não'}` +
            ` | fonte=${fonteQuantidadeCompartilhado}` +
            ` | origem=${origem}` +
            ` | tenant=${tenantId}`
        );

        const retornoApi = await blingService.registrarMovimentacaoEstoque({
          tenantId,
          blingAccountId: deposito.contaBlingId,
          depositoId: deposito.id,
          quantidade: quantidadeDestino,
          tipoOperacao: 'B',
          produtoIdBling: produtoInfo.id,
          sku,
          origem,
        });

        autoUpdateTracker.registrarAtualizacaoAutomatica({
          tenantId,
          depositoId: deposito.id,
          produtoId: String(produtoInfo.id || sku),
        });

        resultados.push({
          depositoId: deposito.id,
          nomeDeposito: deposito.nome || deposito.id,
          contaBlingId: deposito.contaBlingId,
          sucesso: true,
          mensagem: 'Depósito atualizado com sucesso',
          quantidade: quantidadeDestino,
          quantidadeBase: quantidadeNormalizada,
          saldoAtual: saldoAtualDeposito,
          deltaAplicado,
          aplicarDelta,
          retornoBling: retornoApi,
        });
        if (abaterNosCompartilhados) {
          logWithTimestamp(
            console.log,
            `[SINCRONIZADOR] 🧾 Retorno do Bling ao ajustar depósito ${deposito.id} (abatimento): ${JSON.stringify(retornoApi, null, 2)}`
          );
        }
      } catch (error) {
        await inconsistenciasService.marcarSuspeito(
          tenantId,
          sku,
          error?.message || 'Erro ao atualizar depósito compartilhado'
        );
        // Garantir que quantidadeDestino está definida mesmo em caso de erro
        const quantidadeDestinoFinal = typeof quantidadeDestino !== 'undefined' 
          ? quantidadeDestino 
          : quantidadeNormalizada;
        resultados.push({
          depositoId: deposito.id,
          nomeDeposito: deposito.nome || deposito.id,
          contaBlingId: deposito.contaBlingId,
          sucesso: false,
          erro: error.message || 'Erro ao atualizar depósito compartilhado',
          quantidade: quantidadeDestinoFinal,
          quantidadeBase: quantidadeNormalizada,
          saldoAtual: saldoAtualDeposito || null,
          deltaAplicado,
          aplicarDelta,
        });
      }
    }

    return resultados;
  }

  async _validarProdutoSimples(produtoId, tenantId, config) {
    const contasAtivas = await this._filtrarContasReaisAtivas(config, tenantId);

    const detalhes = new Map();

    for (const conta of contasAtivas) {
      try {
        const produto = await blingService.getProdutoPorSku(
          produtoId,
          tenantId,
          conta.blingAccountId,
          true
        );

        if (!produto || !produto.id) {
          continue;
        }

        if (blingService.isProdutoComposto(produto)) {
          const error = new Error(
            `Produto '${produtoId}' é um produto composto (formato: ${produto.formato || 'E'}). Produtos compostos não suportam sincronização automática.`
          );
          error.code = 'PRODUTO_COMPOSTO';
          error.codigoErro = 'PRODUTO_COMPOSTO_NAO_SUPORTADO';
          error.httpStatus = 400;
          error.detalhesConta = conta.accountName || conta.blingAccountId;
          throw error;
        }

        detalhes.set(conta.blingAccountId, {
          id: produto.id,
          nome: produto.nome || produto.descricao || produtoId,
        });
      } catch (error) {
        if (error?.code === 'INVALID_TOKEN') {
          logWithTimestamp(console.warn, `[SINCRONIZADOR] ⚠️ Conta ${conta.accountName || conta.blingAccountId} com token inválido. Marcando como inativa e limpando tokens.`);
          await BlingConfig.findOneAndUpdate(
            { tenantId, blingAccountId: conta.blingAccountId },
            {
              is_active: false,
              isActive: false,
              access_token: null,
              refresh_token: null,
              expiry_date: null,
              last_error: 'invalid_token'
            }
          ).catch(() => {});
          await ConfiguracaoSincronizacao.updateOne(
            { tenantId, 'contasBling.blingAccountId': conta.blingAccountId },
            { $set: { 'contasBling.$.isActive': false } }
          ).catch(() => {});
          continue;
        }
        if (error?.code === 'PRODUTO_COMPOSTO') {
          throw error;
        }

        logWithTimestamp(console.warn, `[SINCRONIZADOR] ⚠️ Falha ao validar produto ${produtoId} na conta ${conta.accountName || conta.blingAccountId}: ${error.message}`);
      }
    }

    return detalhes;
  }

  async _filtrarContasReaisAtivas(config, tenantId) {
    const contas = (config?.contasBling || [])
      .filter(
        (conta) =>
          conta &&
          conta.blingAccountId &&
          conta.isActive !== false &&
          conta.is_active !== false
      );

    if (!tenantId || contas.length === 0) {
      return contas;
    }

    const registros = await BlingConfig.find({
      tenantId,
      blingAccountId: { $in: contas.map((conta) => conta.blingAccountId) },
      is_active: { $ne: false },
    }).lean();
    const validSet = new Set(registros.map((registro) => registro.blingAccountId));
    return contas.filter((conta) => validSet.has(conta.blingAccountId));
  }

  _criarMapaDepositos(config) {
    const mapa = new Map();
    (config.depositos || []).forEach((deposito) => {
      if (deposito?.id) {
        mapa.set(deposito.id, deposito);
      }
    });
    return mapa;
  }

  async _atualizarProdutoLocal(produtoId, tenantId, estoquePorConta, total) {
    const data = {
      estoque: total,
      estoquePorConta,
      ultimaSincronizacao: getBrazilNow(),
      updatedAt: getBrazilNow(),
    };

    await Produto.findOneAndUpdate(
      { tenantId, sku: produtoId },
      { $set: data },
      { upsert: true, new: true }
    );
  }

  async _registrarEvento(resultado) {
    try {
      const eventoId = randomUUID();
      const chaveUnica = EventoProcessado.criarChaveUnica(
        resultado.produtoId,
        eventoId
      );

      await EventoProcessado.create({
        tenantId: resultado.tenantId,
        produtoId: resultado.produtoId,
        sku: resultado.produtoId,
        eventoId,
        chaveUnica,
        origem: resultado.origem,
        saldos: resultado.saldosArray || [],
        soma: resultado.soma,
        compartilhadosAtualizados: resultado.compartilhadosAtualizados || [],
        sucesso: resultado.success,
        erro: Array.isArray(resultado.erros) && resultado.erros.length > 0
          ? resultado.erros.join('; ')
          : null,
        debugInfo: resultado.debugInfo || {},
        resultado,
        processadoEm: getBrazilNow(),
      });
    } catch (error) {
      logWithTimestamp(
        console.warn,
        `[SINCRONIZADOR] Não foi possível registrar evento: ${error.message}`
      );
    }
  }
} 

const sincronizadorEstoqueService = new SincronizadorEstoqueService();

export default sincronizadorEstoqueService;

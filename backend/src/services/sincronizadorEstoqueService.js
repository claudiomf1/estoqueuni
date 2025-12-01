import { randomUUID } from 'crypto';
import ConfiguracaoSincronizacao from '../models/ConfiguracaoSincronizacao.js';
import EventoProcessado from '../models/EventoProcessado.js';
import Produto from '../models/Produto.js';
import blingEstoqueUnificadoService from './blingEstoqueUnificadoService.js';
import blingService from './blingService.js';

/**
 * Serviço responsável por sincronizar estoques manualmente e fornecer
 * o mesmo contrato utilizado pelo processador de eventos e pela UI.
 */
class SincronizadorEstoqueService {
  /**
   * Executa sincronização para um produto específico.
   * @param {string} produtoId - SKU/ID do produto no Bling
   * @param {string} tenantId - Tenant responsável
   * @param {string} origem - manual | webhook | cronjob
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

    if (!config.isConfigurationComplete()) {
      throw new Error(
        'Configuração incompleta. Configure contas e depósitos antes de sincronizar.'
      );
    }

    const configObj = config.toObject();
    const produtoDetalhes = await this._validarProdutoSimples(produtoId, tenantId, configObj);
    const mapaDepositosMonitorados = this._mapearDepositosPrincipaisPorConta(configObj);

    const { total, estoquePorConta, erros, detalhesPorConta } =
      await blingEstoqueUnificadoService.buscarEstoqueUnificado(
        tenantId,
        produtoId,
        mapaDepositosMonitorados
      );

    const saldosArray = this._mapearSaldosPrincipais(
      configObj,
      detalhesPorConta || estoquePorConta
    );
    const soma = this.calcularSoma(saldosArray);
    const compartilhadosAtualizados = await this._atualizarDepositosCompartilhados(
      produtoId,
      tenantId,
      soma,
      configObj,
      origem,
      produtoDetalhes
    );
    const errosCompartilhados = compartilhadosAtualizados
      .filter(item => item && item.sucesso === false && item.erro)
      .map(item => `[Depósito ${item.depositoId}] ${item.erro}`);

    await this._atualizarProdutoLocal(produtoId, tenantId, estoquePorConta, total);

    config.ultimaSincronizacao = new Date();
    config.incrementarEstatistica(origem);
    await config.save();

    const resultado = {
      success: true,
      produtoId,
      tenantId,
      origem,
      soma,
      saldosArray,
      estoquePorConta,
      compartilhadosAtualizados,
      erros: Array.isArray(erros)
        ? [...erros, ...errosCompartilhados]
        : [...errosCompartilhados],
      mensagem:
        'Sincronização local concluída. Atualização automática de depósitos será habilitada em breve.',
    };

    await this._registrarEvento(resultado);

    return resultado;
  }

  calcularSoma(saldos) {
    return saldos.reduce((acc, saldo) => acc + (Number(saldo.valor) || 0), 0);
  }

  _mapearDepositosPrincipaisPorConta(config) {
    const mapa = {};
    const depositosPrincipais = config?.regraSincronizacao?.depositosPrincipais || [];
    if (!Array.isArray(depositosPrincipais) || depositosPrincipais.length === 0) {
      return mapa;
    }

    (config.depositos || []).forEach((deposito) => {
      if (
        deposito?.id &&
        deposito?.contaBlingId &&
        depositosPrincipais.includes(deposito.id)
      ) {
        mapa[deposito.id] = deposito.contaBlingId;
      }
    });

    return mapa;
  }

  _mapearSaldosPrincipais(config, detalhesPorConta = {}) {
    const depositosPrincipais = config?.regraSincronizacao?.depositosPrincipais || [];
    if (depositosPrincipais.length === 0) {
      return [];
    }

    const mapaDepositos = this._criarMapaDepositos(config);
    const saldos = [];

    for (const depositoId of depositosPrincipais) {
      const deposito = mapaDepositos.get(depositoId) || { nome: 'Depósito', contaBlingId: null };
      const contaId = deposito.contaBlingId;
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
      console.warn(
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
        console.warn(
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
    produtoDetalhesCache = new Map()
  ) {
    const depositosCompartilhados =
      config?.regraSincronizacao?.depositosCompartilhados || [];
    if (!depositosCompartilhados.length) {
      return [];
    }

    const mapaDepositos = this._criarMapaDepositos(config);
    const produtoCache = new Map(produtoDetalhesCache);
    const resultados = [];

    for (const depositoId of depositosCompartilhados) {
      const deposito = mapaDepositos.get(depositoId);
      if (!deposito) {
        resultados.push({
          depositoId,
          nomeDeposito: depositoId,
          sucesso: false,
          erro: 'Depósito não encontrado na configuração',
        });
        continue;
      }

      if (!deposito.contaBlingId) {
        resultados.push({
          depositoId,
          nomeDeposito: deposito.nome || depositoId,
          sucesso: false,
          erro: 'Depósito não possui conta Bling vinculada',
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

        console.log(
          `[SINCRONIZADOR] 🔄 Atualizando depósito compartilhado ${deposito.id} (${deposito.nome}) na conta ${deposito.contaBlingId} com quantidade ${quantidade} (tenant ${tenantId}, origem ${origem})`
        );

        const retornoApi = await blingService.registrarMovimentacaoEstoque({
          tenantId,
          blingAccountId: deposito.contaBlingId,
          depositoId: deposito.id,
          quantidade,
          tipoOperacao: 'B',
          produtoIdBling: produtoInfo.id,
          sku,
          origem,
        });

        resultados.push({
          depositoId: deposito.id,
          nomeDeposito: deposito.nome || deposito.id,
          contaBlingId: deposito.contaBlingId,
          sucesso: true,
          mensagem: 'Depósito atualizado com sucesso',
          retornoBling: retornoApi,
        });
      } catch (error) {
        resultados.push({
          depositoId: deposito.id,
          nomeDeposito: deposito.nome || deposito.id,
          contaBlingId: deposito.contaBlingId,
          sucesso: false,
          erro: error.message || 'Erro ao atualizar depósito compartilhado',
        });
      }
    }

    return resultados;
  }

  async _validarProdutoSimples(produtoId, tenantId, config) {
    const contasAtivas = (config?.contasBling || []).filter(
      (conta) => conta && conta.isActive !== false && conta.blingAccountId
    );

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
        if (error?.code === 'PRODUTO_COMPOSTO') {
          throw error;
        }

        console.warn(
          `[SINCRONIZADOR] ⚠️ Falha ao validar produto ${produtoId} na conta ${conta.accountName || conta.blingAccountId}: ${error.message}`
        );
      }
    }

    return detalhes;
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
      ultimaSincronizacao: new Date(),
      updatedAt: new Date(),
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
        resultado,
        processadoEm: new Date(),
      });
    } catch (error) {
      console.warn('[SINCRONIZADOR] Não foi possível registrar evento:', error.message);
    }
  }
}

const sincronizadorEstoqueService = new SincronizadorEstoqueService();

export default sincronizadorEstoqueService;

import BlingConfig from '../models/BlingConfig.js';
import blingService from './blingService.js';
import Produto from '../models/Produto.js';
import { getBrazilNow } from '../utils/timezone.js';

/**
 * Função auxiliar para normalizar SKU
 * Remove espaços, converte para maiúsculas e remove zeros à esquerda
 */
function normalizeSku(sku) {
  if (!sku) return '';
  return sku
    .toString()
    .trim()
    .toUpperCase()
    .replace(/^0+/, ''); // Remove zeros à esquerda
}

/**
 * Serviço de Estoque Unificado
 * Agrega estoque de múltiplas contas Bling
 */
const extrairSaldosDepositos = (produto) => {
  const saldos = {};
  if (!produto) {
    return saldos;
  }

  const candidatos = [];
  if (Array.isArray(produto.estoque?.depositos)) {
    candidatos.push(...produto.estoque.depositos);
  }
  if (Array.isArray(produto.depositos)) {
    candidatos.push(...produto.depositos);
  }
  if (Array.isArray(produto.estoque?.saldosPorDeposito)) {
    candidatos.push(...produto.estoque.saldosPorDeposito);
  }
  if (Array.isArray(produto.estoque?.stocks)) {
    candidatos.push(...produto.estoque.stocks);
  }

  for (const item of candidatos) {
    if (!item) continue;
    const deposito =
      item.deposito ||
      item.deposit ||
      item.local ||
      item;
    const id =
      deposito?.id ||
      item.idDeposito ||
      item.depositoId ||
      item.depositId ||
      deposito?.codigo;

    if (!id) continue;

    const valor =
      Number(
        item.saldo ??
          item.saldoVirtual ??
          item.saldoDisponivel ??
          item.saldoAtual ??
          item.quantidade ??
          item.saldoFisico ??
          item.saldoVirtualTotal ??
          deposito?.saldo
      ) || 0;

    const chave = String(id);
    saldos[chave] = (saldos[chave] || 0) + valor;
  }

  return saldos;
};

class BlingEstoqueUnificadoService {
  /**
   * Busca estoque unificado de um produto em todas as contas ativas
   * @param {string} tenantId
   * @param {string} sku
   * @returns {Promise<{total: number, estoquePorConta: Object, erros: Array, detalhesPorConta: Object}>}
   */
  async buscarEstoqueUnificado(tenantId, sku, mapaDepositosMonitorados = {}, contasPermitidas = []) {
    const skuNormalizado = normalizeSku(sku);
    const estoquePorConta = {};
    const detalhesPorConta = {};
    const erros = [];
    let total = 0;

    console.log(
      `[ESTOQUE-UNIFICADO] Buscando estoque para SKU ${skuNormalizado} (tenant: ${tenantId})`
    );

    // Buscar todas as contas ativas do tenant
    let contas = (await BlingConfig.find({
      tenantId,
      is_active: true
    })).filter((c) => c && c.is_active !== false && c.isActive !== false);

    // Restringir às contas permitidas (ex.: apenas as ativas na configuração)
    if (Array.isArray(contasPermitidas) && contasPermitidas.length > 0) {
      const permitidas = new Set(contasPermitidas);
      contas = contas.filter((c) => permitidas.has(c.blingAccountId));
    }

    if (contas.length === 0) {
      console.log(
        `[ESTOQUE-UNIFICADO] Nenhuma conta ativa encontrada para tenant ${tenantId}`
      );
      return { total: 0, estoquePorConta: {}, erros: [] };
    }

    console.log(
      `[ESTOQUE-UNIFICADO] Encontradas ${contas.length} conta(s) ativa(s)`
    );

    // Processar todas as contas em paralelo
    const promessas = contas.map(async (conta) => {
      try {
        let produto = await blingService.getProdutoPorSku(
          skuNormalizado,
          tenantId,
          conta.blingAccountId,
          true
        );

        // Fallback: se não achou pelo SKU, tenta pelo ID (caso webhook traga productId)
        if (!produto) {
          produto = await blingService.getProdutoPorId(
            skuNormalizado,
            tenantId,
            conta.blingAccountId,
            true
          );
        }

        const saldosDepositos = extrairSaldosDepositos(produto);
        let estoqueConta = Object.values(saldosDepositos).reduce(
          (acc, valor) => acc + (Number(valor) || 0),
          0
        );

        if (!Number.isFinite(estoqueConta) || estoqueConta === 0) {
          estoqueConta =
            Number(produto?.estoque?.saldoVirtualTotal) ||
            Number(produto?.saldoInventario) ||
            0;
      }

      const saldosMonitorados = {};
      const depositosDaConta = Object.entries(mapaDepositosMonitorados || {}).filter(
        ([, contaId]) => contaId === conta.blingAccountId
      );

      // Só faz consultas detalhadas de depósito se tiver um produto válido
      if (!produto?.id && depositosDaConta.length > 0) {
        console.warn(
          `[ESTOQUE-UNIFICADO] ⚠️ Produto não retornou id ao consultar SKU ${skuNormalizado} na conta ${conta.accountName}. Pulando consultas por depósito.`
        );
      }

      for (const [depositoId] of depositosDaConta) {
        if (!produto?.id) {
          saldosMonitorados[depositoId] = 0;
          continue;
        }

        try {
          const saldoDeposito = await blingService.getSaldoProdutoPorDeposito(
            produto?.id,
            depositoId,
            tenantId,
              conta.blingAccountId
            );
            saldosMonitorados[depositoId] = saldoDeposito;
          } catch (errorSaldo) {
            console.warn(
              `[ESTOQUE-UNIFICADO] ⚠️ Não foi possível obter saldo do depósito ${depositoId} para conta ${conta.accountName}: ${errorSaldo.message}`
            );
            saldosMonitorados[depositoId] = 0;
          }
        }

        estoquePorConta[conta.blingAccountId] = estoqueConta;
        detalhesPorConta[conta.blingAccountId] = {
          total: estoqueConta,
          depositos: saldosDepositos,
          monitorados: saldosMonitorados,
          contaId: conta.blingAccountId,
          contaNome: conta.accountName,
          produtoId: produto?.id || null,
        };
        total += estoqueConta;

        console.log(
          `[ESTOQUE-UNIFICADO] Conta ${conta.blingAccountId} (${conta.accountName}): ${estoqueConta} unidades`
        );
      } catch (error) {
        const erroMsg = `Conta ${conta.blingAccountId} (${conta.accountName}): ${error.message}`;
        console.error(`[ESTOQUE-UNIFICADO] ❌ ${erroMsg}`);
        erros.push(erroMsg);
        estoquePorConta[conta.blingAccountId] = 0; // Usar 0 se falhar
        detalhesPorConta[conta.blingAccountId] = {
          total: 0,
          depositos: {},
          monitorados: {},
          contaId: conta.blingAccountId,
          contaNome: conta.accountName,
          produtoId: null,
        };
      }
    });

    await Promise.all(promessas);

    console.log(
      `[ESTOQUE-UNIFICADO] Total unificado: ${total} unidades (${erros.length} erro(s))`
    );

    return {
      total,
      estoquePorConta,
      erros,
      detalhesPorConta,
    };
  }

  /**
   * Busca estoque por conta separadamente
   * @param {string} tenantId
   * @param {string} sku
   * @returns {Promise<Object>}
   */
  async buscarEstoquePorConta(tenantId, sku) {
    const skuNormalizado = normalizeSku(sku);
    const resultado = {};

    const contas = await BlingConfig.find({
      tenantId,
      is_active: true
    });

    const promessas = contas.map(async (conta) => {
      try {
        const estoque = await blingService.getEstoqueProduto(
          skuNormalizado,
          tenantId,
          conta.blingAccountId
        );

        resultado[conta.blingAccountId] = {
          estoque,
          conta: conta.accountName || conta.blingAccountId
        };
      } catch (error) {
        resultado[conta.blingAccountId] = {
          estoque: 0,
          conta: conta.accountName || conta.blingAccountId,
          erro: error.message
        };
      }
    });

    await Promise.all(promessas);

    return resultado;
  }

  /**
   * Sincroniza estoque unificado de todos os produtos
   * @param {string} tenantId
   * @param {Object} options
   * @returns {Promise<{success: boolean, processedCount: number, message: string}>}
   */
  async sincronizarEstoqueUnificado(tenantId, options = {}) {
    const limit = options.limit || 50;
    const skip = options.skip || 0;

    console.log(
      `[ESTOQUE-UNIFICADO] Iniciando sincronização em lote (tenant: ${tenantId}, limit: ${limit}, skip: ${skip})`
    );

    // Buscar produtos do tenant
    const produtos = await Produto.find({ tenantId })
      .skip(skip)
      .limit(limit)
      .lean();

    if (produtos.length === 0) {
      return {
        success: true,
        processedCount: 0,
        message: 'Nenhum produto encontrado para sincronizar'
      };
    }

    console.log(
      `[ESTOQUE-UNIFICADO] Processando ${produtos.length} produto(s)`
    );

    // Processar produtos em paralelo
    const operacoes = [];

    for (const produto of produtos) {
      try {
        const { total, estoquePorConta } = await this.buscarEstoqueUnificado(
          tenantId,
          produto.sku
        );

        // Preparar atualização
        operacoes.push({
          updateOne: {
            filter: { tenantId, sku: produto.sku },
            update: {
              $set: {
                estoque: total,
                estoquePorConta: estoquePorConta,
                ultimaSincronizacao: getBrazilNow(),
                updatedAt: getBrazilNow()
              }
            },
            upsert: true
          }
        });
      } catch (error) {
        console.error(
          `[ESTOQUE-UNIFICADO] ❌ Erro ao sincronizar produto ${produto.sku}:`,
          error.message
        );
      }
    }

    // Executar atualizações em lote
    if (operacoes.length > 0) {
      await Produto.bulkWrite(operacoes);
    }

    console.log(
      `[ESTOQUE-UNIFICADO] ✅ Sincronização concluída: ${operacoes.length} produto(s) atualizado(s)`
    );

    return {
      success: true,
      processedCount: operacoes.length,
      message: `${operacoes.length} produto(s) sincronizado(s) com sucesso`
    };
  }

  /**
   * Sincroniza estoque de um produto específico
   * @param {string} tenantId
   * @param {string} sku
   * @returns {Promise<{success: boolean, produto: Object}>}
   */
  async sincronizarEstoqueProdutoUnico(tenantId, sku) {
    const skuNormalizado = normalizeSku(sku);

    console.log(
      `[ESTOQUE-UNIFICADO] Sincronizando produto único: ${skuNormalizado} (tenant: ${tenantId})`
    );

    const { total, estoquePorConta, erros } = await this.buscarEstoqueUnificado(
      tenantId,
      skuNormalizado
    );

    // Buscar ou criar produto
    let produto = await Produto.findOne({ tenantId, sku: skuNormalizado });

    if (!produto) {
        produto = new Produto({
          tenantId,
          sku: skuNormalizado,
          estoque: total,
          estoquePorConta: estoquePorConta,
          ultimaSincronizacao: getBrazilNow()
        });
      } else {
        produto.estoque = total;
        produto.estoquePorConta = estoquePorConta;
        produto.ultimaSincronizacao = getBrazilNow();
      }

    await produto.save();

    console.log(
      `[ESTOQUE-UNIFICADO] ✅ Produto ${skuNormalizado} sincronizado: ${total} unidades`
    );

    return {
      success: true,
      produto: {
        sku: produto.sku,
        estoque: produto.estoque,
        estoquePorConta: Object.fromEntries(
          produto.estoquePorConta instanceof Map
            ? produto.estoquePorConta
            : Object.entries(produto.estoquePorConta || {})
        ),
        ultimaSincronizacao: produto.ultimaSincronizacao,
        erros
      }
    };
  }
}

export default new BlingEstoqueUnificadoService();

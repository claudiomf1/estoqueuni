import BlingConfig from '../models/BlingConfig.js';
import blingService from './blingService.js';
import Produto from '../models/Produto.js';

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
class BlingEstoqueUnificadoService {
  /**
   * Busca estoque unificado de um produto em todas as contas ativas
   * @param {string} tenantId
   * @param {string} sku
   * @returns {Promise<{total: number, estoquePorConta: Object, erros: Array}>}
   */
  async buscarEstoqueUnificado(tenantId, sku) {
    const skuNormalizado = normalizeSku(sku);
    const estoquePorConta = {};
    const erros = [];
    let total = 0;

    console.log(
      `[ESTOQUE-UNIFICADO] Buscando estoque para SKU ${skuNormalizado} (tenant: ${tenantId})`
    );

    // Buscar todas as contas ativas do tenant
    const contas = await BlingConfig.find({
      tenantId,
      is_active: true
    });

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
        const estoque = await blingService.getEstoqueProduto(
          skuNormalizado,
          tenantId,
          conta.blingAccountId
        );

        estoquePorConta[conta.blingAccountId] = estoque;
        total += estoque;

        console.log(
          `[ESTOQUE-UNIFICADO] Conta ${conta.blingAccountId} (${conta.accountName}): ${estoque} unidades`
        );
      } catch (error) {
        const erroMsg = `Conta ${conta.blingAccountId} (${conta.accountName}): ${error.message}`;
        console.error(`[ESTOQUE-UNIFICADO] ❌ ${erroMsg}`);
        erros.push(erroMsg);
        estoquePorConta[conta.blingAccountId] = 0; // Usar 0 se falhar
      }
    });

    await Promise.all(promessas);

    console.log(
      `[ESTOQUE-UNIFICADO] Total unificado: ${total} unidades (${erros.length} erro(s))`
    );

    return {
      total,
      estoquePorConta,
      erros
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
                ultimaSincronizacao: new Date(),
                updatedAt: new Date()
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
        ultimaSincronizacao: new Date()
      });
    } else {
      produto.estoque = total;
      produto.estoquePorConta = estoquePorConta;
      produto.ultimaSincronizacao = new Date();
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

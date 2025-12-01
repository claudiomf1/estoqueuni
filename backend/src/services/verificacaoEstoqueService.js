import ConfiguracaoSincronizacao from '../models/ConfiguracaoSincronizacao.js';
import EventoProcessado from '../models/EventoProcessado.js';
import Produto from '../models/Produto.js';
import sincronizadorEstoqueService from './sincronizadorEstoqueService.js';
import { getBrazilNow } from '../utils/timezone.js';

/**
 * Serviço responsável pelo cronjob de verificação de estoques.
 * Executa sincronizações periódicas quando produtos estão desatualizados,
 * funcionando como fallback para o fluxo principal via webhooks.
 */
class VerificacaoEstoqueService {
  constructor() { 
    this.intervaloPadraoMinutos = 30;
    this.maxProdutosPorExecucao = 100;
    this.cooldownMinutos = 5; // evita reprocessar o mesmo produto em sequência
  }

  /**
   * Retorna tenants com cronjob ativo e prontos para serem processados.
   * @returns {Promise<string[]>}
   */
  async buscarTenantsAtivos() {
    const configs = await ConfiguracaoSincronizacao.find({
      ativo: true,
      'cronjob.ativo': true,
    }).select('tenantId cronjob');

    const elegiveis = configs
      .filter((config) => this._deveExecutarAgora(config))
      .map((config) => config.tenantId);

    return elegiveis;
  }

  /**
   * Executa verificação para um tenant específico.
   * @param {string} tenantId
   */
  async executarVerificacao(tenantId) {
    const resultado = {
      success: false,
      tenantId,
      produtosSincronizados: 0,
      produtosIgnorados: 0,
      erros: 0,
    };

    const config = await ConfiguracaoSincronizacao.findOne({ tenantId });

    if (!config) {
      resultado.message = 'Configuração não encontrada';
      return resultado;
    }

    if (!config.ativo || !config.isConfigurationComplete()) {
      resultado.message = 'Sincronização inativa ou configuração incompleta';
      return resultado;
    }

    if (!config.cronjob || config.cronjob.ativo !== true) {
      resultado.message = 'Cronjob desativado';
      return resultado;
    }

    const intervalo = config.cronjob.intervaloMinutos || this.intervaloPadraoMinutos;
    const produtos = await this.buscarProdutosDesatualizados(tenantId, intervalo);

    if (!produtos || produtos.length === 0) {
      config.atualizarUltimaExecucao();
      await config.save();
      resultado.success = true;
      resultado.message = 'Nenhum produto desatualizado';
      return resultado;
    }

    console.log(
      `[VERIFICACAO-ESTOQUE] Tenant ${tenantId} - ${produtos.length} produto(s) para validar`
    );

    const cooldownLimite = new Date(Date.now() - this.cooldownMinutos * 60 * 1000);
    const skus = produtos.map((produto) => produto?.sku).filter(Boolean);

    const eventosRecentes = skus.length
      ? await EventoProcessado.find({
          tenantId,
          produtoId: { $in: skus },
          origem: 'cronjob',
          processadoEm: { $gte: cooldownLimite },
        })
          .select('produtoId')
          .lean()
      : [];

    const produtosProcessadosRecentemente = new Set(
      eventosRecentes.map((evento) => evento.produtoId)
    );

    for (const produto of produtos) {
      const sku = produto?.sku;

      if (!sku) {
        resultado.produtosIgnorados++;
        continue;
      }

      if (produtosProcessadosRecentemente.has(sku)) {
        resultado.produtosIgnorados++;
        continue;
      }

      try {
        const sincronizacao = await sincronizadorEstoqueService.sincronizarEstoque(
          sku,
          tenantId,
          'cronjob'
        );

        if (sincronizacao?.success) {
          resultado.produtosSincronizados++;
          config.incrementarEstatistica('cronjob');
          config.ultimaSincronizacao = getBrazilNow();
        } else {
          resultado.erros++;
        }
      } catch (error) {
        if (error?.code === 'PRODUTO_COMPOSTO') {
          resultado.produtosIgnorados++;
          console.warn(
            `[VERIFICACAO-ESTOQUE] ⚠️ Produto ${sku} ignorado (produto composto): ${error.message}`
          );
        } else {
          resultado.erros++;
          console.error(
            `[VERIFICACAO-ESTOQUE] ❌ Erro ao sincronizar produto ${sku}:`,
            error.message
          );
        }
      }
    }

    config.atualizarUltimaExecucao();
    await config.save();

    resultado.success = true;
    resultado.message = `Processados ${produtos.length} produto(s)`;
    return resultado;
  }

  /**
   * Busca produtos desatualizados de acordo com o intervalo informado.
   * @param {string} tenantId
   * @param {number} intervaloMinutos
   */
  async buscarProdutosDesatualizados(
    tenantId,
    intervaloMinutos = this.intervaloPadraoMinutos
  ) {
    const intervaloMs = Math.max(intervaloMinutos, 1) * 60 * 1000;
    const limiteData = new Date(Date.now() - intervaloMs);

    const produtos = await Produto.find({
      tenantId,
      $or: [
        { ultimaSincronizacao: { $exists: false } },
        { ultimaSincronizacao: null },
        { ultimaSincronizacao: { $lte: limiteData } },
      ],
    })
      .sort({ ultimaSincronizacao: 1 })
      .limit(this.maxProdutosPorExecucao)
      .lean();

    return produtos;
  }

  /**
   * Verifica se o cronjob do tenant está vencido para nova execução.
   * @param {ConfiguracaoSincronizacao} config
   * @returns {boolean}
   */
  _deveExecutarAgora(config) {
    if (!config?.cronjob?.ativo) {
      return false;
    }

    const agora = Date.now();
    const intervaloMs =
      (config.cronjob.intervaloMinutos || this.intervaloPadraoMinutos) * 60 * 1000;

    if (config.cronjob.proximaExecucao) {
      return new Date(config.cronjob.proximaExecucao).getTime() <= agora;
    }

    if (!config.cronjob.ultimaExecucao) {
      return true;
    }

    return agora - new Date(config.cronjob.ultimaExecucao).getTime() >= intervaloMs;
  }
}

const verificacaoEstoqueService = new VerificacaoEstoqueService();

export default verificacaoEstoqueService;

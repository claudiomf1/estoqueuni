import ConfiguracaoSincronizacao from '../models/ConfiguracaoSincronizacao.js';
import BlingConfig from '../models/BlingConfig.js';
import EventoProcessado from '../models/EventoProcessado.js';
import Produto from '../models/Produto.js';
import sincronizadorEstoqueService from '../services/sincronizadorEstoqueService.js';
import { getBrazilNow } from '../utils/timezone.js';
import inconsistenciasService from '../services/inconsistenciaEstoqueService.js';

class SincronizacaoController {
  async obterConfiguracao(req, res) {
    try { 
      const tenantId = this._obterTenantId(req);
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'tenantId é obrigatório',
        });
      }

      const config = await ConfiguracaoSincronizacao.buscarOuCriar(tenantId);

      return res.json({
        success: true,
        data: this._formatarConfig(config),
      });
    } catch (error) {
      console.error('[SINCRONIZACAO] Erro ao obter configuração:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao obter configuração',
      });
    }
  }

  async salvarConfiguracao(req, res) {
    try {
      const tenantId = req.body?.tenantId;
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'tenantId é obrigatório',
        });
      }

      const payload = this._montarPayloadConfiguracao(req.body);

      const config = await ConfiguracaoSincronizacao.findOneAndUpdate(
        { tenantId },
        { $set: payload },
        { upsert: true, new: true }
      );

      return res.json({
        success: true,
        data: this._formatarConfig(config),
      });
    } catch (error) {
      console.error('[SINCRONIZACAO] Erro ao salvar configuração:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao salvar configuração',
      });
    }
  }

  async obterStatus(req, res) {
    try {
      const tenantId = this._obterTenantId(req);
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'tenantId é obrigatório',
        });
      }

      const config = await ConfiguracaoSincronizacao.buscarOuCriar(tenantId);
      await this._sincronizarContasComConfiguracao(tenantId, config);

      const totalEventos = await EventoProcessado.countDocuments({ tenantId });
      const totalErros = await EventoProcessado.countDocuments({
        tenantId,
        sucesso: false,
      });

      const ativo = config.ativo === true;

      const response = {
        tenantId,
        ativo,
        configuracaoCompleta: config.isConfigurationComplete(),
        ultimaSincronizacao: config.ultimaSincronizacao,
        totalSincronizado: totalEventos,
        totalSucesso: Math.max(totalEventos - totalErros, 0),
        totalErros,
        totalPendentes: 0,
        estatisticas: config.estatisticas || {},
        webhook: this._montarStatusWebhook(config),
      };

      return res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error('[SINCRONIZACAO] Erro ao obter status:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao obter status',
      });
    }
  }

  async listarSuspeitos(req, res) {
    try {
      const tenantId = this._obterTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'tenantId é obrigatório' });
      }

      const limite = Number(req.query?.limit) || 50;
      const lista = await inconsistenciasService.listarSuspeitos(tenantId, limite);

      return res.json({ success: true, data: lista });
    } catch (error) {
      console.error('[SINCRONIZACAO] Erro ao listar suspeitos:', error);
      return res.status(500).json({ success: false, message: error.message || 'Erro ao listar suspeitos' });
    }
  }

  async reconciliarSuspeitos(req, res) {
    try {
      const tenantId = this._obterTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'tenantId é obrigatório' });
      }

      const limite = Math.min(Number(req.body?.limit) || 50, 200);
      const lista = await inconsistenciasService.listarSuspeitos(tenantId, limite);
      const skus = (lista || []).map((item) => item.sku).filter(Boolean);

      const resultado = await this._reconciliarListaSkus(skus, tenantId, 'reconciliacao-suspeitos');
      return res.json({ success: true, data: resultado });
    } catch (error) {
      console.error('[SINCRONIZACAO] Erro na reconciliação de suspeitos:', error);
      return res.status(500).json({ success: false, message: error.message || 'Erro na reconciliação' });
    }
  }

  async reconciliarRecentes(req, res) {
    try {
      const tenantId = this._obterTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'tenantId é obrigatório' });
      }
      const horas = Number(req.body?.horas) || 24;
      const limite = Math.min(Number(req.body?.limit) || 20, 200);
      const skus = await inconsistenciasService.obterUltimosSkusProcessados(tenantId, horas, limite);

      const resultado = await this._reconciliarListaSkus(skus, tenantId, 'reconciliacao-recentes');
      return res.json({ success: true, data: resultado });
    } catch (error) {
      console.error('[SINCRONIZACAO] Erro na reconciliação de recentes:', error);
      return res.status(500).json({ success: false, message: error.message || 'Erro na reconciliação' });
    }
  }

  async reconciliarLista(req, res) {
    try {
      const tenantId = this._obterTenantId(req);
      const skus = Array.isArray(req.body?.skus) ? req.body.skus : [];
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'tenantId é obrigatório' });
      }
      if (!skus.length) {
        return res.status(400).json({ success: false, message: 'Lista de SKUs não fornecida' });
      }

      const resultado = await this._reconciliarListaSkus(skus, tenantId, 'reconciliacao-manual');
      return res.json({ success: true, data: resultado });
    } catch (error) {
      console.error('[SINCRONIZACAO] Erro na reconciliação de lista:', error);
      return res.status(500).json({ success: false, message: error.message || 'Erro na reconciliação' });
    }
  }

  async sincronizarManual(req, res) {
    try {
      const tenantId = req.body?.tenantId;
      const produtoId = req.body?.produtoId || req.body?.sku;

      if (!tenantId || !produtoId) {
        return res.status(400).json({
          success: false,
          message: 'tenantId e produtoId são obrigatórios',
        });
      }

      const produto = await Produto.findOne({ tenantId, sku: produtoId }).lean();
      if (!produto) {
        console.warn(
          `[SINCRONIZACAO] Produto ${produtoId} não encontrado localmente, prosseguindo mesmo assim.`
        );
      }

      const resultado = await sincronizadorEstoqueService.sincronizarEstoque(
        produtoId,
        tenantId,
        'manual'
      );

      return res.json({
        success: true,
        data: resultado,
      });
    } catch (error) {
      console.error('[SINCRONIZACAO] Erro na sincronização manual:', error);
      if (error?.code === 'PRODUTO_COMPOSTO' || error?.codigoErro === 'PRODUTO_COMPOSTO_NAO_SUPORTADO') {
        return res.status(error.httpStatus || 400).json({
          success: false,
          error: 'PRODUTO_COMPOSTO',
          codigoErro: 'PRODUTO_COMPOSTO_NAO_SUPORTADO',
          message:
            error.message ||
            'Produto composto detectado. Produtos compostos não suportam sincronização automática.',
        });
      }
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao sincronizar produto',
      });
    }
  }

  async obterHistorico(req, res) {
    try {
      const tenantId = this._obterTenantId(req);
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'tenantId é obrigatório',
        });
      }

      const {
        limit = 50,
        skip = 0,
        origem,
        sku,
        dataInicio,
        dataFim,
      } = req.query;

      const filtro = { tenantId };

      if (origem) {
        filtro.origem = origem;
      }

      if (sku) {
        filtro.$or = [{ produtoId: sku }, { sku }];
      }

      if (dataInicio || dataFim) {
        filtro.processadoEm = {};
        if (dataInicio) {
          filtro.processadoEm.$gte = new Date(dataInicio);
        }
        if (dataFim) {
          filtro.processadoEm.$lte = new Date(dataFim);
        }
      }

      const limiteFinal = Math.min(Number(limit) || 50, 200);
      const skipFinal = Number(skip) || 0;

      const [registros, total] = await Promise.all([
        EventoProcessado.find(filtro)
          .sort({ processadoEm: -1 })
          .skip(skipFinal)
          .limit(limiteFinal)
          .lean(),
        EventoProcessado.countDocuments(filtro),
      ]);

      return res.json({
        success: true,
        data: {
          registros,
          total,
          paginacao: {
            limit: limiteFinal,
            skip: skipFinal,
          },
        },
      });
    } catch (error) {
      console.error('[SINCRONIZACAO] Erro ao obter histórico:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao obter histórico',
      });
    }
  }

  async obterLogs(req, res) {
    try {
      const tenantId = this._obterTenantId(req);
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'tenantId é obrigatório',
        });
      }

      const { limit = 100, busca, nivel } = req.query;
      const filtro = { tenantId };

      if (nivel) {
        filtro.sucesso = nivel.toLowerCase() === 'error' ? false : true;
      }

      if (busca) {
        const regex = new RegExp(busca, 'i');
        filtro.$or = [{ produtoId: regex }, { erro: regex }, { origem: regex }];
      }

      const registros = await EventoProcessado.find(filtro)
        .sort({ processadoEm: -1 })
        .limit(Math.min(Number(limit) || 100, 500))
        .lean();

      const logs = registros.map((registro) => ({
        id: registro._id,
        dataHora: registro.processadoEm,
        nivel: registro.sucesso ? 'info' : 'error',
        mensagem:
          registro.erro ||
          `Produto ${registro.produtoId} sincronizado (${registro.origem})`,
        dados: {
          origem: registro.origem,
          soma: registro.soma,
          produtoId: registro.produtoId,
        },
      }));

      return res.json({
        success: true,
        data: {
          logs,
          paginacao: {
            limit: Math.min(Number(limit) || 100, 500),
          },
        },
      });
    } catch (error) {
      console.error('[SINCRONIZACAO] Erro ao obter logs:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao obter logs',
      });
    }
  }

  async atualizarWebhook(req, res) {
    try {
      const tenantId = req.body?.tenantId;
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'tenantId é obrigatório',
        });
      }

      const { url, secret, ativo } = req.body;

      const campos = {};
      if (url !== undefined) campos['webhook.url'] = url;
      if (secret !== undefined) campos['webhook.secret'] = secret;
      if (typeof ativo === 'boolean') campos['webhook.ativo'] = ativo;

      const config = await ConfiguracaoSincronizacao.findOneAndUpdate(
        { tenantId },
        { $set: campos },
        { new: true }
      );

      return res.json({
        success: true,
        data: this._formatarConfig(config),
      });
    } catch (error) {
      console.error('[SINCRONIZACAO] Erro ao atualizar webhook:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao atualizar webhook',
      });
    }
  }

  async marcarContaWebhookConfigurada(req, res) {
    try {
      const tenantId = req.body?.tenantId || req.query?.tenantId || req.tenantId;
      const blingAccountId =
        req.body?.blingAccountId ||
        req.query?.blingAccountId ||
        req.params?.blingAccountId;

      if (!tenantId || !blingAccountId) {
        return res.status(400).json({
          success: false,
          message: 'tenantId e blingAccountId são obrigatórios',
        });
      }

      const config = await ConfiguracaoSincronizacao.findOne({ tenantId });

      if (!config) {
        console.warn('[SINCRONIZACAO] ⚠️ Configuração não encontrada ao marcar conta webhook configurada');
        return res.status(200).json({
          success: false,
          message: 'Configuração não encontrada para este tenant',
        });
      }
 
      let conta = config.contasBling.find(
        (c) =>
          c.blingAccountId === blingAccountId ||
          c._id?.toString() === blingAccountId ||
          c.id === blingAccountId
      );

      if (!conta) {
        // tenta buscar no BlingConfig e inserir automaticamente
        const contaRegistro = await BlingConfig.findOne({
          tenantId,
          blingAccountId
        }).lean();

        if (contaRegistro) {
          conta = {
            blingAccountId: contaRegistro.blingAccountId,
            accountName: contaRegistro.accountName || contaRegistro.store_name || 'Conta Bling',
            isActive: contaRegistro.is_active !== false,
            webhookConfigurado: false,
          };
          config.contasBling.push(conta);
        } else {
          console.warn(
            `[SINCRONIZACAO] ⚠️ Conta ${blingAccountId} não encontrada para tenant ${tenantId}`
          );
          return res.status(200).json({
            success: false,
            message: 'Conta Bling não encontrada na configuração',
          });
        }
      }

      conta.webhookConfigurado = true;
      conta.webhookConfiguradoEm = getBrazilNow();

      await config.save();

      return res.json({
        success: true,
        data: this._formatarConfig(config),
      });
    } catch (error) {
      console.error(
        '[SINCRONIZACAO] Erro ao marcar conta como configurada:',
        error
      );
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao atualizar conta',
      });
    }
  }

  async limparEstatisticas(req, res) {
    try {
      const tenantId = this._obterTenantId(req);
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'tenantId é obrigatório',
        });
      }

      const resultado = await EventoProcessado.deleteMany({ tenantId });

      console.log(`[SINCRONIZACAO] Estatísticas limpas para tenant ${tenantId}: ${resultado.deletedCount} registros removidos`);

      return res.json({
        success: true,
        message: `Estatísticas limpas com sucesso. ${resultado.deletedCount} registro(s) removido(s).`,
        data: {
          registrosRemovidos: resultado.deletedCount,
        },
      });
    } catch (error) {
      console.error('[SINCRONIZACAO] Erro ao limpar estatísticas:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao limpar estatísticas',
      });
    }
  }

  _obterTenantId(req) {
    return req.query?.tenantId || req.body?.tenantId || req.params?.tenantId;
  }

  async _reconciliarListaSkus(skus = [], tenantId, origem = 'reconciliacao') {
    const resultados = [];
    const vistos = new Set();
    for (const sku of skus) {
      const chave = String(sku).trim();
      if (!chave || vistos.has(chave)) continue;
      vistos.add(chave);
      try {
        const res = await sincronizadorEstoqueService.sincronizarEstoque(chave, tenantId, origem);
        resultados.push({ sku: chave, sucesso: true, resultado: res });
      } catch (error) {
        resultados.push({ sku: chave, sucesso: false, erro: error.message || String(error) });
      }
    }
    return {
      total: resultados.length,
      sucesso: resultados.filter((r) => r.sucesso).length,
      erros: resultados.filter((r) => !r.sucesso),
      resultados,
    };
  }

  _formatarConfig(config) {
    if (!config) {
      return null;
    }
    const obj = config.toObject({ versionKey: false });
    return obj;
  }

  /**
   * Garante que ConfiguracaoSincronizacao.contasBling reflita as contas Bling cadastradas no tenant
   */
  async _sincronizarContasComConfiguracao(tenantId, config) {
    if (!tenantId || !config) return;

    try {
      const contasBlingDb = await BlingConfig.find({ tenantId }).lean();
      if (!Array.isArray(contasBlingDb) || contasBlingDb.length === 0) {
        return;
      }

      if (!Array.isArray(config.contasBling)) {
        config.contasBling = [];
      }

      const mapaExistentes = new Map(
        config.contasBling
          .filter((c) => c?.blingAccountId)
          .map((c) => [c.blingAccountId, c])
      );

      contasBlingDb.forEach((conta) => {
        const existing = mapaExistentes.get(conta.blingAccountId);
        if (existing) {
          existing.accountName =
            conta.accountName ||
            conta.store_name ||
            existing.accountName ||
            'Conta Bling';
          existing.isActive = conta.is_active !== false;
          if (existing.webhookConfigurado === undefined) {
            existing.webhookConfigurado = false;
          }
        } else {
          config.contasBling.push({
            blingAccountId: conta.blingAccountId,
            accountName:
              conta.accountName || conta.store_name || 'Conta Bling',
            isActive: conta.is_active !== false,
            webhookConfigurado: false,
            webhookConfiguradoEm: null,
            depositosPrincipais: [],
            depositoCompartilhado: null,
          });
        }
      });

      // Ativar config se houver pelo menos uma conta ativa
      config.ativo = config.contasBling.some(
        (item) => item && item.isActive !== false
      );

      await config.save();
    } catch (error) {
      console.warn(
        `[SINCRONIZACAO] Não foi possível sincronizar contas Bling na ConfiguracaoSincronizacao (tenant ${tenantId}): ${error.message}`
      );
    }
  }

  _montarStatusWebhook(config) {
    const contas = (config.contasBling || []).filter(
      (conta) => conta.isActive !== false
    );
    const configuradas = contas.filter((conta) => conta.webhookConfigurado);

    return {
      totalContas: contas.length,
      configuradas: configuradas.length,
      pendentes: contas.length - configuradas.length,
      todasConfiguradas:
        contas.length > 0 && configuradas.length === contas.length,
      contasBling: contas.map((conta) => ({
        blingAccountId: conta.blingAccountId,
        accountName: conta.accountName,
        webhookConfigurado: conta.webhookConfigurado || false,
        webhookConfiguradoEm: conta.webhookConfiguradoEm,
      })),
    };
  }

  _montarPayloadConfiguracao(body) {
    const payload = {};

    if (Array.isArray(body.depositos)) {
      payload.depositos = body.depositos;
    }

    if (body.regraSincronizacao) {
      payload.regraSincronizacao = {
        tipo: body.regraSincronizacao.tipo || 'soma',
        depositosPrincipais:
          body.regraSincronizacao.depositosPrincipais || [],
        depositosCompartilhados:
          body.regraSincronizacao.depositosCompartilhados || [],
      };
    }

    if (Array.isArray(body.contasBling)) {
      payload.contasBling = body.contasBling;
    }

    if (typeof body.ativo === 'boolean') {
      payload.ativo = body.ativo;
    }

    return payload;
  }
}

export default SincronizacaoController;

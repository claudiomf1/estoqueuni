import ConfiguracaoSincronizacao from '../models/ConfiguracaoSincronizacao.js';
import EventoProcessado from '../models/EventoProcessado.js';

/**
 * Controller para gerenciar sincronização de estoques
 */
class SincronizacaoController {
  /**
   * Obtém configuração de sincronização do tenant
   * GET /api/sincronizacao/config?tenantId=xxx
   */
  async obterConfiguracao(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      const config = await ConfiguracaoSincronizacao.findOne({ tenantId });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Configuração não encontrada',
          message: 'Configuração não encontrada para este tenant'
        });
      }

      return res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('❌ Erro ao obter configuração:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter configuração',
        message: error.message
      });
    }
  }

  /**
   * Salva ou atualiza configuração de sincronização
   * POST /api/sincronizacao/config
   * Body: { tenantId, depositos?, contasBling?, regraSincronizacao?, ativo? }
   */
  async salvarConfiguracao(req, res) {
    try {
      const tenantId = req.tenantId || req.body.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      const { depositos, contasBling, regraSincronizacao, ativo } = req.body;

      // Buscar ou criar configuração
      let config = await ConfiguracaoSincronizacao.buscarOuCriar(tenantId);

      // Atualizar campos fornecidos (arrays são substituídos, não mesclados)
      if (depositos !== undefined) {
        config.depositos = Array.isArray(depositos) ? depositos : [];
      }

      if (contasBling !== undefined) {
        config.contasBling = Array.isArray(contasBling) ? contasBling : [];
      }

      if (regraSincronizacao !== undefined) {
        config.regraSincronizacao = {
          tipo: regraSincronizacao.tipo || 'soma',
          depositosPrincipais: Array.isArray(regraSincronizacao.depositosPrincipais) 
            ? regraSincronizacao.depositosPrincipais 
            : [],
          depositosCompartilhados: Array.isArray(regraSincronizacao.depositosCompartilhados)
            ? regraSincronizacao.depositosCompartilhados
            : []
        };
      }

      if (ativo !== undefined) {
        config.ativo = ativo;
      }

      await config.save();

      return res.json({
        success: true,
        data: config,
        message: 'Configuração salva com sucesso'
      });
    } catch (error) {
      console.error('❌ Erro ao salvar configuração:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar configuração',
        message: error.message
      });
    }
  }

  /**
   * Obtém status da sincronização
   * GET /api/sincronizacao/status?tenantId=xxx
   */
  async obterStatus(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      const config = await ConfiguracaoSincronizacao.findOne({ tenantId });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Configuração não encontrada'
        });
      }

      // Buscar último evento processado
      const ultimoEvento = await EventoProcessado.findOne({ tenantId })
        .sort({ processadoEm: -1 })
        .limit(1);

      return res.json({
        success: true,
        data: {
          ativo: config.ativo,
          webhook: {
            ativo: config.webhook?.ativo || false,
            ultimaRequisicao: config.webhook?.ultimaRequisicao || null
          },
          cronjob: {
            ativo: config.cronjob?.ativo || false,
            intervaloMinutos: config.cronjob?.intervaloMinutos || null,
            ultimaExecucao: config.cronjob?.ultimaExecucao || null,
            proximaExecucao: config.cronjob?.proximaExecucao || null
          },
          ultimaSincronizacao: config.ultimaSincronizacao || null,
          ultimoEvento: ultimoEvento ? {
            processadoEm: ultimoEvento.processadoEm,
            origem: ultimoEvento.origem,
            sucesso: ultimoEvento.sucesso
          } : null,
          estatisticas: config.estatisticas || {
            totalWebhooks: 0,
            totalCronjobs: 0,
            totalManuais: 0,
            eventosPerdidos: 0
          },
          configuracaoCompleta: config.isConfigurationComplete()
        }
      });
    } catch (error) {
      console.error('❌ Erro ao obter status:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter status',
        message: error.message
      });
    }
  }

  /**
   * Inicia sincronização manual
   * POST /api/sincronizacao/manual
   * Body: { tenantId }
   */
  async sincronizarManual(req, res) {
    try {
      const tenantId = req.tenantId || req.body.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      const config = await ConfiguracaoSincronizacao.findOne({ tenantId });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Configuração não encontrada'
        });
      }

      if (!config.isConfigurationComplete()) {
        return res.status(400).json({
          success: false,
          error: 'Configuração incompleta',
          message: 'Configure todos os depósitos e contas Bling antes de sincronizar'
        });
      }

      // TODO: Chamar serviço de sincronização quando estiver disponível
      // Por enquanto, apenas atualiza estatísticas e última sincronização
      config.incrementarEstatistica('manual');
      config.ultimaSincronizacao = new Date();
      await config.save();

      return res.json({
        success: true,
        message: 'Sincronização manual iniciada',
        data: {
          tenantId,
          iniciadoEm: new Date()
        }
      });
    } catch (error) {
      console.error('❌ Erro ao sincronizar manualmente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao sincronizar manualmente',
        message: error.message
      });
    }
  }

  /**
   * Obtém histórico de sincronizações
   * GET /api/sincronizacao/historico?tenantId=xxx&limite=100&pagina=1&origem=webhook
   */
  async obterHistorico(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;
      const limite = parseInt(req.query.limite) || 100;
      const pagina = parseInt(req.query.pagina) || 1;
      const origem = req.query.origem; // webhook, cronjob, manual
      const dataInicio = req.query.dataInicio ? new Date(req.query.dataInicio) : null;
      const dataFim = req.query.dataFim ? new Date(req.query.dataFim) : null;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      // Se não forneceu datas, busca últimos 7 dias
      const dataInicioFinal = dataInicio || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const dataFimFinal = dataFim || new Date();

      const eventos = await EventoProcessado.buscarPorPeriodo(
        tenantId,
        dataInicioFinal,
        dataFimFinal,
        { limite, pagina, origem }
      );

      const total = await EventoProcessado.countDocuments({
        tenantId,
        processadoEm: {
          $gte: dataInicioFinal,
          $lte: dataFimFinal
        },
        ...(origem ? { origem } : {})
      });

      return res.json({
        success: true,
        data: {
          eventos,
          paginacao: {
            total,
            pagina,
            limite,
            totalPaginas: Math.ceil(total / limite)
          }
        }
      });
    } catch (error) {
      console.error('❌ Erro ao obter histórico:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter histórico',
        message: error.message
      });
    }
  }

  /**
   * Obtém logs de sincronização (eventos com erro)
   * GET /api/sincronizacao/logs?tenantId=xxx&limite=100&pagina=1
   */
  async obterLogs(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;
      const limite = parseInt(req.query.limite) || 100;
      const pagina = parseInt(req.query.pagina) || 1;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      const skip = (pagina - 1) * limite;

      // Buscar eventos com erro ou todos os eventos (para logs completos)
      const query = { tenantId };
      
      // Se quiser apenas erros, descomente:
      // query.sucesso = false;
      // query.erro = { $exists: true, $ne: null };

      const eventos = await EventoProcessado.find(query)
        .sort({ processadoEm: -1 })
        .skip(skip)
        .limit(limite);

      const total = await EventoProcessado.countDocuments(query);

      return res.json({
        success: true,
        data: {
          logs: eventos.map(evento => ({
            id: evento._id,
            processadoEm: evento.processadoEm,
            origem: evento.origem,
            produtoId: evento.produtoId,
            sucesso: evento.sucesso,
            erro: evento.erro,
            saldos: evento.saldos,
            compartilhadosAtualizados: evento.compartilhadosAtualizados
          })),
          paginacao: {
            total,
            pagina,
            limite,
            totalPaginas: Math.ceil(total / limite)
          }
        }
      });
    } catch (error) {
      console.error('❌ Erro ao obter logs:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter logs',
        message: error.message
      });
    }
  }

  /**
   * Atualiza configuração do webhook
   * PUT /api/sincronizacao/webhook
   * Body: { tenantId, url?, secret?, ativo? }
   */
  async atualizarWebhook(req, res) {
    try {
      const tenantId = req.tenantId || req.body.tenantId;
      const { url, secret, ativo } = req.body;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      const config = await ConfiguracaoSincronizacao.buscarOuCriar(tenantId);

      if (!config.webhook) {
        config.webhook = {
          url: null,
          secret: null,
          ativo: false,
          ultimaRequisicao: null
        };
      }

      if (url !== undefined) {
        config.webhook.url = url;
      }

      if (secret !== undefined) {
        config.webhook.secret = secret;
      }

      if (ativo !== undefined) {
        config.webhook.ativo = ativo;
      }

      await config.save();

      return res.json({
        success: true,
        data: {
          webhook: config.webhook
        },
        message: 'Configuração do webhook atualizada com sucesso'
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar webhook:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar webhook',
        message: error.message
      });
    }
  }

  /**
   * Atualiza configuração do cronjob
   * PUT /api/sincronizacao/cronjob
   * Body: { tenantId, ativo?, intervaloMinutos? }
   */
  async atualizarCronjob(req, res) {
    try {
      const tenantId = req.tenantId || req.body.tenantId;
      const { ativo, intervaloMinutos } = req.body;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      if (intervaloMinutos !== undefined && (intervaloMinutos < 1 || intervaloMinutos > 1440)) {
        return res.status(400).json({
          success: false,
          error: 'intervaloMinutos inválido',
          message: 'O intervalo deve estar entre 1 e 1440 minutos (24 horas)'
        });
      }

      const config = await ConfiguracaoSincronizacao.buscarOuCriar(tenantId);

      if (!config.cronjob) {
        config.cronjob = {
          ativo: false,
          intervaloMinutos: 30,
          ultimaExecucao: null,
          proximaExecucao: null
        };
      }

      if (ativo !== undefined) {
        config.cronjob.ativo = ativo;
      }

      if (intervaloMinutos !== undefined) {
        config.cronjob.intervaloMinutos = intervaloMinutos;
      }

      // Recalcular próxima execução se necessário
      if (config.cronjob.ativo && config.cronjob.intervaloMinutos) {
        config.cronjob.proximaExecucao = config.calcularProximaExecucao();
      }

      await config.save();

      return res.json({
        success: true,
        data: {
          cronjob: config.cronjob
        },
        message: 'Configuração do cronjob atualizada com sucesso'
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar cronjob:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar cronjob',
        message: error.message
      });
    }
  }
}

export default SincronizacaoController;


import { adicionarEventoNaFila } from '../services/queueService.js';
import ConfiguracaoSincronizacao from '../models/ConfiguracaoSincronizacao.js';
import Tenant from '../models/Tenant.js';
import { processarWebhookVenda } from '../utils/processarWebhookVenda.js';

/**
 * Controller para receber webhooks do Bling
 */
class WebhookController {
  /**
   * Busca tenantId a partir do blingAccountId
   * @param {string} blingAccountId - ID da conta Bling
   * @returns {Promise<string|null>} tenantId ou null se não encontrado
   */
  async buscarTenantPorBlingAccount(blingAccountId) {
    if (!blingAccountId) {
      return null;
    }

    try {
      const config = await ConfiguracaoSincronizacao.findOne({
        'contasBling.blingAccountId': blingAccountId,
        'contasBling.isActive': true,
      });

      return config?.tenantId || null;
    } catch (error) {
      console.error('[Webhook] ❌ Erro ao buscar tenant:', error);
      return null;
    }
  }

  async buscarNomeTenant(tenantId) {
    if (!tenantId) {
      return null;
    }

    try {
      const tenant = await Tenant.findById(tenantId).select('nome usuario').lean();
      if (!tenant) {
        return null;
      }
      return tenant.nome || tenant.usuario || null;
    } catch (error) {
      console.warn(`[Webhook] ⚠️ Erro ao buscar nome do tenant ${tenantId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Recebe webhook do Bling e adiciona evento na fila
   * POST /api/webhooks/bling?tenantId=xxx (opcional)
   * 
   * IMPORTANTE: Responde imediatamente (< 2 segundos) e processa em background
   */
  async receberWebhookBling(req, res) {
    const inicioProcessamento = Date.now();
    
    try {
      const timestampUTC = new Date();
      const timestampBrasil = timestampUTC.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      });
      const tenantIdInicial = req.body?.tenantId || req.query?.tenantId || null;

      // Log do recebimento
      console.log('[Webhook] 📥 Webhook recebido do Bling:', {
        timestampUTC: timestampUTC.toISOString(),
        timestampBrasil,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
        },
        bodyKeys: Object.keys(req.body || {}),
        query: req.query,
        tenantDetectado: tenantIdInicial,
      });
      
      // Validação básica do body
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[Webhook] ⚠️ Body inválido ou vazio');
        // Ainda assim responde 200 para não quebrar o webhook do Bling
        return res.status(200).json({
          received: true,
          warning: 'Body inválido ou vazio',
        });
      }

      // Tentar obter tenantId de várias formas
      let tenantId = tenantIdInicial;
      let blingAccountId = req.body.blingAccountId || req.body.accountId || req.body.contaBlingId || null;

      // Se não tem tenantId mas tem blingAccountId, buscar no banco
      if (!tenantId && blingAccountId) {
        tenantId = await this.buscarTenantPorBlingAccount(blingAccountId);
        if (tenantId) {
          console.log(`[Webhook] 🔍 TenantId identificado via blingAccountId: ${tenantId}`);
        }
      }

      let tenantNome = null;
      if (tenantId) {
        tenantNome = await this.buscarNomeTenant(tenantId);
        if (tenantNome) {
          console.log(`[Webhook] 🏷️ Tenant identificado: ${tenantNome} (${tenantId})`);
        }
      }

      // Processar webhook (suporta vendas e eventos de estoque)
      const eventos = processarWebhookVenda(req.body, tenantId, blingAccountId);

      if (!eventos || eventos.length === 0) {
        console.warn('[Webhook] ⚠️ Nenhum evento extraído do webhook');
        // Ainda assim responde 200
        return res.status(200).json({
          received: true,
          warning: 'Nenhum evento processável encontrado',
          bodyKeys: Object.keys(req.body || {}),
        });
      }

      console.log(`[Webhook] 📦 ${eventos.length} evento(s) extraído(s) do webhook`);

      // Responde IMEDIATAMENTE (< 2 segundos)
      const tempoResposta = Date.now() - inicioProcessamento;
      if (tempoResposta > 2000) {
        console.warn(`[Webhook] ⚠️ Resposta demorou ${tempoResposta}ms (deveria ser < 2000ms)`);
      }
      
      // Atualizar última requisição do webhook (se tenantId identificado)
      if (tenantId) {
        setImmediate(async () => {
          try {
            const config = await ConfiguracaoSincronizacao.findOne({ tenantId });
            if (config) {
              config.atualizarUltimaRequisicaoWebhook();
              await config.save();
            }
          } catch (error) {
            // Não falha se não conseguir atualizar
            console.warn('[Webhook] ⚠️ Erro ao atualizar última requisição:', error.message);
          }
        });
      }

      res.status(200).json({
        received: true,
        timestamp: new Date().toISOString(),
        eventosProcessados: eventos.length,
      });
      
      // Processamento assíncrono (não bloqueia a resposta)
      setImmediate(async () => {
        try {
          let eventosAdicionados = 0;
          let eventosIgnorados = 0;

          // Adicionar cada evento na fila
          for (const evento of eventos) {
            try {
              // Se não tem tenantId ainda, tentar buscar novamente
              if (!evento.tenantId && evento.blingAccountId) {
                evento.tenantId = await this.buscarTenantPorBlingAccount(evento.blingAccountId);
              }

              // Se ainda não tem tenantId, logar aviso mas processar mesmo assim
              if (!evento.tenantId) {
                console.warn(`[Webhook] ⚠️ Evento sem tenantId - Produto: ${evento.produtoId}`);
              }

              const jobId = evento.eventoId 
                ? `evento-${evento.produtoId}-${evento.eventoId}` 
                : `evento-${Date.now()}-${Math.random().toString(36).substring(7)}`;

              // Adicionar evento na fila (formato esperado pelo worker: { evento, tenantId })
              const resultado = await adicionarEventoNaFila('processar-evento', {
                evento: evento,
                tenantId: evento.tenantId,
              }, {
                jobId: jobId,
              });
              
              eventosAdicionados++;
              console.log('[Webhook] ✅ Evento adicionado na fila:', {
                produtoId: evento.produtoId,
                eventoId: evento.eventoId,
                depositoId: evento.depositoId,
                tenantId: evento.tenantId || 'não identificado',
                metodo: resultado.method,
                jobId: resultado.jobId,
              });
            } catch (errorEvento) {
              eventosIgnorados++;
              console.error('[Webhook] ❌ Erro ao adicionar evento individual:', errorEvento);
            }
          }

          console.log(`[Webhook] 📊 Resumo: ${eventosAdicionados} adicionados, ${eventosIgnorados} ignorados`);
        } catch (error) {
          // Tratamento gracioso: não quebra se fila estiver indisponível
          console.error('[Webhook] ❌ Erro ao adicionar eventos na fila:', error);
          console.error('[Webhook] ⚠️ Eventos serão perdidos, mas webhook foi aceito');
          
          // TODO: Em produção, considerar salvar em banco como fallback
          // ou enviar para dead letter queue
        }
      });
    } catch (error) {
      // Tratamento de erro: sempre responde 200 para não quebrar o webhook
      console.error('[Webhook] ❌ Erro ao processar webhook:', error);
      
      // Se ainda não respondeu, responde agora
      if (!res.headersSent) {
        res.status(200).json({
          received: true,
          error: 'Erro interno, mas webhook foi aceito',
        });
      }
    }
  }
  
  /**
   * Endpoint de teste para webhook
   * POST /api/webhooks/bling/test
   * 
   * Permite testar webhook manualmente
   */
  async testarWebhook(req, res) {
    try {
      console.log('[Webhook] 🧪 Teste de webhook recebido');
      
      // Validação da estrutura
      const body = req.body || {};
      const validacao = {
        produtoId: !!body.produtoId || !!body.idProduto || !!body.productId,
        eventoId: !!body.eventoId || !!body.idEvento || !!body.eventId,
        depositoId: !!body.depositoId || !!body.idDeposito || !!body.depositId,
      };
      
      const todosValidos = Object.values(validacao).every(v => v === true);
      
      if (!todosValidos) {
        return res.status(400).json({
          success: false,
          error: 'Estrutura inválida',
          validacao,
          exemplo: {
            produtoId: '123456',
            eventoId: 'event-123',
            depositoId: '14886873196',
            tenantId: 'tenant-123',
          },
        });
      }
      
      // Chama o mesmo método de recebimento
      await this.receberWebhookBling(req, res);
    } catch (error) {
      console.error('[Webhook] ❌ Erro no teste:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao testar webhook',
        message: error.message,
      });
    }
  }
}

export default WebhookController;

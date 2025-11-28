import { adicionarEventoNaFila } from '../services/queueService.js';

/**
 * Controller para receber webhooks do Bling
 */
class WebhookController {
  /**
   * Recebe webhook do Bling e adiciona evento na fila
   * POST /api/webhooks/bling
   * 
   * IMPORTANTE: Responde imediatamente (< 2 segundos) e processa em background
   */
  async receberWebhookBling(req, res) {
    const inicioProcessamento = Date.now();
    
    try {
      // Log do recebimento
      console.log('[Webhook] 📥 Webhook recebido do Bling:', {
        timestamp: new Date().toISOString(),
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
        },
        bodyKeys: Object.keys(req.body || {}),
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
      
      // Extrair dados do evento
      const evento = {
        produtoId: req.body.produtoId || req.body.idProduto || req.body.productId,
        eventoId: req.body.eventoId || req.body.idEvento || req.body.eventId,
        depositoId: req.body.depositoId || req.body.idDeposito || req.body.depositId,
        tenantId: req.body.tenantId || req.query.tenantId,
        blingAccountId: req.body.blingAccountId || req.body.accountId,
        tipo: req.body.tipo || req.body.type || 'estoque',
        dados: req.body.dados || req.body.data || req.body,
        recebidoEm: new Date().toISOString(),
        headers: {
          'user-agent': req.headers['user-agent'],
          'x-forwarded-for': req.headers['x-forwarded-for'],
        },
      };
      
      // Validação básica da estrutura
      if (!evento.produtoId && !evento.eventoId) {
        console.warn('[Webhook] ⚠️ Evento sem produtoId ou eventoId:', evento);
        // Ainda assim responde 200
        return res.status(200).json({
          received: true,
          warning: 'Evento sem identificadores obrigatórios',
        });
      }
      
      // Responde IMEDIATAMENTE (< 2 segundos)
      const tempoResposta = Date.now() - inicioProcessamento;
      if (tempoResposta > 2000) {
        console.warn(`[Webhook] ⚠️ Resposta demorou ${tempoResposta}ms (deveria ser < 2000ms)`);
      }
      
      res.status(200).json({
        received: true,
        timestamp: new Date().toISOString(),
      });
      
      // Processamento assíncrono (não bloqueia a resposta)
      setImmediate(async () => {
        try {
          // Adicionar evento na fila
          const resultado = await adicionarEventoNaFila('processar-evento', evento, {
            jobId: evento.eventoId 
              ? `evento-${evento.produtoId}-${evento.eventoId}` 
              : `evento-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          });
          
          console.log('[Webhook] ✅ Evento adicionado na fila:', {
            produtoId: evento.produtoId,
            eventoId: evento.eventoId,
            depositoId: evento.depositoId,
            metodo: resultado.method,
            jobId: resultado.jobId,
          });
        } catch (error) {
          // Tratamento gracioso: não quebra se fila estiver indisponível
          console.error('[Webhook] ❌ Erro ao adicionar evento na fila:', error);
          console.error('[Webhook] ⚠️ Evento será perdido, mas webhook foi aceito');
          
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



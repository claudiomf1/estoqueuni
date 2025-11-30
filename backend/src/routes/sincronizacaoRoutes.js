import { Router } from 'express';
import SincronizacaoController from '../controllers/sincronizacaoController.js';
import { validarTenantId } from '../middlewares/validarTenantId.js';

const router = Router();

/**
 * Rotas de sincronização de estoques
 * Base: /api/sincronizacao
 */

const controller = new SincronizacaoController();

// Aplicar middleware de validação de tenantId em todas as rotas
router.use(validarTenantId);

// ===== CONFIGURAÇÃO =====
router.get('/config', controller.obterConfiguracao.bind(controller));
router.post('/config', controller.salvarConfiguracao.bind(controller));

// ===== STATUS =====
router.get('/status', controller.obterStatus.bind(controller));

// ===== SINCRONIZAÇÃO =====
router.post('/manual', controller.sincronizarManual.bind(controller));

// ===== HISTÓRICO E LOGS =====
router.get('/historico', controller.obterHistorico.bind(controller));
router.get('/logs', controller.obterLogs.bind(controller));

// ===== WEBHOOK E CRONJOB =====
router.put('/webhook', controller.atualizarWebhook.bind(controller));
router.put('/webhook/marcar-conta-configurada', controller.marcarContaWebhookConfigurada.bind(controller));
router.put('/cronjob', controller.atualizarCronjob.bind(controller));

export default router;



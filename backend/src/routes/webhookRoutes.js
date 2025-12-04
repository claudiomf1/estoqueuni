import { Router } from 'express';
import WebhookController from '../controllers/webhookController.js';

const router = Router();

/**
 * Rotas de webhooks
 * Base: /api/webhooks
 */

const controller = new WebhookController();

// ===== WEBHOOKS DO BLING =====
router.get('/bling', controller.ping.bind(controller)); // ping/health
router.post('/bling', controller.receberWebhookBling.bind(controller));
router.post('/bling/test', controller.testarWebhook.bind(controller));

export default router;


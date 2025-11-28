import { Router } from 'express';
import BlingMultiAccountController from '../controllers/blingMultiAccountController.js';

const router = Router();

/**
 * Rotas de integração com Bling - Múltiplas Contas
 * Base: /api/bling
 */

const controller = new BlingMultiAccountController();

// ===== GERENCIAMENTO DE CONTAS =====
router.get('/contas', controller.listarContas.bind(controller));
router.get('/contas/:blingAccountId', controller.obterConta.bind(controller));
router.post('/contas', controller.adicionarConta.bind(controller));
router.patch('/contas/:blingAccountId', controller.atualizarConta.bind(controller));
router.delete('/contas/:blingAccountId', controller.removerConta.bind(controller));
router.patch('/contas/:blingAccountId/toggle', controller.toggleConta.bind(controller));

// ===== OAUTH =====
router.get('/auth/start', controller.iniciarAutorizacao.bind(controller));
router.get('/auth/callback', controller.callbackAutorizacao.bind(controller));

// ===== SINCRONIZAÇÃO DE ESTOQUE =====
// IMPORTANTE: Rotas específicas devem vir antes das rotas com parâmetros
router.post('/estoque/unificado', controller.sincronizarEstoqueUnificado.bind(controller));
router.post('/estoque/produto', controller.sincronizarEstoqueProdutoUnico.bind(controller));
// Rota com parâmetro :sku deve vir por último para evitar conflitos
router.get('/estoque/:sku', controller.buscarEstoqueUnificado.bind(controller));

export default router;


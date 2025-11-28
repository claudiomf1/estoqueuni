import express from 'express';
import blingRoutes from './blingRoutes.js';
import produtoRoutes from './produtoRoutes.js';
import sincronizacaoRoutes from './sincronizacaoRoutes.js';
import webhookRoutes from './webhookRoutes.js';
import tenantsRoutes from './tenantsRoutes.js';
import authRoutes from './authRoutes.js';

const router = express.Router();

// Rota de status
router.get('/status', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API funcionando',
    timestamp: new Date().toISOString()
  });
});

// Rotas de autenticação (públicas)
router.use('/auth', authRoutes);

// Registrar rotas
router.use('/bling', blingRoutes);
router.use('/produtos', produtoRoutes);
router.use('/sincronizacao', sincronizacaoRoutes);
router.use('/webhooks', webhookRoutes);

// Rotas de tenants / branding (versão 1 da API)
router.use('/v1/tenants', tenantsRoutes);

export default router;


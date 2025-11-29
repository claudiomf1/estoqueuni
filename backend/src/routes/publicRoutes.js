import express from 'express';
import LandingPageConfig from '../models/LandingPageConfig.js';

const router = express.Router();

/**
 * Rota pública para obter o logo da landing page
 * GET /api/public/landing-config/logo
 */
router.get('/landing-config/logo', async (req, res) => {
  try {
    // Busca qualquer documento que tenha logoUrl configurado
    // A landing page é pública e não depende de tenantId específico
    console.log('[publicRoutes] Buscando logo global da landing page...');

    const config = await LandingPageConfig.findOne({ 
      logoUrl: { $ne: null, $exists: true } 
    })
    .sort({ updatedAt: -1 }) // Pega o mais recente
    .lean();

    if (!config || !config.logoUrl) {
      console.log('[publicRoutes] Logo não configurado no banco de dados');
      return res.json({
        success: true,
        data: {
          logoUrl: null,
        },
      });
    }

    console.log('[publicRoutes] Logo encontrado:', config.logoUrl);
    return res.json({
      success: true,
      data: {
        logoUrl: config.logoUrl,
      },
    });
  } catch (error) {
    console.error('[publicRoutes] Erro ao obter logo:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao obter logo',
    });
  }
});

export default router;


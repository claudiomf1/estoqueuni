import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { checkOwner } from '../middlewares/checkOwner.js';
import {
  getLandingConfig,
  uploadLogo,
  deleteLogo,
  uploadBanner,
  deleteBanner,
  upload,
} from '../controllers/landingPageController.js';

const router = express.Router();

// Todas as rotas requerem autenticação e ser owner
router.use(authenticate);
router.use(checkOwner);

// Rotas de configuração da landing page
router.get('/landing-config', getLandingConfig);
router.post('/landing-config/logo', upload.single('logo'), uploadLogo);
router.delete('/landing-config/logo', deleteLogo);
router.post('/landing-config/banner', upload.single('banner'), uploadBanner);
router.delete('/landing-config/banner', deleteBanner);

export default router;


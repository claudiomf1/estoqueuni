import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { checkOwner } from '../middlewares/checkOwner.js';
import {
  getLandingConfig,
  uploadLogo,
  deleteLogo,
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

export default router;


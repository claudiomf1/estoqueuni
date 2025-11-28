import express from 'express';
import {
  loginHandler,
  logoutHandler,
  verifyTokenHandler,
} from '../controllers/authController.js';

const router = express.Router();

// Rotas de autenticação
router.post('/login', loginHandler);
router.post('/logout', logoutHandler);
router.get('/verificarToken', verifyTokenHandler);

export default router;


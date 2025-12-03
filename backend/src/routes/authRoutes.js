import express from 'express';
import {
  loginHandler,
  logoutHandler,
  verifyTokenHandler,
  cadastroHandler,
  getTokenHandler,
  verifyEmailHandler,
} from '../controllers/authController.js';

const router = express.Router();

// Rotas de autenticação
router.post('/login', loginHandler);
router.post('/cadastro', cadastroHandler);
router.post('/logout', logoutHandler);
router.get('/verificarToken', verifyTokenHandler);
router.get('/verify-email', verifyEmailHandler);

export default router;


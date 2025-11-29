// backend/src/routes/produtoRoutes.js
import { Router } from 'express';
import ProdutoController from '../controllers/produtoController.js';
import validarTenantId from '../middlewares/validarTenantId.js';

const router = Router();
const controller = new ProdutoController();

/**
 * Rotas de Produtos
 * Base: /api/produtos
 */

router.get('/', validarTenantId, controller.listarProdutos.bind(controller));
router.get('/verificacao', validarTenantId, controller.verificarProdutos.bind(controller));
router.post('/importar', validarTenantId, controller.importarProdutos.bind(controller));
router.get('/:sku', validarTenantId, controller.obterProduto.bind(controller));

export default router;









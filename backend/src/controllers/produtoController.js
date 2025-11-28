// backend/src/controllers/produtoController.js
import Produto from '../models/Produto.js';

class ProdutoController {
  async listarProdutos(req, res) {
    try {
      const { tenantId } = req.query;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      const produtos = await Produto.find({ tenantId })
        .sort({ updatedAt: -1 })
        .lean();

      // Converter Map para objeto se necessário
      const produtosFormatados = produtos.map(produto => {
        if (produto.estoquePorConta instanceof Map) {
          produto.estoquePorConta = Object.fromEntries(produto.estoquePorConta);
        }
        return produto;
      });

      return res.json({
        success: true,
        data: produtosFormatados
      });
    } catch (error) {
      console.error('Erro ao listar produtos:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao listar produtos'
      });
    }
  }

  async obterProduto(req, res) {
    try {
      const { tenantId } = req.query;
      const { sku } = req.params;

      if (!tenantId || !sku) {
        return res.status(400).json({
          success: false,
          error: 'tenantId e sku são obrigatórios'
        });
      }

      const produto = await Produto.findOne({ tenantId, sku }).lean();

      if (!produto) {
        return res.status(404).json({
          success: false,
          error: 'Produto não encontrado'
        });
      }

      // Converter Map para objeto se necessário
      if (produto.estoquePorConta instanceof Map) {
        produto.estoquePorConta = Object.fromEntries(produto.estoquePorConta);
      }

      return res.json({
        success: true,
        data: produto
      });
    } catch (error) {
      console.error('Erro ao obter produto:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao obter produto'
      });
    }
  }
}

export default ProdutoController;









import blingEstoqueUnificadoService from '../../services/blingEstoqueUnificadoService.js';

/**
 * Manipuladores para sincronização de estoque
 */
export const manipuladoresEstoque = {
  /**
   * Sincroniza estoque unificado
   */
  async sincronizarEstoqueUnificado(req, res) {
    try {
      const tenantId = req.tenantId || req.body.tenantId;
      const { limit, skip } = req.body;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      const resultado = await blingEstoqueUnificadoService.sincronizarEstoqueUnificado(
        tenantId,
        { limit, skip }
      );

      return res.json({
        success: resultado.success,
        data: resultado,
        message: resultado.message
      });
    } catch (error) {
      console.error('❌ Erro ao sincronizar estoque unificado:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao sincronizar estoque',
        message: error.message
      });
    }
  },

  /**
   * Sincroniza estoque de um produto específico
   */
  async sincronizarEstoqueProdutoUnico(req, res) {
    try {
      const tenantId = req.tenantId || req.body.tenantId;
      const { sku } = req.body;

      if (!tenantId || !sku) {
        return res.status(400).json({
          success: false,
          error: 'tenantId e sku são obrigatórios'
        });
      }

      const resultado = await blingEstoqueUnificadoService.sincronizarEstoqueProdutoUnico(
        tenantId,
        sku
      );

      return res.json({
        success: resultado.success,
        data: resultado.produto
      });
    } catch (error) {
      console.error('❌ Erro ao sincronizar estoque do produto:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao sincronizar estoque do produto',
        message: error.message
      });
    }
  },

  /**
   * Busca estoque unificado de um produto
   */
  async buscarEstoqueUnificado(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;
      const { sku } = req.params;

      if (!tenantId || !sku) {
        return res.status(400).json({
          success: false,
          error: 'tenantId e sku são obrigatórios'
        });
      }

      const resultado = await blingEstoqueUnificadoService.buscarEstoqueUnificado(
        tenantId,
        sku
      );

      return res.json({
        success: true,
        data: resultado
      });
    } catch (error) {
      console.error('❌ Erro ao buscar estoque unificado:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar estoque',
        message: error.message
      });
    }
  }
};


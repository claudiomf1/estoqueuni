import blingService from '../../services/blingService.js';

/**
 * Manipuladores para gerenciamento de depósitos Bling
 */
export const manipuladoresDepositos = {
  /**
   * Lista depósitos de uma conta Bling
   */
  async listarDepositos(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;
      const blingAccountId = req.query.blingAccountId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      if (!blingAccountId) {
        return res.status(400).json({
          success: false,
          error: 'blingAccountId é obrigatório'
        });
      }

      const depositos = await blingService.getDepositos(tenantId, blingAccountId);

      return res.json({
        success: true,
        data: depositos
      });
    } catch (error) {
      console.error('❌ Erro ao listar depósitos:', error);

      if (error.message === 'REAUTH_REQUIRED') {
        return res.status(401).json({
          success: false,
          error: 'Reautorização necessária',
          reauthUrl: error.reauthUrl,
          reason: error.reason
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao listar depósitos',
        message: error.message
      });
    }
  },

  /**
   * Cria um novo depósito no Bling
   */
  async criarDeposito(req, res) {
    try {
      const tenantId = req.tenantId || req.body.tenantId;
      const { blingAccountId, descricao, situacao, desconsiderarSaldo } = req.body;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      if (!blingAccountId) {
        return res.status(400).json({
          success: false,
          error: 'blingAccountId é obrigatório'
        });
      }

      if (!descricao || !descricao.trim()) {
        return res.status(400).json({
          success: false,
          error: 'descricao é obrigatória'
        });
      }

      const deposito = await blingService.criarDeposito(tenantId, blingAccountId, {
        descricao: descricao.trim(),
        situacao: situacao || 'A',
        desconsiderarSaldo: desconsiderarSaldo || false
      });

      return res.json({
        success: true,
        data: deposito,
        message: 'Depósito criado com sucesso'
      });
    } catch (error) {
      console.error('❌ Erro ao criar depósito:', error);

      if (error.message === 'REAUTH_REQUIRED') {
        return res.status(401).json({
          success: false,
          error: 'Reautorização necessária',
          reauthUrl: error.reauthUrl,
          reason: error.reason
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao criar depósito',
        message: error.message
      });
    }
  }
};


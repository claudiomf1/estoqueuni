import BlingConfig from '../../models/BlingConfig.js';
import blingService from '../../services/blingService.js';
import { getBrazilNow } from '../../utils/timezone.js';

/**
 * Manipuladores para autorização OAuth com Bling
 */
export const manipuladoresOAuth = {
  /**
   * Callback OAuth após autorização
   */
  async callbackAutorizacao(req, res) {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.status(400).json({
          success: false,
          error: 'code e state são obrigatórios'
        });
      }

      // Parse do state (contém tenantId e blingAccountId)
      let stateData;
      try {
        stateData = JSON.parse(state);
      } catch {
        stateData = { tenantId: state };
      }

      const { tenantId, blingAccountId } = stateData;

      if (!tenantId || !blingAccountId) {
        return res.status(400).json({
          success: false,
          error: 'state inválido: deve conter tenantId e blingAccountId'
        });
      }

      // Trocar code por tokens
      const tokens = await blingService.getTokensFromCode(
        code,
        tenantId,
        blingAccountId
      );

      console.log(`✅ Tokens obtidos para conta ${blingAccountId} do tenant ${tenantId}`);

      // Salvar tokens temporariamente
      await BlingConfig.findOneAndUpdate(
        { tenantId, blingAccountId },
        {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          expiry_date: tokens.expiry_date
        },
        { upsert: true }
      );

      // Buscar informações da loja Bling
      let storeInfo = null;
      try {
        storeInfo = await blingService.getStoreInfo(tenantId, blingAccountId);
        console.log(`🏪 Informações da loja obtidas: ${storeInfo?.nome || 'N/A'}`);
      } catch (err) {
        console.warn('⚠️ Não foi possível buscar informações da loja:', err.message);
      }

      // Buscar conta atual para verificar accountName
      const contaAtual = await BlingConfig.findOne({ tenantId, blingAccountId });
      const accountNameAtual = contaAtual?.accountName || 'Conta Bling';
      
      const novoAccountName = 
        (accountNameAtual === 'Conta Bling' && storeInfo?.nome) 
          ? storeInfo.nome 
          : accountNameAtual;

      // Atualizar conta com tokens e informações da loja
      const conta = await BlingConfig.findOneAndUpdate(
        { tenantId, blingAccountId },
        {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          expiry_date: tokens.expiry_date,
          store_id: storeInfo?.id || null,
          store_name: storeInfo?.nome || null,
          accountName: novoAccountName,
          is_active: true,
          last_sync: getBrazilNow(),
          last_error: null
        },
        { new: true }
      );

      if (!conta) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada'
        });
      }

      console.log(`✅ Configuração Bling salva para conta ${blingAccountId} do tenant ${tenantId}`);

      return res.json({
        success: true,
        data: {
          blingAccountId: conta.blingAccountId,
          accountName: conta.accountName,
          store_name: conta.store_name,
          message: 'Conta autorizada com sucesso'
        }
      });
    } catch (error) {
      console.error('❌ Erro no callback OAuth:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar autorização',
        message: error.message
      });
    }
  },

  /**
   * Inicia autorização OAuth para uma conta existente
   */
  async iniciarAutorizacao(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;
      const { blingAccountId } = req.query;

      if (!tenantId || !blingAccountId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId e blingAccountId são obrigatórios'
        });
      }

      // Verificar se conta existe
      const conta = await BlingConfig.findOne({ tenantId, blingAccountId });

      if (!conta) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada'
        });
      }

      const authUrl = await blingService.getAuthUrl(tenantId, blingAccountId);

      return res.json({
        success: true,
        authUrl,
        data: {
          authUrl,
          blingAccountId
        }
      });
    } catch (error) {
      console.error('❌ Erro ao iniciar autorização:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao iniciar autorização',
        message: error.message
      });
    }
  }
};

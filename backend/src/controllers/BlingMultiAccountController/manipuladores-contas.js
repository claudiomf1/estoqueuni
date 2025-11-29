import BlingConfig from '../../models/BlingConfig.js';
import ConfiguracaoSincronizacao from '../../models/ConfiguracaoSincronizacao.js';
import blingService from '../../services/blingService.js';

/**
 * Manipuladores para gerenciamento de contas Bling
 */
export const manipuladoresContas = {
  /**
   * Lista todas as contas Bling do tenant
   */
  async listarContas(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      const contas = await BlingConfig.find({ tenantId }).sort({
        createdAt: -1
      });

      return res.json({
        success: true,
        contas: contas.map((conta) => {
          const temTokens = !!(conta.access_token && conta.expiry_date);
          const tokenExpired =
            temTokens && conta.isTokenExpired ? conta.isTokenExpired() : false;

          return {
            _id: conta._id || conta.blingAccountId,
            id: conta.blingAccountId,
            blingAccountId: conta.blingAccountId,
            accountName: conta.accountName,
            storeName: conta.store_name,
            storeId: conta.store_id,
            isActive: conta.is_active,
            lastSync: conta.last_sync,
            lastError: conta.last_error,
            hasTokens: temTokens,
            tokenExpired,
            createdAt: conta.createdAt,
            updatedAt: conta.updatedAt,
            isConfigurationComplete: conta.isConfigurationComplete
              ? conta.isConfigurationComplete()
              : false
          };
        })
      });
    } catch (error) {
      console.error('❌ Erro ao listar contas:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar contas',
        message: error.message
      });
    }
  },

  /**
   * Obtém detalhes de uma conta específica
   */
  async obterConta(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;
      const { blingAccountId } = req.params;

      if (!tenantId || !blingAccountId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId e blingAccountId são obrigatórios'
        });
      }

      const conta = await BlingConfig.findOne({ tenantId, blingAccountId });

      if (!conta) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada'
        });
      }

      return res.json({
        success: true,
        data: {
          blingAccountId: conta.blingAccountId,
          accountName: conta.accountName,
          store_id: conta.store_id,
          store_name: conta.store_name,
          bling_client_id: conta.bling_client_id || null,
          bling_client_secret: conta.bling_client_secret || null,
          bling_redirect_uri: conta.bling_redirect_uri || null,
          is_active: conta.is_active,
          last_sync: conta.last_sync,
          last_error: conta.last_error,
          isTokenExpired: conta.isTokenExpired(),
          isConfigurationComplete: conta.isConfigurationComplete(),
          needsReauthorization: conta.needsReauthorization(),
          createdAt: conta.createdAt,
          updatedAt: conta.updatedAt
        }
      });
    } catch (error) {
      console.error('❌ Erro ao obter conta:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter conta',
        message: error.message
      });
    }
  },

  /**
   * Inicia processo de adicionar nova conta (retorna authUrl)
   */
  async adicionarConta(req, res) {
    try {
      const tenantId = req.tenantId || req.body.tenantId;
      const { accountName, bling_client_id, bling_client_secret, bling_redirect_uri } = req.body;
      let redirectNormalizado;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      if (bling_redirect_uri !== undefined) {
        redirectNormalizado = blingService.normalizarRedirectUri(bling_redirect_uri);
        if (!redirectNormalizado) {
          return res.status(400).json({
            success: false,
            error:
              'Redirect URI inválido. Use https://estoqueuni.com.br/bling/callback (sem www) ou deixe vazio para aplicar o padrão.',
            redirectPadrao: blingService.obterRedirectPadrao()
          });
        }
      }

      // Gerar blingAccountId único
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 11);
      const blingAccountId = `bling_${timestamp}_${randomStr}`;

      // Criar registro da conta (ainda sem tokens)
      const novaConta = new BlingConfig({
        tenantId,
        blingAccountId,
        accountName: accountName || 'Conta Bling',
        is_active: false,
        bling_client_id: bling_client_id || undefined,
        bling_client_secret: bling_client_secret || undefined,
        bling_redirect_uri: redirectNormalizado || undefined
      });

      await novaConta.save();

      // Gerar URL de autorização (usando credenciais específicas se houver)
      const authUrl = await blingService.getAuthUrl(tenantId, blingAccountId);

      return res.json({
        success: true,
        authUrl,
        data: {
          blingAccountId,
          authUrl,
          message: 'Use a URL de autorização para completar a configuração'
        }
      });
    } catch (error) {
      console.error('❌ Erro ao adicionar conta:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao adicionar conta',
        message: error.message
      });
    }
  },

  /**
   * Remove uma conta Bling
   */
  async removerConta(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;
      const { blingAccountId } = req.params;

      if (!tenantId || !blingAccountId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId e blingAccountId são obrigatórios'
        });
      }

      // Verificar se a conta existe
      const conta = await BlingConfig.findOne({ tenantId, blingAccountId });

      if (!conta) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada'
        });
      }

      // Remover referências na ConfiguracaoSincronizacao
      try {
        const config = await ConfiguracaoSincronizacao.findOne({ tenantId });
        if (config && Array.isArray(config.contasBling)) {
          config.contasBling = config.contasBling.filter(
            conta => conta.blingAccountId !== blingAccountId
          );

          if (Array.isArray(config.depositos)) {
            config.depositos = config.depositos.filter(
              deposito => deposito.contaBlingId !== blingAccountId
            );
          }

          if (config.contasBling.length === 0) {
            config.ativo = false;
            if (config.regraSincronizacao) {
              config.regraSincronizacao.depositosPrincipais = [];
              config.regraSincronizacao.depositosCompartilhados = [];
            }
          }

          await config.save();
          console.log(`✅ Referências da conta ${blingAccountId} removidas da ConfiguracaoSincronizacao`);
        }
      } catch (configError) {
        console.warn(`⚠️ Erro ao remover referências na ConfiguracaoSincronizacao: ${configError.message}`);
      }

      // Remover a conta
      await BlingConfig.findOneAndDelete({ tenantId, blingAccountId });

      return res.json({
        success: true,
        message: 'Conta removida com sucesso'
      });
    } catch (error) {
      console.error('❌ Erro ao remover conta:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao remover conta',
        message: error.message
      });
    }
  },

  /**
   * Atualiza nome ou status da conta
   */
  async atualizarConta(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;
      const { blingAccountId } = req.params;
      const { accountName, store_name, bling_client_id, bling_client_secret, bling_redirect_uri } =
        req.body;

      if (!tenantId || !blingAccountId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId e blingAccountId são obrigatórios'
        });
      }

      const updateData = {};
      if (accountName !== undefined) updateData.accountName = accountName;
      if (store_name !== undefined) updateData.store_name = store_name;
      if (bling_client_id !== undefined) updateData.bling_client_id = bling_client_id;
      if (bling_client_secret !== undefined) updateData.bling_client_secret = bling_client_secret;
      if (bling_redirect_uri !== undefined) {
        const redirectNormalizado = blingService.normalizarRedirectUri(bling_redirect_uri);
        if (!redirectNormalizado) {
          return res.status(400).json({
            success: false,
            error:
              'Redirect URI inválido. Utilize exatamente https://estoqueuni.com.br/bling/callback (sem www) ou deixe vazio para usar o padrão.',
            redirectPadrao: blingService.obterRedirectPadrao()
          });
        }
        updateData.bling_redirect_uri = redirectNormalizado;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum campo para atualizar'
        });
      }

      const conta = await BlingConfig.findOneAndUpdate(
        { tenantId, blingAccountId },
        { $set: updateData },
        { new: true }
      );

      if (!conta) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada'
        });
      }

      return res.json({
        success: true,
        data: {
          blingAccountId: conta.blingAccountId,
          accountName: conta.accountName,
          store_name: conta.store_name
        }
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar conta:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar conta',
        message: error.message
      });
    }
  },

  /**
   * Ativa/desativa uma conta
   */
  async toggleConta(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;
      const { blingAccountId } = req.params;

      if (!tenantId || !blingAccountId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId e blingAccountId são obrigatórios'
        });
      }

      const conta = await BlingConfig.findOne({ tenantId, blingAccountId });

      if (!conta) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada'
        });
      }

      conta.is_active = !conta.is_active;
      await conta.save();

      return res.json({
        success: true,
        data: {
          blingAccountId: conta.blingAccountId,
          is_active: conta.is_active,
          message: conta.is_active
            ? 'Conta ativada com sucesso'
            : 'Conta desativada com sucesso'
        }
      });
    } catch (error) {
      console.error('❌ Erro ao alternar status da conta:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao alternar status da conta',
        message: error.message
      });
    }
  }
};


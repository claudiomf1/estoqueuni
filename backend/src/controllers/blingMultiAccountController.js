import BlingConfig from '../models/BlingConfig.js';
import ConfiguracaoSincronizacao from '../models/ConfiguracaoSincronizacao.js';
import blingService from '../services/blingService.js';
import blingEstoqueUnificadoService from '../services/blingEstoqueUnificadoService.js';

/**
 * Controller para gerenciar múltiplas contas Bling por tenant
 */
class BlingMultiAccountController {
  /**
   * Lista todas as contas Bling do tenant
   * GET /api/bling/contas?tenantId=xxx
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
  }

  /**
   * Obtém detalhes de uma conta específica
   * GET /api/bling/contas/:blingAccountId?tenantId=xxx
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
  }

  /**
   * Inicia processo de adicionar nova conta (retorna authUrl)
   * POST /api/bling/contas
   * Body: { tenantId, accountName }
   */
  async adicionarConta(req, res) {
    try {
      const tenantId = req.tenantId || req.body.tenantId;
      const { accountName, bling_client_id, bling_client_secret, bling_redirect_uri } = req.body;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
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
        bling_redirect_uri: bling_redirect_uri || undefined
      });

      await novaConta.save();

      // Gerar URL de autorização (usando credenciais específicas se houver)
      const authUrl = await blingService.getAuthUrl(tenantId, blingAccountId);

      return res.json({
        success: true,
        authUrl, // Retorna authUrl no nível superior para facilitar acesso no frontend
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
  }

  /**
   * Callback OAuth após autorização
   * GET /api/bling/auth/callback?code=xxx&state=xxx
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
        // Fallback: se state não for JSON, assume que é apenas tenantId
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

      // Salvar tokens temporariamente para poder fazer requisições
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

      // Buscar conta atual para verificar se accountName precisa ser preenchido
      const contaAtual = await BlingConfig.findOne({ tenantId, blingAccountId });
      const accountNameAtual = contaAtual?.accountName || 'Conta Bling';
      
      // Se accountName for o padrão e tivermos store_name, usar store_name como accountName
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
          last_sync: new Date(),
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

      // Redirecionar para página de sucesso (ou retornar JSON)
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
  }

  /**
   * Inicia autorização OAuth para uma conta existente
   * GET /api/bling/auth/start?tenantId=xxx&blingAccountId=xxx
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
        authUrl, // Retorna authUrl no nível superior para facilitar acesso no frontend
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

  /**
   * Remove uma conta Bling
   * DELETE /api/bling/contas/:blingAccountId?tenantId=xxx
   * Remove também referências na ConfiguracaoSincronizacao
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

      // Remover referências na ConfiguracaoSincronizacao (genérico)
      try {
        const config = await ConfiguracaoSincronizacao.findOne({ tenantId });
        if (config && Array.isArray(config.contasBling)) {
          // Remover a conta do array contasBling
          config.contasBling = config.contasBling.filter(
            conta => conta.blingAccountId !== blingAccountId
          );

          // Remover depósitos que referenciam esta conta
          if (Array.isArray(config.depositos)) {
            config.depositos = config.depositos.filter(
              deposito => deposito.contaBlingId !== blingAccountId
            );
          }

          // Limpar regra de sincronização se não houver contas restantes
          if (config.contasBling.length === 0) {
            config.ativo = false; // Desativa sincronização se não houver contas
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
        // Continua mesmo se der erro ao limpar referências
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
  }

  /**
   * Atualiza nome ou status da conta
   * PATCH /api/bling/contas/:blingAccountId?tenantId=xxx
   * Body: { accountName?, store_name? }
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
      if (bling_redirect_uri !== undefined) updateData.bling_redirect_uri = bling_redirect_uri;

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
  }

  /**
   * Ativa/desativa uma conta
   * PATCH /api/bling/contas/:blingAccountId/toggle?tenantId=xxx
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

  /**
   * Sincroniza estoque unificado
   * POST /api/bling/estoque/unificado
   * Body: { tenantId, limit?, skip? }
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
  }

  /**
   * Sincroniza estoque de um produto específico
   * POST /api/bling/estoque/produto
   * Body: { tenantId, sku }
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
  }

  /**
   * Busca estoque unificado de um produto
   * GET /api/bling/estoque/:sku?tenantId=xxx
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
}

export default BlingMultiAccountController;

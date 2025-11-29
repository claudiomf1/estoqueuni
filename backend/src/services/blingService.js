import axios from 'axios';
import BlingConfig from '../models/BlingConfig.js';

/**
 * Serviço para integração com Bling API v3
 * Suporta múltiplas contas Bling por tenant
 */
class BlingService {
  constructor() {
    this.clientId = process.env.BLING_CLIENT_ID;
    this.clientSecret = process.env.BLING_CLIENT_SECRET;
    this.redirectUri = this.resolverRedirectPadrao();
    this.apiUrl = 'https://www.bling.com.br/Api/v3';
  }

  /**
   * Resolve o redirect padrão considerando variáveis de ambiente e fallbacks
   * @returns {string}
   */
  resolverRedirectPadrao() {
    const candidatos = [
      process.env.BLING_REDIRECT_URI,
      this.construirRedirectComBase(process.env.CORS_ORIGIN),
      this.construirRedirectComBase(process.env.PUBLIC_URL),
    ];

    for (const candidato of candidatos) {
      const normalizado = this.normalizarRedirectUri(candidato);
      if (normalizado) return normalizado;
    }

    // Fallbacks finais caso nada esteja configurado
    if (process.env.NODE_ENV === 'production') {
      return 'https://estoqueuni.com.br/bling/callback';
    }
    return 'http://localhost:5174/bling/callback';
  }

  /**
   * Constrói redirect padrão a partir de uma origem (ex.: CORS_ORIGIN)
   * @param {string|undefined} base
   * @returns {string|null}
   */
  construirRedirectComBase(base) {
    if (!base || typeof base !== 'string') return null;
    const limpo = base.trim();
    if (!limpo) return null;
    return `${limpo.replace(/\/$/, '')}/bling/callback`;
  }

  /**
   * Normaliza redirect URIs para evitar divergências (www, barras extras, etc.)
   * @param {string|undefined} uri
   * @returns {string|null}
   */
  normalizarRedirectUri(uri) {
    if (!uri || typeof uri !== 'string') return null;
    const valor = uri.trim();
    if (!valor) return null;

    try {
      const possuiProtocolo = /^[a-zA-Z]+:\/\//.test(valor);
      const valorComProtocolo = possuiProtocolo ? valor : `https://${valor.replace(/^\/+/, '')}`;
      const urlObj = new URL(valorComProtocolo);

      if (urlObj.hostname === 'www.estoqueuni.com.br') {
        urlObj.hostname = 'estoqueuni.com.br';
      }

      if (urlObj.hostname === 'estoqueuni.com.br') {
        urlObj.protocol = 'https:';
        urlObj.pathname = '/bling/callback';
      }

      if (urlObj.pathname.endsWith('/bling/callback/')) {
        urlObj.pathname = '/bling/callback';
      }

      urlObj.search = '';
      urlObj.hash = '';

      return urlObj.toString().replace(/\/$/, '');
    } catch (error) {
      console.warn(
        `[BLING-SERVICE] Redirect URI inválido recebido (${valor}):`,
        error.message
      );
      return null;
    }
  }

  obterRedirectPadrao() {
    return this.redirectUri;
  }

  // ===== OAUTH METHODS =====

  /**
   * Obtém credenciais (clientId, clientSecret, redirectUri) para uma conta específica,
   * caindo para as credenciais globais se não houver configuração própria.
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @returns {Promise<{clientId: string, clientSecret: string, redirectUri: string}>}
   */
  async obterCredenciais(tenantId, blingAccountId) {
    let redirectPersonalizado = null;

    if (tenantId && blingAccountId) {
      try {
        const config = await BlingConfig.findOne({ tenantId, blingAccountId }).lean();
        if (config) {
          redirectPersonalizado = this.normalizarRedirectUri(config.bling_redirect_uri);
        }

        if (config && config.bling_client_id && config.bling_client_secret) {
          return {
            clientId: config.bling_client_id,
            clientSecret: config.bling_client_secret,
            redirectUri: redirectPersonalizado || this.redirectUri,
          };
        }
      } catch (error) {
        console.warn(
          '[BLING-SERVICE] ⚠️ Erro ao buscar credenciais específicas da conta:',
          error.message
        );
      }
    }

    // Fallback: usa credenciais globais
    return {
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri: redirectPersonalizado || this.redirectUri,
    };
  }

  /**
   * Gera URL de autorização OAuth 2.0
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @returns {Promise<string>} URL de autorização
   */
  async getAuthUrl(tenantId, blingAccountId) {
    const { clientId, redirectUri } = await this.obterCredenciais(tenantId, blingAccountId);

    const state = JSON.stringify({ tenantId, blingAccountId });
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'produtos categorias produtos.lojas',
      state: state
    });

    return `${this.apiUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Troca código de autorização por tokens
   * @param {string} code
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @returns {Promise<Object>}
   */
  async getTokensFromCode(code, tenantId, blingAccountId) {
    const { clientId, clientSecret, redirectUri } = await this.obterCredenciais(
      tenantId,
      blingAccountId
    );

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const response = await axios.post(
        `${this.apiUrl}/oauth/token`,
        {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri
        },
        {
          headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;

      return {
        access_token,
        refresh_token,
        expires_in,
        expiry_date: Date.now() + expires_in * 1000
      };
    } catch (error) {
      console.error(
        '❌ Erro ao trocar code por tokens (Bling):',
        error.response?.data || error.message
      );
      throw new Error('Falha ao obter tokens do Bling');
    }
  }

  /**
   * Renova o access_token usando refresh_token
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @returns {Promise<Object>} Novos tokens
   */
  async refreshAccessToken(tenantId, blingAccountId) {
    const config = await BlingConfig.findOne({ tenantId, blingAccountId });

    if (!config || !config.refresh_token) {
      throw new Error(
        `Conta ${blingAccountId} do tenant ${tenantId} não tem refresh_token do Bling`
      );
    }

    const { clientId, clientSecret, redirectUri } = await this.obterCredenciais(
      tenantId,
      blingAccountId
    );

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const response = await axios.post(
        `${this.apiUrl}/oauth/token`,
        {
          grant_type: 'refresh_token',
          refresh_token: config.refresh_token,
          redirect_uri: redirectUri
        },
        {
          headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;

      return {
        access_token,
        refresh_token,
        expires_in,
        expiry_date: Date.now() + expires_in * 1000
      };
    } catch (error) {
      const data = error.response?.data;
      const status = error.response?.status;
      const errorType = data?.error?.type || data?.error;
      const reason =
        data?.error?.description ||
        data?.error_description ||
        data?.error?.message ||
        data?.message ||
        error.message;

      const shouldForceReauth =
        errorType === 'invalid_grant' ||
        errorType === 'FORBIDDEN' ||
        status === 401 ||
        status === 403;

      if (shouldForceReauth) {
        await BlingConfig.findOneAndUpdate(
          { tenantId, blingAccountId },
          {
            is_active: false,
            last_error: `${errorType || status} - ${reason}`
          }
        ).catch(() => {});

        const authUrl = await this.getAuthUrl(tenantId, blingAccountId);
        const err = new Error('REAUTH_REQUIRED');
        err.reauthUrl = authUrl;
        err.reason = reason;
        err.status = status;
        err.errorType = errorType;
        throw err;
      }

      console.error('❌ Erro ao renovar token Bling:', data || error.message);
      const genericError = new Error('Falha ao renovar token');
      genericError.reason = reason;
      genericError.status = status;
      throw genericError;
    }
  }

  /**
   * Configura autenticação para uma conta específica (verifica expiração e renova se necessário)
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @returns {Promise<string>} access_token válido
   */
  async setAuthForBlingAccount(tenantId, blingAccountId) {
    const config = await BlingConfig.findOne({ tenantId, blingAccountId });

    if (!config || !config.access_token) {
      throw new Error(
        `Conta ${blingAccountId} do tenant ${tenantId} não está autorizada no Bling`
      );
    }

    // Se não expirou, retorna o token atual
    if (!config.isTokenExpired()) {
      return config.access_token;
    }

    // Token expirou, renova
    console.log(
      `🔄 Renovando token Bling para conta ${blingAccountId} do tenant ${tenantId}`
    );
    const newTokens = await this.refreshAccessToken(tenantId, blingAccountId);

    // Atualiza no banco
    await BlingConfig.findOneAndUpdate(
      { tenantId, blingAccountId },
      {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_in: newTokens.expires_in,
        expiry_date: newTokens.expiry_date,
        is_active: true,
        last_error: null
      },
      { new: true }
    );

    return newTokens.access_token;
  }

  // ===== API METHODS =====

  /**
   * Busca produto por SKU
   * @param {string} sku
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @returns {Promise<Object|null>}
   */
  async getProdutoPorSku(sku, tenantId, blingAccountId) {
    const accessToken = await this.setAuthForBlingAccount(tenantId, blingAccountId);

    try {
      const response = await axios.get(`${this.apiUrl}/produtos`, {
        params: {
          codigo: sku,
          campos: 'codigo,estoque,nome'
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const produtos = response.data?.data || [];
      return produtos.length > 0 ? produtos[0] : null;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(
        `❌ Erro ao buscar produto por SKU ${sku}:`,
        error.response?.data || error.message
      );
      throw new Error('Falha ao buscar produto no Bling');
    }
  }

  /**
   * Busca estoque de um produto por SKU
   * @param {string} sku
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @returns {Promise<number>} Quantidade em estoque
   */
  async getEstoqueProduto(sku, tenantId, blingAccountId) {
    try {
      const produto = await this.getProdutoPorSku(sku, tenantId, blingAccountId);
      if (!produto) {
        return 0;
      }
      return produto.estoque?.saldoVirtualTotal || 0;
    } catch (error) {
      console.error(
        `❌ Erro ao buscar estoque do produto ${sku}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Lista produtos com filtros
   * @param {Object} params - Filtros (limite, pagina, codigos, etc)
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @returns {Promise<Array>}
   */
  async getProdutos(params = {}, tenantId, blingAccountId) {
    const accessToken = await this.setAuthForBlingAccount(tenantId, blingAccountId);

    try {
      const queryParams = new URLSearchParams({
        limite: params.limit || 100,
        pagina: params.page || 1,
        ...params.filters
      });

      // Se codigos for array, adicionar como múltiplos parâmetros
      if (params.codigos && Array.isArray(params.codigos)) {
        params.codigos.forEach((codigo) => {
          queryParams.append('codigos[]', codigo);
        });
      }

      const response = await axios.get(
        `${this.apiUrl}/produtos?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data?.data || [];
    } catch (error) {
      console.error(
        '❌ Erro ao buscar produtos do Bling:',
        error.response?.data || error.message
      );
      throw new Error('Falha ao buscar produtos');
    }
  }

  /**
   * Busca lojas do Bling
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @returns {Promise<Array>}
   */
  async getStores(tenantId, blingAccountId) {
    const accessToken = await this.setAuthForBlingAccount(tenantId, blingAccountId);

    try {
      const response = await axios.get(`${this.apiUrl}/lojas`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data?.data || [];
    } catch (error) {
      const data = error.response?.data;
      const status = error.response?.status;
      const reason =
        data?.error?.description ||
        data?.error?.message ||
        data?.message ||
        error.message;

      // Se o Bling indicar problema de autorização, força reautorização
      if (data?.error?.type === 'invalid_grant' || status === 401) {
        await BlingConfig.findOneAndUpdate(
          { tenantId, blingAccountId },
          {
            is_active: false,
            last_error:
              'invalid_grant/401 ao buscar lojas - Requer re-autorização'
          }
        ).catch(() => {});

        const authUrl = await this.getAuthUrl(tenantId, blingAccountId);
        const err = new Error('REAUTH_REQUIRED');
        err.reauthUrl = authUrl;
        err.reason = reason;
        throw err;
      }

      console.error(
        '❌ Erro ao buscar lojas do Bling:',
        data || error.message
      );
      throw new Error('Falha ao buscar lojas');
    }
  }

  /**
   * Busca informações da primeira loja do Bling
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @returns {Promise<Object|null>}
   */
  async getStoreInfo(tenantId, blingAccountId) {
    try {
      const stores = await this.getStores(tenantId, blingAccountId);
      return stores?.[0] || null;
    } catch (error) {
      console.error(
        '❌ Erro ao buscar info da loja:',
        error?.response?.data || error?.message
      );
      return null;
    }
  }
}

export default new BlingService();

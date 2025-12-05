import axios from 'axios';
import BlingConfig from '../models/BlingConfig.js';
import ReservaEstoqueCache from '../models/ReservaEstoqueCache.js';

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
    this._rateLimiter = Promise.resolve();
    this._lastRequestTimestamp = 0; 
    this._minRequestIntervalMs =
      Number(process.env.BLING_MIN_REQUEST_INTERVAL_MS) || 700;
    this._reservaCacheTtlMs = 7 * 24 * 60 * 60 * 1000; // 7 dias (deslizante)
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

    // Se a conta está marcada como inativa mas já possui tokens, reativa automaticamente
    if (config.is_active === false || config.isActive === false) {
      await BlingConfig.findOneAndUpdate(
        { tenantId, blingAccountId },
        { is_active: true, isActive: true, last_error: null }
      ).catch(() => {});
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

  async _waitForRateLimit() {
    const job = this._rateLimiter.then(async () => {
      const agora = Date.now();
      const intervalo = Math.max(
        0,
        this._minRequestIntervalMs - (agora - this._lastRequestTimestamp)
      );

      if (intervalo > 0) {
        await new Promise((resolve) => setTimeout(resolve, intervalo));
      }

      this._lastRequestTimestamp = Date.now();
    });

    this._rateLimiter = job;
    await job;
  }

  // ===== API METHODS =====

  /**
   * Busca produto por SKU
   * @param {string} sku
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @returns {Promise<Object|null>}
   */
  /**
   * Busca produto por SKU no Bling
   * @param {string} sku - SKU do produto
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @param {boolean} incluirDetalhes - Se true, busca campos adicionais como formato, tipo, etc.
   * @returns {Promise<Object|null>} Produto encontrado ou null
   */
  async getProdutoPorSku(sku, tenantId, blingAccountId, incluirDetalhes = false) {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const tentar = async (tentativa = 1) => {
      const accessToken = await this.setAuthForBlingAccount(tenantId, blingAccountId);

      try {
        await this._waitForRateLimit();
        // Campos básicos sempre incluídos
        let campos = 'codigo,estoque,nome,id,depositos';
        
        // Se precisar de detalhes, incluir formato e tipo para detectar produtos compostos
        if (incluirDetalhes) {
          campos += ',formato,tipo,situacao';
        }

        const response = await axios.get(`${this.apiUrl}/produtos`, {
          params: {
            codigo: sku,
            campos: campos
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        const produtos = response.data?.data || [];
        return produtos.length > 0 ? produtos[0] : null;
      } catch (error) {
        const tipoErro = error.response?.data?.error?.type || error.response?.data?.error;
        if (tipoErro === 'invalid_token') {
          await BlingConfig.findOneAndUpdate(
            { tenantId, blingAccountId },
            {
              is_active: false,
              isActive: false,
              access_token: null,
              refresh_token: null,
              expiry_date: null,
              last_error: 'invalid_token'
            }
          ).catch(() => {});
          const err = new Error('INVALID_TOKEN');
          err.code = 'INVALID_TOKEN';
          throw err;
        }
        if (error.response?.status === 404) {
          return null;
        }
        if (error.response?.status === 429 && tentativa < 3) {
          const retryAfter =
            Number(error.response.headers?.['retry-after']) * 1000 || 500;
          console.warn(
            `[BLING-SERVICE] ⚠️ Rate limit ao buscar SKU ${sku} (tentativa ${tentativa}). Retentando em ${retryAfter}ms.`
          );
          await sleep(retryAfter);
          return tentar(tentativa + 1);
        }
        console.error(
          `❌ Erro ao buscar produto por SKU ${sku}:`,
          error.response?.data || error.message
        );
        throw new Error('Falha ao buscar produto no Bling');
      }
    };

    return tentar(1);
  }

  /**
   * Busca produto pelo ID interno do Bling
   * @param {string|number} idProduto
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @param {boolean} incluirDetalhes
   * @returns {Promise<Object|null>}
   */
  async getProdutoPorId(idProduto, tenantId, blingAccountId, incluirDetalhes = false) {
    if (!idProduto) return null;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const tentar = async (tentativa = 1) => {
      const accessToken = await this.setAuthForBlingAccount(tenantId, blingAccountId);

      try {
        await this._waitForRateLimit();
        let campos = 'codigo,estoque,nome,id,depositos';
        if (incluirDetalhes) {
          campos += ',formato,tipo,situacao';
        }

        const response = await axios.get(`${this.apiUrl}/produtos/${idProduto}`, {
          params: { campos },
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        return response.data?.data || null;
      } catch (error) {
        const tipoErro = error.response?.data?.error?.type || error.response?.data?.error;
        if (tipoErro === 'invalid_token') {
          await BlingConfig.findOneAndUpdate(
            { tenantId, blingAccountId },
            {
              is_active: false,
              isActive: false,
              access_token: null,
              refresh_token: null,
              expiry_date: null,
              last_error: 'invalid_token'
            }
          ).catch(() => {});
          const err = new Error('INVALID_TOKEN');
          err.code = 'INVALID_TOKEN';
          throw err;
        }
        if (error.response?.status === 404) {
          return null;
        }
        if (error.response?.status === 429 && tentativa < 3) {
          const retryAfter =
            Number(error.response.headers?.['retry-after']) * 1000 || 500;
          console.warn(
            `[BLING-SERVICE] ⚠️ Rate limit ao buscar produtoId ${idProduto} (tentativa ${tentativa}). Retentando em ${retryAfter}ms.`
          );
          await sleep(retryAfter);
          return tentar(tentativa + 1);
        }
        console.error(
          `❌ Erro ao buscar produto por ID ${idProduto}:`,
          error.response?.data || error.message
        );
        throw new Error('Falha ao buscar produto no Bling');
      }
    };

    return tentar(1);
  }

  /**
   * Verifica se um produto é composto (formato "E" no Bling)
   * @param {Object} produto - Objeto do produto do Bling
   * @returns {boolean} True se for produto composto
   */
  isProdutoComposto(produto) {
    // No Bling, produtos compostos têm formato "E" (Estoque)
    // Produtos simples têm formato "S" (Simples) ou outros valores
    return produto?.formato === 'E';
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

  _buildReservaCacheKey(produtoId, depositoId, tenantId, blingAccountId) {
    return {
      tenantId,
      blingAccountId,
      produtoId: String(produtoId),
      depositoId: String(depositoId),
    };
  }

  async _obterReservaCache(produtoId, depositoId, tenantId, blingAccountId) {
    try {
      return await ReservaEstoqueCache.findOne(
        this._buildReservaCacheKey(produtoId, depositoId, tenantId, blingAccountId)
      ).lean();
    } catch (error) {
      console.warn('[BLING-SERVICE] ⚠️ Falha ao ler reserva cacheada:', error.message);
      return null;
    }
  }

  async _salvarReservaCache({
    produtoId,
    depositoId,
    tenantId,
    blingAccountId,
    saldoReservadoEfetivo,
    saldoFisico,
    saldoVirtual,
    reservadoCalculado = 0,
    origem = 'implicito',
    sku = null,
  }) {
    const expiresAt = new Date(Date.now() + this._reservaCacheTtlMs);
    const key = this._buildReservaCacheKey(produtoId, depositoId, tenantId, blingAccountId);
    try {
      await ReservaEstoqueCache.findOneAndUpdate(
        key,
        {
          $set: {
            saldoReservadoEfetivo: Number(saldoReservadoEfetivo) || 0,
            saldoFisico: Number(saldoFisico) || 0,
            saldoVirtual: Number(saldoVirtual) || 0,
            reservadoCalculado: Number(reservadoCalculado) || 0,
            origem,
            sku: sku || undefined,
            ultimaLeitura: new Date(),
            expiresAt,
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
    } catch (error) {
      console.warn('[BLING-SERVICE] ⚠️ Falha ao salvar reserva cacheada:', error.message);
    }
  }

  async _limparReservaCache(produtoId, depositoId, tenantId, blingAccountId) {
    try {
      await ReservaEstoqueCache.deleteOne(
        this._buildReservaCacheKey(produtoId, depositoId, tenantId, blingAccountId)
      );
    } catch (error) {
      console.warn('[BLING-SERVICE] ⚠️ Falha ao limpar reserva cacheada:', error.message);
    }
  }

  /**
   * Obtém saldo do produto em um depósito específico
   * @param {string|number} produtoId
   * @param {string|number} depositoId
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @param {Object} options - Opções extras: { usarSaldoVirtual: boolean }
   * @returns {Promise<number>}
   */
  async getSaldoProdutoPorDeposito(produtoId, depositoId, tenantId, blingAccountId, options = {}) {
    if (!produtoId || !depositoId) {
      throw new Error('produtoId e depositoId são obrigatórios para consultar saldo');
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const tentar = async (tentativa = 1) => {
      const accessToken = await this.setAuthForBlingAccount(tenantId, blingAccountId);
      const cacheReserva = await this._obterReservaCache(
        produtoId,
        depositoId,
        tenantId,
        blingAccountId
      );

      try {
        await this._waitForRateLimit();
        const response = await axios.get(
          `${this.apiUrl}/estoques/saldos/${depositoId}`,
          {
            params: {
              idsProdutos: [produtoId],
            },
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const registros = response.data?.data || [];
        const registro = registros.find((item) => item?.produto?.id === produtoId);
        if (!registro) {
          return 0;
        }

        // IMPORTANTE: Para atualizar o deposito_teste corretamente, precisamos considerar o reservado
        // - saldoFisicoTotal = estoque físico total (JÁ INCLUI o reservado)
        // - saldoVirtualTotal = estoque disponível (físico - reservado)
        // - reservado = quantidade reservada em pedidos
        
        // Extrair valores disponíveis
        const saldoReservadoBling = Number(registro.saldoReservado || registro.reservado || 0);
        const saldoFisico = Number(registro.saldoFisicoTotal || 0);
        const saldoVirtual = Number(registro.saldoVirtualTotal || 0);

        // Detecta reservado implícito (diferença entre físico e virtual)
        let reservadoFinal = saldoReservadoBling;
        let origemReservado = 'bling';

        if (reservadoFinal <= 0 && saldoFisico > saldoVirtual && saldoFisico > 0) {
          reservadoFinal = saldoFisico - saldoVirtual;
          origemReservado = 'implicito_diff';
        }

        // Usa cache para recompor reservado em janelas em que Bling zera (ex.: faturamento parcial)
        if (reservadoFinal <= 0 && cacheReserva?.saldoReservadoEfetivo > 0) {
          // Preferir delta no virtual (consumo real) para evitar reduzir reserva apenas por variação de físico
          const deltaVirtual = Math.max(0, (cacheReserva.saldoVirtual || 0) - saldoVirtual);
          const reservadoRestante = Math.max(0, cacheReserva.saldoReservadoEfetivo - deltaVirtual);

          if (reservadoRestante > 0) {
            reservadoFinal = reservadoRestante;
            origemReservado = 'cache_delta';
            console.log(
              `[BLING-SERVICE] 🔒 Usando reservado cacheado (delta) produto ${produtoId} depósito ${depositoId}: ` +
              `reservadoCache=${cacheReserva.saldoReservadoEfetivo}, deltaVirtual=${deltaVirtual}, reservadoFinal=${reservadoFinal}`
            );
          }
        }

        const saldoVirtualParaCalculo =
          reservadoFinal > 0 && (saldoFisico > 0 || cacheReserva?.saldoFisico > 0)
            ? Math.max(
                0,
                (saldoFisico > 0 ? saldoFisico : cacheReserva?.saldoFisico || 0) - reservadoFinal
              )
            : saldoVirtual;

        const saldoFisicoConsiderado =
          saldoFisico > 0
            ? saldoFisico
            : Math.max(0, saldoVirtualParaCalculo + reservadoFinal);

        if (saldoReservadoBling > 0 || reservadoFinal > 0 || process.env.NODE_ENV === 'development') {
          console.log(`[BLING-SERVICE] 📊 Saldo do produto ${produtoId} no depósito ${depositoId}:`, {
            saldoFisicoTotal: saldoFisico,
            saldoVirtualTotal: saldoVirtual,
            saldoReservado: saldoReservadoBling,
            reservadoFinal,
            origemReservado,
            usarSaldoVirtual: options.usarSaldoVirtual,
            camposDisponiveis: Object.keys(registro),
          });
        }

        // Persistir ou limpar cache conforme resultado
        if (reservadoFinal > 0) {
          await this._salvarReservaCache({
            produtoId,
            depositoId,
            tenantId,
            blingAccountId,
            saldoReservadoEfetivo: reservadoFinal,
            saldoFisico,
            saldoVirtual,
            reservadoCalculado: origemReservado === 'implicito_diff' ? reservadoFinal : 0,
            origem: origemReservado,
            sku: registro?.produto?.codigo || registro?.produto?.sku || null,
          });
        } else if (cacheReserva) {
          await this._limparReservaCache(produtoId, depositoId, tenantId, blingAccountId);
        }
        
        if (options.usarSaldoVirtual) {
          return Number(saldoVirtualParaCalculo) || 0;
        }

        return Number(saldoFisicoConsiderado) || 0;
      } catch (error) {
        if (error.response?.status === 429 && tentativa < 3) {
          const retryAfter =
            Number(error.response.headers?.['retry-after']) * 1000 || 500;
          console.warn(
            `[BLING-SERVICE] ⚠️ Rate limit ao consultar saldo (produto ${produtoId}, depósito ${depositoId}) tentativa ${tentativa}. Retentando em ${retryAfter}ms.`
          );
          await sleep(retryAfter);
          return tentar(tentativa + 1);
        }

        const data = error.response?.data;
        const status = error.response?.status;
        const reason =
          data?.error?.description ||
          data?.error?.message ||
          data?.message ||
          error.message;

        console.error(
          `[BLING-SERVICE] ❌ Erro ao buscar saldo do produto ${produtoId} no depósito ${depositoId}:`,
          JSON.stringify(
            {
              status,
              statusText: error.response?.statusText,
              data,
              reason,
            },
            null,
            2
          )
        );

        throw new Error(`Falha ao consultar saldo do depósito ${depositoId}: ${reason}`);
      }
    };

    return tentar(1);
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

  /**
   * Lista depósitos do Bling
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @returns {Promise<Array>}
   */
  async getDepositos(tenantId, blingAccountId, incluirInativos = false) {
    const accessToken = await this.setAuthForBlingAccount(tenantId, blingAccountId);

    try {
      const params = {};
      // Se quiser incluir inativos, adicionar parâmetro (a API do Bling pode ter essa opção)
      if (incluirInativos) {
        params.situacao = 'A,I'; // Ativos e Inativos
      }

      const response = await axios.get(`${this.apiUrl}/depositos`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params
      });

      const depositos = response.data?.data || [];
      
      console.log(
        `[BLING-SERVICE] 📋 Total de depósitos encontrados na conta ${blingAccountId}: ${depositos.length}`
      );
      
      // Log detalhado dos depósitos para debug
      depositos.forEach(dep => {
        console.log(
          `[BLING-SERVICE]   - ID: ${dep.id}, Descrição: ${dep.descricao || dep.nome}, Situação: ${dep.situacao || 'N/A'}`
        );
      });

      return depositos;
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
            last_error: 'invalid_grant/401 ao buscar depósitos - Requer re-autorização'
          }
        ).catch(() => {});

        const authUrl = await this.getAuthUrl(tenantId, blingAccountId);
        const err = new Error('REAUTH_REQUIRED');
        err.reauthUrl = authUrl;
        err.reason = reason;
        throw err;
      }

      console.error(
        '❌ Erro ao buscar depósitos do Bling:',
        data || error.message
      );
      throw new Error('Falha ao buscar depósitos');
    }
  }

  /**
   * Cria um novo depósito no Bling
   * @param {string} tenantId
   * @param {string} blingAccountId
   * @param {Object} dadosDeposito - { descricao, situacao, desconsiderarSaldo }
   * @returns {Promise<Object>}
   */
  async criarDeposito(tenantId, blingAccountId, dadosDeposito) {
    const accessToken = await this.setAuthForBlingAccount(tenantId, blingAccountId);

    try {
      const payload = {
        descricao: dadosDeposito.descricao,
        situacao: dadosDeposito.situacao !== undefined ? dadosDeposito.situacao : 1, // 1 = Ativo, 0 = Inativo (formato da API Bling)
        desconsiderarSaldo: dadosDeposito.desconsiderarSaldo || false
      };

      console.log(
        `[BLING-SERVICE] 🔵 Criando depósito no Bling:`,
        JSON.stringify(payload, null, 2)
      );

      const response = await axios.post(
        `${this.apiUrl}/depositos`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const depositoCriado = response.data?.data || response.data;
      
      console.log(
        `[BLING-SERVICE] ✅ Depósito criado com sucesso no Bling:`,
        JSON.stringify(depositoCriado, null, 2)
      );

      // Verificar se o depósito foi realmente criado listando todos os depósitos
      try {
        const todosDepositos = await this.getDepositos(tenantId, blingAccountId);
        const depositoEncontrado = todosDepositos.find(
          d => d.id === depositoCriado.id || 
               d.id === depositoCriado.id?.toString() ||
               (depositoCriado.descricao && d.descricao === depositoCriado.descricao)
        );
        
        if (depositoEncontrado) {
          console.log(
            `[BLING-SERVICE] ✅ Confirmação: Depósito encontrado na listagem do Bling`,
            `ID: ${depositoEncontrado.id}, Descrição: ${depositoEncontrado.descricao}, Situação: ${depositoEncontrado.situacao}`
          );
        } else {
          console.warn(
            `[BLING-SERVICE] ⚠️ Aviso: Depósito criado mas não encontrado na listagem imediata. Pode levar alguns segundos para aparecer.`
          );
        }
      } catch (verificacaoError) {
        console.warn(
          `[BLING-SERVICE] ⚠️ Não foi possível verificar se o depósito aparece na listagem:`,
          verificacaoError.message
        );
      }

      return depositoCriado;
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
            last_error: 'invalid_grant/401 ao criar depósito - Requer re-autorização'
          }
        ).catch(() => {});

        const authUrl = await this.getAuthUrl(tenantId, blingAccountId);
        const err = new Error('REAUTH_REQUIRED');
        err.reauthUrl = authUrl;
        err.reason = reason;
        throw err;
      }

      console.error(
        '❌ Erro ao criar depósito no Bling:',
        data || error.message
      );
      throw new Error(`Falha ao criar depósito: ${reason}`);
    }
  }

  /**
   * Atualiza um depósito no Bling (para inativar, alterar nome, etc)
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @param {string|number} depositoId - ID do depósito a ser atualizado
   * @param {Object} dadosAtualizacao - Dados para atualizar { descricao?, situacao?, desconsiderarSaldo? }
   * @returns {Promise<Object>} Resposta da API do Bling
   */
  async atualizarDeposito(tenantId, blingAccountId, depositoId, dadosAtualizacao) {
    const accessToken = await this.setAuthForBlingAccount(tenantId, blingAccountId);

    try {
      const payload = {};
      
      // Incluir apenas campos que foram fornecidos
      if (dadosAtualizacao.descricao !== undefined) {
        payload.descricao = dadosAtualizacao.descricao;
      }
      if (dadosAtualizacao.situacao !== undefined) {
        // A API do Bling usa: 1 = Ativo, 0 = Inativo
        // Aceita tanto string ('I', 'A') quanto número (0, 1)
        if (dadosAtualizacao.situacao === 'I' || dadosAtualizacao.situacao === 0 || dadosAtualizacao.situacao === '0') {
          payload.situacao = 0; // Inativo
        } else if (dadosAtualizacao.situacao === 'A' || dadosAtualizacao.situacao === 1 || dadosAtualizacao.situacao === '1') {
          payload.situacao = 1; // Ativo
        } else {
          payload.situacao = dadosAtualizacao.situacao; // Usa o valor fornecido
        }
      }
      if (dadosAtualizacao.desconsiderarSaldo !== undefined) {
        payload.desconsiderarSaldo = dadosAtualizacao.desconsiderarSaldo;
      }

      // Tentar PUT primeiro (método padrão para atualização completa)
      let response;
      try {
        response = await axios.put(
          `${this.apiUrl}/depositos/${depositoId}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (putError) {
        // Se PUT não funcionar (405 Method Not Allowed), tentar PATCH
        if (putError.response?.status === 405 || putError.response?.status === 404) {
          response = await axios.patch(
            `${this.apiUrl}/depositos/${depositoId}`,
            payload,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
        } else {
          throw putError;
        }
      }

      return response.data || { success: true };
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
            last_error: 'invalid_grant/401 ao atualizar depósito - Requer re-autorização'
          }
        ).catch(() => {});

        const authUrl = await this.getAuthUrl(tenantId, blingAccountId);
        const err = new Error('REAUTH_REQUIRED');
        err.reauthUrl = authUrl;
        err.reason = reason;
        err.status = status;
        throw err;
      }

      // Log detalhado do erro
      console.error(
        `[BLING-SERVICE] ❌ Erro ao atualizar depósito ${depositoId}:`,
        JSON.stringify({
          status,
          statusText: error.response?.statusText,
          data: data,
          reason,
          url: `${this.apiUrl}/depositos/${depositoId}`
        }, null, 2)
      );

      // Não lançar erro fatal - apenas logar, pois pode não ser suportado
      throw new Error(`Falha ao atualizar depósito: ${reason || error.message} (Status: ${status || 'N/A'})`);
    }
  }

  /**
   * Registra movimentação de estoque no Bling (Operação Balanço, Entrada, Saída, etc)
   * @param {Object} params
   * @param {string} params.tenantId
   * @param {string} params.blingAccountId
   * @param {string|number} params.depositoId
   * @param {number} params.quantidade
   * @param {string} [params.tipoOperacao='B'] - Tipos suportados pelo Bling: 'B', 'E', 'S'
   * @param {string} [params.produtoIdBling] - ID do produto no Bling (evita nova consulta)
   * @param {string} [params.sku] - SKU do produto (necessário se produtoIdBling não for informado)
   * @param {string} [params.observacao]
   * @param {string} [params.origem='EstoqueUni']
   * @returns {Promise<Object>} Resposta da API
   */
  async registrarMovimentacaoEstoque({
    tenantId,
    blingAccountId,
    depositoId,
    quantidade,
    tipoOperacao = 'B',
    produtoIdBling,
    sku,
    observacao,
    origem = 'EstoqueUni',
  }) {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }

    if (!blingAccountId) {
      throw new Error('blingAccountId é obrigatório');
    }

    if (!depositoId) {
      throw new Error('depositoId é obrigatório');
    }

    const quantidadeNormalizada = Number(quantidade);
    if (!Number.isFinite(quantidadeNormalizada) || quantidadeNormalizada < 0) {
      throw new Error('Quantidade inválida para movimentação de estoque');
    }

    let produtoId = produtoIdBling;
    if (!produtoId) {
      if (!sku) {
        throw new Error('sku é obrigatório quando produtoIdBling não é fornecido');
      }
      const produto = await this.getProdutoPorSku(sku, tenantId, blingAccountId, true);
      if (!produto || !produto.id) {
        throw new Error('Produto não encontrado no Bling para esta conta');
      }
      produtoId = produto.id;
    }

    const accessToken = await this.setAuthForBlingAccount(tenantId, blingAccountId);
    const payload = {
      produto: { id: produtoId },
      deposito: { id: depositoId },
      tipoOperacao,
      quantidade: quantidadeNormalizada,
    };

    const descricaoObservacao =
      observacao || `Atualização automática realizada via EstoqueUni (${origem})`;

    payload.observacao = descricaoObservacao;

    try {
      await this._waitForRateLimit();
      const response = await axios.post(
        `${this.apiUrl}/estoques`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data?.data || response.data || { success: true };
    } catch (error) {
      const data = error.response?.data;
      const status = error.response?.status;
      const reason =
        data?.error?.description ||
        data?.error?.message ||
        data?.message ||
        error.message;

      if (data?.error?.type === 'invalid_grant' || status === 401) {
        await BlingConfig.findOneAndUpdate(
          { tenantId, blingAccountId },
          {
            is_active: false,
            last_error: 'invalid_grant/401 ao movimentar estoque - Requer re-autorização',
          }
        ).catch(() => {});

        const authUrl = await this.getAuthUrl(tenantId, blingAccountId);
        const err = new Error('REAUTH_REQUIRED');
        err.reauthUrl = authUrl;
        err.reason = reason;
        err.status = status;
        throw err;
      }

      console.error(
        `[BLING-SERVICE] ❌ Erro ao registrar movimentação de estoque (produto ${produtoId}, depósito ${depositoId}):`,
        JSON.stringify(
          {
            status,
            statusText: error.response?.statusText,
            data,
            reason,
            url: `${this.apiUrl}/estoques`,
          },
          null,
          2
        )
      );

      throw new Error(`Falha ao atualizar estoque no Bling: ${reason}`);
    }
  }

  /**
   * Busca detalhes completos de um pedido de venda no Bling
   * @param {string|number} pedidoId - ID do pedido no Bling
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @returns {Promise<Object|null>} Pedido completo com itens ou null se não encontrado
   */
  async getPedidoVenda(pedidoId, tenantId, blingAccountId) {
    if (!pedidoId) {
      throw new Error('pedidoId é obrigatório');
    }
    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }
    if (!blingAccountId) {
      throw new Error('blingAccountId é obrigatório');
    }

    const accessToken = await this.setAuthForBlingAccount(tenantId, blingAccountId);

    try {
      await this._waitForRateLimit();
      const response = await axios.get(
        `${this.apiUrl}/pedidos/vendas/${pedidoId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data?.data || null;
    } catch (error) {
      const data = error.response?.data;
      const status = error.response?.status;
      const reason =
        data?.error?.description ||
        data?.error?.message ||
        data?.message ||
        error.message;

      if (data?.error?.type === 'invalid_grant' || status === 401) {
        await BlingConfig.findOneAndUpdate(
          { tenantId, blingAccountId },
          {
            is_active: false,
            last_error: 'invalid_grant/401 ao buscar pedido - Requer re-autorização',
          }
        ).catch(() => {});

        const authUrl = await this.getAuthUrl(tenantId, blingAccountId);
        const err = new Error('REAUTH_REQUIRED');
        err.reauthUrl = authUrl;
        err.reason = reason;
        err.status = status;
        throw err;
      }

      if (status === 404) {
        console.warn(
          `[BLING-SERVICE] ⚠️ Pedido ${pedidoId} não encontrado na conta ${blingAccountId}`
        );
        return null;
      }

      console.error(
        `[BLING-SERVICE] ❌ Erro ao buscar pedido ${pedidoId}:`,
        JSON.stringify(
          {
            status,
            statusText: error.response?.statusText,
            data,
            reason,
            url: `${this.apiUrl}/pedidos/vendas/${pedidoId}`,
          },
          null,
          2
        )
      );

      throw new Error(`Falha ao buscar pedido no Bling: ${reason}`);
    }
  }

  /**
   * Deleta um depósito no Bling
   * NOTA: A API do Bling não permite deletar depósitos. 
   * Este método tenta inativar o depósito e depois remove da configuração local.
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @param {string|number} depositoId - ID do depósito a ser deletado
   * @returns {Promise<Object>} Resposta com resultado da operação
   */
  async deletarDeposito(tenantId, blingAccountId, depositoId) {
    const resultado = {
      sucesso: false,
      inativado: false,
      removidoDaConfig: false,
      mensagem: '',
      erro: null
    };
 
    if (!blingAccountId) {
      // Se não tiver blingAccountId, apenas retorna resultado indicando que não pode inativar
      resultado.erro = 'blingAccountId não fornecido - não é possível inativar no Bling';
      resultado.sucesso = true; // Sucesso porque vamos remover da config mesmo assim
      return resultado;
    }

    try {
      // Tentar inativar o depósito primeiro
      try {
        await this.atualizarDeposito(tenantId, blingAccountId, depositoId, {
          situacao: 0 // 0 = Inativo, 1 = Ativo (formato da API Bling)
        });
        
        resultado.inativado = true;
        resultado.sucesso = true;
        resultado.mensagem = `Depósito ${depositoId} inativado com sucesso no Bling`;
      } catch (inativacaoError) {
        // Se não conseguir inativar, apenas logar mas não falhar completamente
        console.warn(
          `[BLING-SERVICE] ⚠️ Não foi possível inativar o depósito ${depositoId} via API:`,
          inativacaoError.message
        );
        resultado.erro = `Não foi possível inativar via API: ${inativacaoError.message}`;
        // Continua a execução para remover da configuração mesmo assim
      }

      // Sempre retorna sucesso porque vamos remover da configuração local mesmo que não consiga inativar
      return resultado;
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
            last_error: 'invalid_grant/401 ao inativar depósito - Requer re-autorização'
          }
        ).catch(() => {});

        const authUrl = await this.getAuthUrl(tenantId, blingAccountId);
        const err = new Error('REAUTH_REQUIRED');
        err.reauthUrl = authUrl;
        err.reason = reason;
        err.status = status;
        throw err;
      }

      console.error('❌ Erro ao processar depósito:', data || error.message);
      
      // Não lançar erro - apenas retornar resultado indicando que não foi possível inativar
      // mas ainda podemos remover da configuração local
      resultado.erro = reason || error.message;
      return resultado;
    }
  }
}

export default new BlingService();

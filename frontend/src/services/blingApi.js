import axios from 'axios';

// Configuração do axios para API Bling
const api = axios.create({
  baseURL: '/api/bling',
  headers: { 
    'Content-Type': 'application/json' 
  },
  withCredentials: true
});

// Interceptor para tratamento de erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Tratamento de erros HTTP
    if (error.response) {
      // Erro com resposta do servidor
      const { status, data } = error.response;
      const mensagem = data?.error || data?.message || `Erro ${status}: ${error.message}`;
      
      console.error('[BlingAPI] Erro na requisição:', {
        status,
        mensagem,
        url: error.config?.url
      });
      
      // Retornar erro formatado
      return Promise.reject({
        status,
        mensagem,
        dados: data,
        original: error
      });
    } else if (error.request) {
      // Erro de rede (sem resposta)
      console.error('[BlingAPI] Erro de rede:', error.message);
      return Promise.reject({
        status: 0,
        mensagem: 'Erro de conexão. Verifique sua internet.',
        original: error
      });
    } else {
      // Erro na configuração da requisição
      console.error('[BlingAPI] Erro na configuração:', error.message);
      return Promise.reject({
        status: 0,
        mensagem: error.message || 'Erro desconhecido',
        original: error
      });
    }
  }
);

/**
 * Serviço de API para gerenciamento de contas Bling e sincronização de estoque
 */
export const blingApi = {
  /**
   * Lista todas as contas Bling do tenant
   * @param {string} tenantId - ID do tenant
   * @returns {Promise} Resposta com array de contas
   */
  listarContas: (tenantId) => 
    api.get('/contas', { 
      params: { tenantId } 
    }),

  /**
   * Obtém detalhes de uma conta Bling específica
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @returns {Promise} Resposta com dados da conta
   */
  obterConta: (tenantId, blingAccountId) =>
    api.get(`/contas/${blingAccountId}`, {
      params: { tenantId }
    }),

  /**
   * Inicia processo de adicionar nova conta Bling
   * Retorna URL de autorização OAuth
   * @param {string} tenantId - ID do tenant
   * @param {string} accountName - Nome amigável da conta
   * @returns {Promise} Resposta com authUrl
   */
  adicionarConta: (tenantId, accountName) =>
    api.post('/contas', { 
      tenantId, 
      accountName 
    }),

  /**
   * Remove uma conta Bling
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @returns {Promise} Resposta de confirmação
   */
  removerConta: (tenantId, blingAccountId) =>
    api.delete(`/contas/${blingAccountId}`, {
      params: { tenantId }
    }),

  /**
   * Atualiza dados de uma conta Bling
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @param {Object} data - Dados para atualizar (ex: { accountName, is_active })
   * @returns {Promise} Resposta com conta atualizada
   */
  atualizarConta: (tenantId, blingAccountId, data) =>
    api.patch(`/contas/${blingAccountId}`, data, {
      params: { tenantId }
    }),

  /**
   * Ativa ou desativa uma conta Bling
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @returns {Promise} Resposta com status atualizado
   */
  toggleConta: (tenantId, blingAccountId) =>
    api.patch(`/contas/${blingAccountId}/toggle`, {}, {
      params: { tenantId }
    }),

  /**
   * Sincroniza estoque unificado de todos os produtos
   * @param {string} tenantId - ID do tenant
   * @param {Object} options - Opções de sincronização (limit, skip)
   * @returns {Promise} Resposta com resultado da sincronização
   */
  sincronizarEstoqueUnificado: (tenantId, options = {}) =>
    api.post('/estoque/unificado', {
      tenantId,
      ...options
    }),

  /**
   * Sincroniza estoque de um produto específico
   * @param {string} tenantId - ID do tenant
   * @param {string} sku - SKU do produto
   * @returns {Promise} Resposta com estoque atualizado
   */
  sincronizarEstoqueProduto: (tenantId, sku) =>
    api.post('/estoque/produto', {
      tenantId,
      sku
    }),

  /**
   * Busca estoque unificado de um produto
   * @param {string} tenantId - ID do tenant
   * @param {string} sku - SKU do produto
   * @returns {Promise} Resposta com estoque unificado
   */
  buscarEstoque: (tenantId, sku) =>
    api.get(`/estoque/${sku}`, {
      params: { tenantId }
    }),

  /**
   * Inicia processo de autorização OAuth
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @returns {Promise} Resposta com authUrl
   */
  iniciarAutorizacao: (tenantId, blingAccountId) =>
    api.get('/auth/start', {
      params: { tenantId, blingAccountId }
    }),

  /**
   * Lista depósitos de uma conta Bling
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @returns {Promise} Resposta com array de depósitos
   */
  listarDepositos: (tenantId, blingAccountId) =>
    api.get('/depositos', {
      params: { tenantId, blingAccountId }
    }),

  /**
   * Cria um novo depósito no Bling
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @param {Object} dadosDeposito - { descricao, situacao?, desconsiderarSaldo? }
   * @returns {Promise} Resposta com depósito criado
   */
  criarDeposito: (tenantId, blingAccountId, dadosDeposito) =>
    api.post('/depositos', {
      tenantId,
      blingAccountId,
      ...dadosDeposito
    }),

  /**
   * Remove um depósito da configuração do EstoqueUni e tenta inativá-lo no Bling
   * @param {string} tenantId - ID do tenant
   * @param {string|null} blingAccountId - ID da conta Bling (necessário para tentar inativar no Bling)
   * @param {string|number} depositoId - ID do depósito a ser removido
   * @returns {Promise} Resposta de confirmação
   */
  deletarDeposito: (tenantId, blingAccountId, depositoId) =>
    api.delete(`/depositos/${depositoId}`, {
      params: { tenantId, ...(blingAccountId && { blingAccountId }) }
    }),

  /**
   * Lista pedidos (campos básicos)
   */
  listarPedidos: (tenantId, blingAccountId, { limit = 20, page = 1 } = {}) =>
    api.get('/pedidos', {
      params: { tenantId, ...(blingAccountId ? { blingAccountId } : {}), limit, page }
    }),

  /**
   * Remover pedido: limpa cache, exclui no Bling e recalcula compartilhados
   */
  removerPedido: (pedidoId, tenantId, blingAccountId) =>
    api.post(`/pedidos/${pedidoId}/remover`, { tenantId, blingAccountId })
};

export default blingApi;

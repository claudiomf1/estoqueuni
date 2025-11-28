import axios from 'axios';

// Configuração do axios para API de Sincronização
const api = axios.create({
  baseURL: '/api/sincronizacao',
  headers: { 
    'Content-Type': 'application/json' 
  },
  withCredentials: true
});

// Interceptor para tratamento de erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const mensagem = data?.error || data?.message || `Erro ${status}: ${error.message}`;
      
      console.error('[SincronizacaoAPI] Erro na requisição:', {
        status,
        mensagem,
        url: error.config?.url
      });
      
      return Promise.reject({
        status,
        mensagem,
        dados: data,
        original: error
      });
    } else if (error.request) {
      console.error('[SincronizacaoAPI] Erro de rede:', error.message);
      return Promise.reject({
        status: 0,
        mensagem: 'Erro de conexão. Verifique sua internet.',
        original: error
      });
    } else {
      console.error('[SincronizacaoAPI] Erro na configuração:', error.message);
      return Promise.reject({
        status: 0,
        mensagem: error.message || 'Erro desconhecido',
        original: error
      });
    }
  }
);

/**
 * Serviço de API para gerenciamento de sincronização de estoques
 */
export const sincronizacaoApi = {
  /**
   * Obtém status geral da sincronização
   * @param {string} tenantId - ID do tenant
   * @returns {Promise} Resposta com status da sincronização
   */
  obterStatus: (tenantId) =>
    api.get('/status', {
      params: { tenantId }
    }),

  /**
   * Obtém configuração completa (inclui depósitos)
   * @param {string} tenantId - ID do tenant
   * @returns {Promise} Resposta com configuração completa
   */
  obterConfiguracao: (tenantId) =>
    api.get('/config', {
      params: { tenantId }
    }),

  /**
   * Salva configuração completa (inclui depósitos e regra de sincronização)
   * @param {string} tenantId - ID do tenant
   * @param {Object} config - Configuração (depositos, regraSincronizacao, etc)
   * @returns {Promise} Resposta com configuração salva
   */
  salvarConfiguracao: (tenantId, config) =>
    api.post('/config', {
      tenantId,
      ...config
    }),

  /**
   * Obtém configuração de webhook
   * @param {string} tenantId - ID do tenant
   * @returns {Promise} Resposta com configuração de webhook
   */
  obterConfiguracaoWebhook: (tenantId) =>
    api.get('/config/webhook', {
      params: { tenantId }
    }),

  /**
   * Testa conexão do webhook
   * @param {string} tenantId - ID do tenant
   * @returns {Promise} Resposta do teste
   */
  testarWebhook: (tenantId) =>
    api.post('/webhook/test', {
      tenantId
    }),

  /**
   * Obtém histórico de requisições do webhook
   * @param {string} tenantId - ID do tenant
   * @param {Object} filtros - Filtros de busca (limit, skip, dataInicio, dataFim)
   * @returns {Promise} Resposta com histórico
   */
  obterHistoricoWebhook: (tenantId, filtros = {}) =>
    api.get('/webhook/historico', {
      params: {
        tenantId,
        ...filtros
      }
    }),

  /**
   * Obtém configuração de cronjob
   * @param {string} tenantId - ID do tenant
   * @returns {Promise} Resposta com configuração de cronjob
   */
  obterConfiguracaoCronjob: (tenantId) =>
    api.get('/config/cronjob', {
      params: { tenantId }
    }),

  /**
   * Atualiza configuração de cronjob
   * @param {string} tenantId - ID do tenant
   * @param {Object} config - Configuração do cronjob (ativo, intervaloMinutos)
   * @returns {Promise} Resposta com configuração atualizada
   */
  atualizarConfiguracaoCronjob: (tenantId, config) =>
    api.post('/config/cronjob', {
      tenantId,
      ...config
    }),

  /**
   * Executa sincronização manual de todos os produtos
   * @param {string} tenantId - ID do tenant
   * @returns {Promise} Resposta com resultado da sincronização
   */
  sincronizarTodos: (tenantId) =>
    api.post('/manual/todos', {
      tenantId
    }),

  /**
   * Executa sincronização manual de um produto específico
   * @param {string} tenantId - ID do tenant
   * @param {string} sku - SKU do produto
   * @returns {Promise} Resposta com resultado da sincronização
   */
  sincronizarProduto: (tenantId, sku) =>
    api.post('/manual/produto', {
      tenantId,
      sku
    }),

  /**
   * Obtém histórico de sincronizações
   * @param {string} tenantId - ID do tenant
   * @param {Object} filtros - Filtros de busca (limit, skip, dataInicio, dataFim, origem, sku)
   * @returns {Promise} Resposta com histórico
   */
  obterHistoricoSincronizacoes: (tenantId, filtros = {}) =>
    api.get('/historico', {
      params: {
        tenantId,
        ...filtros
      }
    }),

  /**
   * Obtém logs de monitoramento
   * @param {string} tenantId - ID do tenant
   * @param {Object} filtros - Filtros de busca (limit, skip, nivel, busca)
   * @returns {Promise} Resposta com logs
   */
  obterLogs: (tenantId, filtros = {}) =>
    api.get('/logs', {
      params: {
        tenantId,
        ...filtros
      }
    }),

  /**
   * Exporta logs para download
   * @param {string} tenantId - ID do tenant
   * @param {Object} filtros - Filtros de busca
   * @returns {Promise} Resposta com arquivo para download
   */
  exportarLogs: (tenantId, filtros = {}) =>
    api.get('/logs/exportar', {
      params: {
        tenantId,
        ...filtros
      },
      responseType: 'blob'
    })
};

export default sincronizacaoApi;


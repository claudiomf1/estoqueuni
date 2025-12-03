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
   * Reconciliação on-demand e suspeitos
   */
  listarSuspeitos: (tenantId, limit = 50) =>
    api.get('/suspeitos', { params: { tenantId, limit } }),

  reconciliarSuspeitos: (tenantId, limit = 50) =>
    api.post('/reconciliar/suspeitos', { tenantId, limit }),

  reconciliarRecentes: (tenantId, horas = 24, limit = 20) =>
    api.post('/reconciliar/recentes', { tenantId, horas, limit }),

  reconciliarLista: (tenantId, skus = []) =>
    api.post('/reconciliar/lista', { tenantId, skus }),

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
   * Sincroniza estoque manualmente (um produto específico ou todos)
   * @param {string} tenantId - ID do tenant
   * @param {string} produtoId - ID ou SKU do produto (opcional)
   * @returns {Promise} Resposta com resultado da sincronização
   */
  sincronizarManual: (tenantId, produtoId = null) =>
    api.post('/manual', {
      tenantId,
      ...(produtoId ? { produtoId, sku: produtoId } : {})
    }),

  /**
   * Marca uma conta Bling como tendo webhook configurado
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @returns {Promise} Resposta com conta atualizada
   */
  marcarContaWebhookConfigurada: (tenantId, blingAccountId) =>
    api.put('/webhook/marcar-conta-configurada', {
      tenantId,
      blingAccountId
    }),

  /**
   * Limpa todas as estatísticas de sincronização (eventos processados)
   * @param {string} tenantId - ID do tenant
   * @returns {Promise} Resposta com quantidade de registros removidos
   */
  limparEstatisticas: (tenantId) =>
    api.delete('/estatisticas', {
      params: { tenantId }
    }),

};

export default sincronizacaoApi;

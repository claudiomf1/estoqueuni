import axios from 'axios';

// Configuração do axios para API de Produtos
const api = axios.create({
  baseURL: '/api/produtos',
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
      
      console.error('[ProdutoAPI] Erro na requisição:', {
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
      console.error('[ProdutoAPI] Erro de rede:', error.message);
      return Promise.reject({
        status: 0,
        mensagem: 'Erro de conexão. Verifique sua internet.',
        original: error
      });
    } else {
      // Erro na configuração da requisição
      console.error('[ProdutoAPI] Erro na configuração:', error.message);
      return Promise.reject({
        status: 0,
        mensagem: error.message || 'Erro desconhecido',
        original: error
      });
    }
  }
);

/**
 * Serviço de API para gerenciamento de produtos
 */
export const produtoApi = {
  /**
   * Lista produtos com filtros opcionais
   * @param {string} tenantId - ID do tenant
   * @param {Object} filtros - Filtros de busca (ex: { sku, nome, limit, skip })
   * @returns {Promise} Resposta com array de produtos
   */
  listarProdutos: (tenantId, filtros = {}) =>
    api.get('', {
      params: {
        tenantId,
        ...filtros
      }
    }),

  /**
   * Obtém detalhes de um produto específico
   * @param {string} tenantId - ID do tenant
   * @param {string} sku - SKU do produto
   * @returns {Promise} Resposta com dados do produto
   */
  obterProduto: (tenantId, sku) =>
    api.get(`/${sku}`, {
      params: { tenantId }
    }),

  /**
   * Cria um novo produto
   * @param {string} tenantId - ID do tenant
   * @param {Object} data - Dados do produto (sku, nome, descricao, etc.)
   * @returns {Promise} Resposta com produto criado
   */
  criarProduto: (tenantId, data) =>
    api.post('', {
      tenantId,
      ...data
    }),

  /**
   * Atualiza dados de um produto existente
   * @param {string} tenantId - ID do tenant
   * @param {string} sku - SKU do produto
   * @param {Object} data - Dados para atualizar
   * @returns {Promise} Resposta com produto atualizado
   */
  atualizarProduto: (tenantId, sku, data) =>
    api.patch(`/${sku}`, data, {
      params: { tenantId }
    })
};

export default produtoApi;

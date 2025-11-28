import axios from 'axios';
import ConfiguracaoSincronizacao from '../models/ConfiguracaoSincronizacao.js';
import blingService from './blingService.js';

/**
 * Serviço de Sincronização de Estoques Compartilhados
 * 
 * Sincroniza estoques dos depósitos principais configurados
 * para os depósitos compartilhados configurados
 * usando operação de Balanço (B) no Bling.
 * 
 * Estrutura genérica: funciona com N depósitos principais e N depósitos compartilhados.
 */
class SincronizadorEstoqueService {
  constructor() {
    this.apiUrl = 'https://www.bling.com.br/Api/v3';
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 segundo
  }

  /**
   * Função principal de sincronização de estoque
   * @param {string} produtoId - ID do produto no Bling (pode ser SKU ou ID numérico)
   * @param {string} tenantId - ID do tenant
   * @param {string} origem - Origem da sincronização: 'webhook', 'cronjob', 'manual'
   * @returns {Promise<Object>} Resultado da sincronização
   */
  async sincronizarEstoque(produtoId, tenantId, origem = 'manual') {
    console.log(
      `[SINCRONIZADOR-ESTOQUE] Iniciando sincronização - Produto: ${produtoId}, Tenant: ${tenantId}, Origem: ${origem}`
    );

    try {
      // 1. Buscar configuração
      const config = await ConfiguracaoSincronizacao.findOne({ tenantId });

      if (!config) {
        throw new Error(`Configuração de sincronização não encontrada para tenant ${tenantId}`);
      }

      if (!config.isConfigurationComplete()) {
        throw new Error(
          `Configuração incompleta para tenant ${tenantId}. Verifique depósitos e contas Bling.`
        );
      }

      // 2. Buscar saldos dos depósitos principais (genérico)
      const saldos = await this.buscarSaldosDepositos(produtoId, tenantId, config);

      // 3. Calcular soma dos depósitos principais (genérico)
      const soma = this.calcularSoma(saldos);

      console.log(
        `[SINCRONIZADOR-ESTOQUE] Saldos encontrados - Total depósitos: ${saldos.length}, Soma: ${soma}`
      );

      // 4. Atualizar todos os depósitos compartilhados (genérico)
      const depositosCompartilhados = config.regraSincronizacao.depositosCompartilhados || [];
      const compartilhadosAtualizados = {};

      await Promise.all(
        depositosCompartilhados.map(async (depositoId) => {
          // Buscar depósito na configuração para obter conta relacionada
          const deposito = config.depositos.find(d => d.id === depositoId);
          if (!deposito) {
            console.warn(
              `[SINCRONIZADOR-ESTOQUE] ⚠️ Depósito ${depositoId} não encontrado na configuração`
            );
            compartilhadosAtualizados[depositoId] = {
              depositoId,
              valor: soma,
              sucesso: false,
              erro: 'Depósito não encontrado na configuração',
            };
            return;
          }

          // Buscar conta relacionada ao depósito
          const conta = config.buscarContaPorBlingAccountId(deposito.contaBlingId);
          if (!conta) {
            console.warn(
              `[SINCRONIZADOR-ESTOQUE] ⚠️ Conta Bling ${deposito.contaBlingId} não encontrada para depósito ${depositoId}`
            );
            compartilhadosAtualizados[depositoId] = {
              depositoId,
              valor: soma,
              sucesso: false,
              erro: 'Conta Bling não encontrada',
            };
            return;
          }

          // Atualizar depósito compartilhado
          const resultado = await this.atualizarDepositoCompartilhado(
            produtoId,
            depositoId,
            soma,
            tenantId,
            conta.blingAccountId
          );

          compartilhadosAtualizados[depositoId] = {
            depositoId,
            valor: soma,
            sucesso: resultado.success,
            erro: resultado.erro || null,
          };
        })
      );

      // 5. Atualizar última sincronização
      config.ultimaSincronizacao = new Date();
      config.incrementarEstatistica(origem);
      await config.save();

      // Formatar saldos para retorno (manter array e também objeto para compatibilidade)
      const saldosFormatados = saldos.reduce((acc, saldo) => {
        acc[saldo.depositoId] = saldo.valor;
        return acc;
      }, {});

      const resultado = {
        success: true,
        produtoId,
        tenantId,
        origem,
        saldos: saldosFormatados, // Objeto com depositoId como chave
        saldosArray: saldos, // Array completo para comparação detalhada
        soma: soma,
        compartilhadosAtualizados,
        processadoEm: new Date(),
      };

      console.log(
        `[SINCRONIZADOR-ESTOQUE] ✅ Sincronização concluída com sucesso para produto ${produtoId}`
      );

      return resultado;
    } catch (error) {
      console.error(
        `[SINCRONIZADOR-ESTOQUE] ❌ Erro ao sincronizar estoque para produto ${produtoId}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Busca saldos dos depósitos principais (genérico)
   * @param {string} produtoId - ID do produto no Bling
   * @param {string} tenantId - ID do tenant
   * @param {Object} config - Configuração de sincronização
   * @returns {Promise<Array>} Array de objetos com saldos { depositoId, valor, contaBlingId }
   */
  async buscarSaldosDepositos(produtoId, tenantId, config) {
    console.log(
      `[SINCRONIZADOR-ESTOQUE] Buscando saldos dos depósitos principais para produto ${produtoId}`
    );

    const depositosPrincipais = config.regraSincronizacao?.depositosPrincipais || [];

    if (depositosPrincipais.length === 0) {
      console.warn(
        `[SINCRONIZADOR-ESTOQUE] ⚠️ Nenhum depósito principal configurado para tenant ${tenantId}`
      );
      return [];
    }

    try {
      // Buscar saldos de todos os depósitos principais em paralelo
      const saldos = await Promise.all(
        depositosPrincipais.map(async (depositoId) => {
          // Buscar depósito na configuração para obter conta relacionada
          const deposito = config.depositos.find(d => d.id === depositoId);
          if (!deposito) {
            console.warn(
              `[SINCRONIZADOR-ESTOQUE] ⚠️ Depósito ${depositoId} não encontrado na configuração`
            );
            return {
              depositoId,
              valor: 0,
              contaBlingId: null,
              erro: 'Depósito não encontrado na configuração',
            };
          }

          // Buscar conta relacionada ao depósito
          const conta = config.buscarContaPorBlingAccountId(deposito.contaBlingId);
          if (!conta) {
            console.warn(
              `[SINCRONIZADOR-ESTOQUE] ⚠️ Conta Bling ${deposito.contaBlingId} não encontrada para depósito ${depositoId}`
            );
            return {
              depositoId,
              valor: 0,
              contaBlingId: deposito.contaBlingId,
              erro: 'Conta Bling não encontrada',
            };
          }

          // Buscar saldo do depósito
          const valor = await this.buscarSaldoDeposito(
            produtoId,
            depositoId,
            tenantId,
            conta.blingAccountId
          );

          return {
            depositoId,
            valor,
            contaBlingId: conta.blingAccountId,
            nomeDeposito: deposito.nome,
          };
        })
      );

      const totalSaldos = saldos.reduce((acc, saldo) => acc + saldo.valor, 0);
      console.log(
        `[SINCRONIZADOR-ESTOQUE] Saldos encontrados - ${saldos.length} depósito(s) principal(is), Total: ${totalSaldos}`
      );

      return saldos;
    } catch (error) {
      console.error(
        `[SINCRONIZADOR-ESTOQUE] Erro ao buscar saldos dos depósitos:`,
        error.message
      );
      // Retorna array vazio em caso de erro, mas continua o processo
      return [];
    }
  }

  /**
   * Busca saldo de um produto em um depósito específico
   * @param {string} produtoId - ID ou SKU do produto
   * @param {string} depositoId - ID do depósito
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @returns {Promise<number>} Saldo no depósito
   */
  async buscarSaldoDeposito(produtoId, depositoId, tenantId, blingAccountId) {
    try {
      // Obter token de autenticação
      const accessToken = await blingService.setAuthForBlingAccount(tenantId, blingAccountId);

      // Buscar produto completo com estoque por depósito
      const produto = await this.buscarProdutoCompleto(produtoId, tenantId, blingAccountId);
      
      if (!produto) {
        console.log(
          `[SINCRONIZADOR-ESTOQUE] Produto ${produtoId} não encontrado na conta ${blingAccountId}`
        );
        return 0;
      }

      // Obter ID numérico do produto
      const produtoIdNumerico = produto.id;

      // Tentar buscar estoque por depósito usando o endpoint de estoques
      try {
        const response = await axios.get(
          `${this.apiUrl}/estoques`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            params: {
              produto: produtoIdNumerico,
              deposito: depositoId,
            },
          }
        );

        // Se a resposta contém dados de estoque
        const estoques = response.data?.data || [];
        
        if (Array.isArray(estoques) && estoques.length > 0) {
          const estoqueDeposito = estoques.find(
            (e) => 
              (e.deposito?.id === depositoId || e.depositoId === depositoId) &&
              (e.produto?.id === produtoIdNumerico || e.produtoId === produtoIdNumerico)
          );
          
          if (estoqueDeposito) {
            const saldo = estoqueDeposito.saldo || estoqueDeposito.quantidade || 0;
            return typeof saldo === 'number' ? Math.max(0, saldo) : 0;
          }
        }

        // Se não encontrou no formato de array, tentar objeto único
        if (response.data?.data && !Array.isArray(response.data.data)) {
          const estoque = response.data.data;
          const saldo = estoque.saldo || estoque.quantidade || 0;
          return typeof saldo === 'number' ? Math.max(0, saldo) : 0;
        }
      } catch (apiError) {
        // Se falhar, tentar método alternativo usando produto completo
        console.log(
          `[SINCRONIZADOR-ESTOQUE] Tentativa direta de busca de estoque falhou, usando método alternativo para produto ${produtoId}`
        );
      }

      // Método alternativo: buscar produto completo e extrair estoque por depósito
      if (produto.estoque) {
        // Verificar se tem estoque por depósito na estrutura do produto
        if (produto.estoque.depositos && Array.isArray(produto.estoque.depositos)) {
          const depositoEncontrado = produto.estoque.depositos.find(
            (d) => d.id === depositoId || d.depositoId === depositoId
          );
          
          if (depositoEncontrado) {
            const saldo = depositoEncontrado.saldo || depositoEncontrado.quantidade || 0;
            return typeof saldo === 'number' ? Math.max(0, saldo) : 0;
          }
        }

        // Se não tiver estrutura de depósitos, pode ser que o estoque seja total
        // Neste caso, precisamos buscar de outra forma ou retornar 0
        // Por segurança, retornamos 0 para evitar valores incorretos
        console.log(
          `[SINCRONIZADOR-ESTOQUE] Produto ${produtoId} não possui estrutura de estoque por depósito específico`
        );
      }

      return 0;
    } catch (error) {
      console.error(
        `[SINCRONIZADOR-ESTOQUE] Erro ao buscar saldo do depósito ${depositoId} para produto ${produtoId}:`,
        error.message
      );
      return 0;
    }
  }

  /**
   * Busca produto completo com estoque
   * @param {string} produtoId - ID ou SKU do produto
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @returns {Promise<Object|null>} Produto completo
   */
  async buscarProdutoCompleto(produtoId, tenantId, blingAccountId) {
    try {
      // Se for SKU, usar o método do blingService que já faz a busca
      if (isNaN(produtoId)) {
        const produto = await blingService.getProdutoPorSku(produtoId, tenantId, blingAccountId);
        // Buscar produto completo com estoque detalhado
        if (produto && produto.id) {
          const accessToken = await blingService.setAuthForBlingAccount(tenantId, blingAccountId);
          const response = await axios.get(`${this.apiUrl}/produtos/${produto.id}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            params: {
              campos: 'id,codigo,estoque',
            },
          });
          return response.data?.data || produto;
        }
        return produto;
      }

      // Buscar por ID direto
      const accessToken = await blingService.setAuthForBlingAccount(tenantId, blingAccountId);
      const response = await axios.get(`${this.apiUrl}/produtos/${produtoId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          campos: 'id,codigo,estoque',
        },
      });

      return response.data?.data || null;
    } catch (error) {
      console.error(
        `[SINCRONIZADOR-ESTOQUE] Erro ao buscar produto completo ${produtoId}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Atualiza depósito compartilhado usando operação de Balanço (B)
   * @param {string} produtoId - ID do produto no Bling
   * @param {string} depositoId - ID do depósito compartilhado
   * @param {number} valor - Valor absoluto a ser definido (soma dos 3 depósitos)
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @returns {Promise<Object>} Resultado da atualização
   */
  async atualizarDepositoCompartilhado(
    produtoId,
    depositoId,
    valor,
    tenantId,
    blingAccountId
  ) {
    console.log(
      `[SINCRONIZADOR-ESTOQUE] Atualizando depósito compartilhado ${depositoId} com valor ${valor} para produto ${produtoId}`
    );

    for (let tentativa = 1; tentativa <= this.maxRetries; tentativa++) {
      try {
        // Obter token de autenticação
        const accessToken = await blingService.setAuthForBlingAccount(tenantId, blingAccountId);

        // Buscar produto por ID ou SKU para obter o ID numérico
        let produtoIdNumerico = produtoId;
        
        if (isNaN(produtoId)) {
          const produto = await blingService.getProdutoPorSku(produtoId, tenantId, blingAccountId);
          if (!produto || !produto.id) {
            throw new Error(`Produto ${produtoId} não encontrado na conta ${blingAccountId}`);
          }
          produtoIdNumerico = produto.id;
        }

        // Montar payload para operação de Balanço (B)
        const payload = {
          produto: {
            id: produtoIdNumerico,
          },
          deposito: {
            id: depositoId,
          },
          tipoOperacao: 'B', // B = Balanço (define valor absoluto)
          quantidade: valor,
        };

        // Fazer requisição para atualizar estoque
        const response = await axios.post(`${this.apiUrl}/estoques`, payload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(
          `[SINCRONIZADOR-ESTOQUE] ✅ Depósito ${depositoId} atualizado com sucesso para produto ${produtoId}`
        );

        return {
          success: true,
          depositoId,
          valor,
          response: response.data,
        };
      } catch (error) {
        const errorMessage =
          error.response?.data?.error?.description ||
          error.response?.data?.message ||
          error.message;

        console.error(
          `[SINCRONIZADOR-ESTOQUE] ❌ Erro na tentativa ${tentativa}/${this.maxRetries} ao atualizar depósito ${depositoId}:`,
          errorMessage
        );

        // Se for última tentativa, lança erro
        if (tentativa === this.maxRetries) {
          return {
            success: false,
            depositoId,
            valor,
            erro: errorMessage,
          };
        }

        // Aguarda antes de tentar novamente (exponential backoff)
        const delay = this.retryDelay * Math.pow(2, tentativa - 1);
        console.log(
          `[SINCRONIZADOR-ESTOQUE] Aguardando ${delay}ms antes de tentar novamente...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Calcula a soma dos saldos principais (genérico)
   * @param {Array} saldos - Array de objetos com saldos { depositoId, valor, ... }
   * @returns {number} Soma dos saldos
   */
  calcularSoma(saldos) {
    if (!Array.isArray(saldos) || saldos.length === 0) {
      console.warn(
        `[SINCRONIZADOR-ESTOQUE] ⚠️ Array de saldos vazio ou inválido`
      );
      return 0;
    }

    const soma = saldos.reduce((acc, saldo) => {
      const valor = this.validarNumero(saldo.valor);
      return acc + valor;
    }, 0);

    const detalhes = saldos.map(s => `${s.nomeDeposito || s.depositoId}: ${s.valor}`).join(', ');
    console.log(
      `[SINCRONIZADOR-ESTOQUE] Cálculo da soma (${saldos.length} depósito(s)): ${detalhes} = ${soma}`
    );

    return soma;
  }

  /**
   * Valida e converte valor para número
   * @param {*} valor - Valor a ser validado
   * @returns {number} Número válido (0 se inválido)
   */
  validarNumero(valor) {
    const numero = typeof valor === 'number' ? valor : parseFloat(valor);
    return isNaN(numero) || !isFinite(numero) ? 0 : Math.max(0, numero);
  }
}

export default new SincronizadorEstoqueService();

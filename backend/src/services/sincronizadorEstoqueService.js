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
      // Buscar saldos sequencialmente para evitar rate limit (429) da API do Bling
      // Delay de 500ms entre cada requisição
      const saldos = [];
      
      for (let i = 0; i < depositosPrincipais.length; i++) {
        const depositoId = depositosPrincipais[i];
        
        // Adicionar delay entre requisições (exceto na primeira)
        if (i > 0) {
          const delay = 500; // 500ms entre requisições
          console.log(
            `[SINCRONIZADOR-ESTOQUE] ⏳ Aguardando ${delay}ms antes da próxima requisição (evitar rate limit)`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Buscar depósito na configuração para obter conta relacionada
        const deposito = config.depositos.find(d => d.id === depositoId);
        if (!deposito) {
          console.warn(
            `[SINCRONIZADOR-ESTOQUE] ⚠️ Depósito ${depositoId} não encontrado na configuração`
          );
          saldos.push({
            depositoId,
            valor: 0,
            contaBlingId: null,
            erro: 'Depósito não encontrado na configuração',
          });
          continue;
        }

        // Buscar conta relacionada ao depósito
        const conta = config.buscarContaPorBlingAccountId(deposito.contaBlingId);
        if (!conta) {
          console.warn(
            `[SINCRONIZADOR-ESTOQUE] ⚠️ Conta Bling ${deposito.contaBlingId} não encontrada para depósito ${depositoId}`
          );
          saldos.push({
            depositoId,
            valor: 0,
            contaBlingId: deposito.contaBlingId,
            erro: 'Conta Bling não encontrada',
          });
          continue;
        }

        // Buscar saldo do depósito com retry em caso de rate limit
        const valor = await this.buscarSaldoDepositoComRetry(
          produtoId,
          depositoId,
          tenantId,
          conta.blingAccountId
        );

        saldos.push({
          depositoId,
          valor,
          contaBlingId: conta.blingAccountId,
          nomeDeposito: deposito.nome,
        });
      }

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
   * Busca saldo com retry em caso de rate limit (429)
   * @param {string} produtoId - ID ou SKU do produto
   * @param {string} depositoId - ID do depósito
   * @param {string} tenantId - ID do tenant
   * @param {string} blingAccountId - ID da conta Bling
   * @param {number} maxRetries - Número máximo de tentativas (padrão: 3)
   * @returns {Promise<number>} Saldo no depósito
   */
  async buscarSaldoDepositoComRetry(produtoId, depositoId, tenantId, blingAccountId, maxRetries = 3) {
    let lastError = null;
    
    for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
      try {
        return await this.buscarSaldoDeposito(produtoId, depositoId, tenantId, blingAccountId);
      } catch (error) {
        lastError = error;
        
        // Se for erro 429 (rate limit), aguardar e tentar novamente
        if (error.response?.status === 429 || error.message?.includes('429')) {
          const delay = Math.pow(2, tentativa) * 1000; // Backoff exponencial: 2s, 4s, 8s
          console.warn(
            `[SINCRONIZADOR-ESTOQUE] ⚠️ Rate limit (429) detectado. Tentativa ${tentativa}/${maxRetries}. Aguardando ${delay}ms antes de tentar novamente...`
          );
          
          if (tentativa < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // Se não for rate limit ou esgotou tentativas, lançar erro
        throw error;
      }
    }
    
    // Se chegou aqui, esgotou todas as tentativas
    console.error(
      `[SINCRONIZADOR-ESTOQUE] ❌ Erro após ${maxRetries} tentativas:`,
      lastError?.message || lastError
    );
    return 0;
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
      console.log(
        `[SINCRONIZADOR-ESTOQUE] 🔍 Buscando saldo - Produto: ${produtoId}, Depósito: ${depositoId}, Conta: ${blingAccountId}`
      );

      // Obter token de autenticação
      const accessToken = await blingService.setAuthForBlingAccount(tenantId, blingAccountId);

      // Buscar produto completo com estoque por depósito (com retry automático para rate limit)
      let produto;
      try {
        produto = await this.buscarProdutoCompleto(produtoId, tenantId, blingAccountId);
      } catch (error) {
        // Se mesmo com retry falhou, logar e retornar 0
        console.error(
          `[SINCRONIZADOR-ESTOQUE] ❌ Erro ao buscar produto ${produtoId} após retries:`,
          error.message
        );
        return 0;
      }
      
      if (!produto) {
        console.log(
          `[SINCRONIZADOR-ESTOQUE] ❌ Produto ${produtoId} não encontrado na conta ${blingAccountId}`
        );
        return 0;
      }

      // Obter ID numérico do produto
      const produtoIdNumerico = produto.id;
      console.log(
        `[SINCRONIZADOR-ESTOQUE] ✅ Produto encontrado - ID: ${produtoIdNumerico}, SKU: ${produto.codigo || produtoId}`
      );

      // Buscar estoque por depósito usando o endpoint correto da API do Bling
      // Endpoint: /estoques/saldos/{idDeposito}?idsProdutos[]={idProduto}
      try {
        console.log(
          `[SINCRONIZADOR-ESTOQUE] 🔍 Buscando estoque via API - Produto ID: ${produtoIdNumerico}, Depósito ID: ${depositoId}`
        );

        // Usar o endpoint correto: /estoques/saldos/{idDeposito}?idsProdutos[]={idProduto}
        // Construir URL manualmente para garantir o formato correto do parâmetro array
        const url = `${this.apiUrl}/estoques/saldos/${depositoId}?idsProdutos[]=${produtoIdNumerico}`;
        
        console.log(
          `[SINCRONIZADOR-ESTOQUE] 🔗 URL da requisição: ${url}`
        );
        
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(
          `[SINCRONIZADOR-ESTOQUE] 📦 Resposta da API de saldos:`,
          JSON.stringify(response.data, null, 2).substring(0, 1000)
        );

        // A resposta deve conter os saldos dos produtos para o depósito especificado
        const saldos = response.data?.data || response.data || [];
        
        // A resposta pode ser um array ou um objeto com array
        let estoques = Array.isArray(saldos) ? saldos : (saldos.saldos || saldos.produtos || []);
        
        if (Array.isArray(estoques) && estoques.length > 0) {
          console.log(
            `[SINCRONIZADOR-ESTOQUE] 📋 Encontrados ${estoques.length} registro(s) de estoque`
          );

          // Buscar o produto específico (o endpoint já filtra pelo depósito, então só precisa do produto)
          const estoqueProduto = estoques.find(
            (e) => {
              const produtoMatch = e.produto?.id === produtoIdNumerico || 
                                  e.produtoId === produtoIdNumerico ||
                                  e.idProduto === produtoIdNumerico ||
                                  String(e.produto?.id) === String(produtoIdNumerico) ||
                                  String(e.produtoId) === String(produtoIdNumerico) ||
                                  String(e.idProduto) === String(produtoIdNumerico);
              
              if (produtoMatch) {
                console.log(
                  `[SINCRONIZADOR-ESTOQUE] ✅ Estoque encontrado para produto ${produtoIdNumerico} no depósito ${depositoId}:`,
                  JSON.stringify(e, null, 2)
                );
              }
              
              return produtoMatch;
            }
          );
          
          if (estoqueProduto) {
            // Tentar diferentes campos possíveis para o saldo
            // A API retorna saldoFisicoTotal e saldoVirtualTotal
            const saldo = estoqueProduto.saldoFisicoTotal ||  // Prioridade: saldo físico total
                         estoqueProduto.saldoVirtualTotal ||  // Fallback: saldo virtual total
                         estoqueProduto.saldoFisico || 
                         estoqueProduto.saldoVirtual ||
                         estoqueProduto.saldo || 
                         estoqueProduto.quantidade || 
                         estoqueProduto.saldoDisponivel ||
                         0;
            const saldoFinal = typeof saldo === 'number' ? Math.max(0, saldo) : 0;
            console.log(
              `[SINCRONIZADOR-ESTOQUE] ✅ Saldo encontrado: ${saldoFinal} unidades (saldoFisicoTotal: ${estoqueProduto.saldoFisicoTotal}, saldoVirtualTotal: ${estoqueProduto.saldoVirtualTotal})`
            );
            return saldoFinal;
          } else {
            console.log(
              `[SINCRONIZADOR-ESTOQUE] ⚠️ Produto ${produtoIdNumerico} não encontrado nos saldos do depósito ${depositoId}`
            );
            if (estoques.length > 0) {
              console.log(
                `[SINCRONIZADOR-ESTOQUE] 📋 Produtos encontrados no depósito:`,
                estoques.map(e => ({
                  produtoId: e.produto?.id || e.produtoId || e.idProduto,
                  saldo: e.saldo || e.quantidade || e.saldoFisico
                }))
              );
            }
          }
        } else {
          console.log(
            `[SINCRONIZADOR-ESTOQUE] ⚠️ Resposta da API não contém estrutura de saldos esperada`
          );
        }
      } catch (apiError) {
        // Se falhar, tentar método alternativo usando produto completo
        console.log(
          `[SINCRONIZADOR-ESTOQUE] ⚠️ Tentativa de busca de estoque falhou: ${apiError.message}, usando método alternativo`
        );
        if (apiError.response) {
          console.log(
            `[SINCRONIZADOR-ESTOQUE] 📋 Erro da API:`,
            apiError.response.status,
            JSON.stringify(apiError.response.data, null, 2).substring(0, 500)
          );
        }
      }

      // Método alternativo: buscar produto completo e extrair estoque por depósito
      console.log(
        `[SINCRONIZADOR-ESTOQUE] 🔄 Tentando método alternativo - verificando estrutura de estoque do produto`
      );

      if (produto.estoque) {
        console.log(
          `[SINCRONIZADOR-ESTOQUE] 📦 Estrutura de estoque do produto:`,
          JSON.stringify(produto.estoque, null, 2).substring(0, 500)
        );

        // Verificar se tem estoque por depósito na estrutura do produto
        if (produto.estoque.depositos && Array.isArray(produto.estoque.depositos)) {
          console.log(
            `[SINCRONIZADOR-ESTOQUE] 📋 Encontrados ${produto.estoque.depositos.length} depósito(s) na estrutura do produto`
          );

          const depositoEncontrado = produto.estoque.depositos.find(
            (d) => {
              const match = d.id === depositoId || 
                           d.depositoId === depositoId ||
                           String(d.id) === String(depositoId) ||
                           String(d.depositoId) === String(depositoId);
              
              if (match) {
                console.log(
                  `[SINCRONIZADOR-ESTOQUE] ✅ Depósito encontrado na estrutura do produto:`,
                  JSON.stringify(d, null, 2)
                );
              }
              
              return match;
            }
          );
          
          if (depositoEncontrado) {
            const saldo = depositoEncontrado.saldo || depositoEncontrado.quantidade || 0;
            const saldoFinal = typeof saldo === 'number' ? Math.max(0, saldo) : 0;
            console.log(
              `[SINCRONIZADOR-ESTOQUE] ✅ Saldo encontrado (método alternativo): ${saldoFinal} unidades`
            );
            return saldoFinal;
          } else {
            console.log(
              `[SINCRONIZADOR-ESTOQUE] ⚠️ Depósito ${depositoId} não encontrado na lista de depósitos do produto`
            );
            console.log(
              `[SINCRONIZADOR-ESTOQUE] 📋 Depósitos disponíveis:`,
              produto.estoque.depositos.map(d => ({
                id: d.id,
                depositoId: d.depositoId,
                nome: d.nome || d.name
              }))
            );
          }
        } else {
          console.log(
            `[SINCRONIZADOR-ESTOQUE] ⚠️ Produto tem estoque mas não tem estrutura de depósitos`
          );
        }

        // Se não tiver estrutura de depósitos, pode ser que o estoque seja total
        // Neste caso, precisamos buscar de outra forma ou retornar 0
        // Por segurança, retornamos 0 para evitar valores incorretos
        console.log(
          `[SINCRONIZADOR-ESTOQUE] ❌ Produto ${produtoId} não possui estrutura de estoque por depósito específico`
        );
      } else {
        console.log(
          `[SINCRONIZADOR-ESTOQUE] ❌ Produto ${produtoId} não possui campo 'estoque' na resposta`
        );
      }

      console.log(
        `[SINCRONIZADOR-ESTOQUE] ❌ Retornando 0 - nenhum método conseguiu encontrar o estoque`
      );
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
  async buscarProdutoCompleto(produtoId, tenantId, blingAccountId, maxRetries = 3) {
    let lastError = null;
    
    for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
      try {
        // Se for SKU, usar o método do blingService que já faz a busca
        if (isNaN(produtoId)) {
          const produto = await blingService.getProdutoPorSku(produtoId, tenantId, blingAccountId);
          // Buscar produto completo com estoque detalhado (tentar buscar com todos os campos de estoque)
          if (produto && produto.id) {
            const accessToken = await blingService.setAuthForBlingAccount(tenantId, blingAccountId);
            
            // Tentar buscar com campos expandidos de estoque
            const response = await axios.get(`${this.apiUrl}/produtos/${produto.id}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              params: {
                // Buscar com mais campos de estoque ou sem limitar campos
                campos: 'id,codigo,estoque,estoque.depositos',
              },
            });
            
            const produtoCompleto = response.data?.data || produto;
            console.log(
              `[SINCRONIZADOR-ESTOQUE] 📦 Produto completo retornado:`,
              JSON.stringify(produtoCompleto, null, 2).substring(0, 1500)
            );
            
            return produtoCompleto;
          }
          return produto;
        }

        // Buscar por ID direto com campos expandidos
        const accessToken = await blingService.setAuthForBlingAccount(tenantId, blingAccountId);
        const response = await axios.get(`${this.apiUrl}/produtos/${produtoId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            // Buscar com mais campos de estoque ou sem limitar campos
            campos: 'id,codigo,estoque,estoque.depositos',
          },
        });

        const produtoCompleto = response.data?.data || null;
        if (produtoCompleto) {
          console.log(
            `[SINCRONIZADOR-ESTOQUE] 📦 Produto completo retornado (ID direto):`,
            JSON.stringify(produtoCompleto, null, 2).substring(0, 1500)
          );
        }
        
        return produtoCompleto;
      } catch (error) {
        lastError = error;
        
        // Se for erro 429 (rate limit), aguardar e tentar novamente
        if (error.response?.status === 429 || error.message?.includes('429')) {
          const delay = Math.pow(2, tentativa) * 1000; // Backoff exponencial: 2s, 4s, 8s
          console.warn(
            `[SINCRONIZADOR-ESTOQUE] ⚠️ Rate limit (429) ao buscar produto ${produtoId}. Tentativa ${tentativa}/${maxRetries}. Aguardando ${delay}ms...`
          );
          
          if (tentativa < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // Se não for rate limit ou esgotou tentativas, lançar erro
        throw error;
      }
    }
    
    // Se chegou aqui, esgotou todas as tentativas
    console.error(
      `[SINCRONIZADOR-ESTOQUE] ❌ Erro ao buscar produto completo ${produtoId} após ${maxRetries} tentativas:`,
      lastError?.message || lastError
    );
    return null;
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

import ConfiguracaoSincronizacao from '../models/ConfiguracaoSincronizacao.js';
import Produto from '../models/Produto.js';
import EventoProcessado from '../models/EventoProcessado.js';
import sincronizadorEstoqueService from './sincronizadorEstoqueService.js';

/**
 * Serviço de Verificação de Estoque
 * 
 * Verifica periodicamente produtos que podem ter mudado de estoque
 * e sincroniza quando necessário (fallback para webhooks)
 */
class VerificacaoEstoqueService {
  /**
   * Executa verificação de estoque para um tenant
   * @param {string} tenantId - ID do tenant
   * @returns {Promise<Object>} Resultado da verificação
   */
  async executarVerificacao(tenantId) {
    console.log(
      `[VERIFICACAO-ESTOQUE] Iniciando verificação para tenant ${tenantId}`
    );

    try {
      // 1. Buscar configuração
      const config = await ConfiguracaoSincronizacao.findOne({ tenantId });

      if (!config) {
        console.log(
          `[VERIFICACAO-ESTOQUE] ⚠️ Configuração não encontrada para tenant ${tenantId}`
        );
        return {
          success: false,
          message: 'Configuração não encontrada',
          tenantId,
        };
      }

      // 2. Verificar se cronjob está ativo
      if (!config.cronjob || !config.cronjob.ativo) {
        console.log(
          `[VERIFICACAO-ESTOQUE] ⚠️ Cronjob desativado para tenant ${tenantId}`
        );
        return {
          success: false,
          message: 'Cronjob desativado',
          tenantId,
        };
      }

      // 3. Buscar produtos desatualizados
      const intervaloMinutos = config.cronjob.intervaloMinutos || 30;
      const produtosDesatualizados = await this.buscarProdutosDesatualizados(
        tenantId,
        intervaloMinutos
      );

      console.log(
        `[VERIFICACAO-ESTOQUE] Encontrados ${produtosDesatualizados.length} produto(s) desatualizado(s) para tenant ${tenantId}`
      );

      if (produtosDesatualizados.length === 0) {
        // Atualizar última execução mesmo sem produtos
        config.atualizarUltimaExecucao();
        await config.save();

        return {
          success: true,
          message: 'Nenhum produto desatualizado encontrado',
          tenantId,
          produtosProcessados: 0,
        };
      }

      // 4. Processar cada produto
      let produtosSincronizados = 0;
      let produtosIgnorados = 0;
      let erros = 0;

      for (const produto of produtosDesatualizados) {
        try {
          // Verificar anti-duplicação recente (últimas 5 minutos)
          const foiProcessadoRecentemente = await this.verificarAntiDuplicacaoRecente(
            produto.sku,
            tenantId,
            5 // minutos
          );

          if (foiProcessadoRecentemente) {
            console.log(
              `[VERIFICACAO-ESTOQUE] Produto ${produto.sku} foi processado recentemente, ignorando...`
            );
            produtosIgnorados++;
            continue;
          }

          // Buscar saldos atuais e comparar com última sincronização
          // Se mudou, sincronizar
          const precisaSincronizar = await this.verificarSePrecisaSincronizar(
            produto,
            tenantId,
            config
          );

          if (precisaSincronizar) {
            try {
              // Sincronizar estoque
              const resultado = await sincronizadorEstoqueService.sincronizarEstoque(
                produto.sku,
                tenantId,
                'cronjob'
              );

              // Verificar se a sincronização foi realmente bem-sucedida
              if (resultado.success) {
                produtosSincronizados++;
                console.log(
                  `[VERIFICACAO-ESTOQUE] ✅ Produto ${produto.sku} sincronizado com sucesso`
                );
              } else {
                erros++;
                console.error(
                  `[VERIFICACAO-ESTOQUE] ❌ Produto ${produto.sku} sincronizado com FALHAS:`,
                  resultado.estatisticas ? 
                    `${resultado.estatisticas.depositosAtualizadosComSucesso}/${resultado.estatisticas.totalDepositosCompartilhados} depósito(s) atualizado(s)` :
                    'Verifique os logs acima para detalhes'
                );
              }
            } catch (error) {
              // Verificar se é erro de produto composto (não é um erro crítico, apenas ignorar)
              if (error.message && error.message.includes('produto composto')) {
                produtosIgnorados++;
                console.log(
                  `[VERIFICACAO-ESTOQUE] ⚠️ Produto ${produto.sku} é composto e não pode ser sincronizado (ignorando)`
                );
                // Atualizar última sincronização para não tentar novamente
                await Produto.findOneAndUpdate(
                  { tenantId, sku: produto.sku },
                  { ultimaSincronizacao: new Date() }
                );
              } else {
                erros++;
                console.error(
                  `[VERIFICACAO-ESTOQUE] ❌ Erro ao sincronizar produto ${produto.sku}:`,
                  error.message
                );
              }
            }
          } else {
            // Atualizar última sincronização mesmo sem mudança
            await Produto.findOneAndUpdate(
              { tenantId, sku: produto.sku },
              { ultimaSincronizacao: new Date() }
            );
            produtosIgnorados++;
          }
        } catch (error) {
          erros++;
          console.error(
            `[VERIFICACAO-ESTOQUE] ❌ Erro ao processar produto ${produto.sku}:`,
            error.message
          );
        }
      }

      // 5. Atualizar estatísticas
      config.incrementarEstatistica('cronjob');
      config.atualizarUltimaExecucao();
      await config.save();

      const resultado = {
        success: true,
        tenantId,
        produtosProcessados: produtosDesatualizados.length,
        produtosSincronizados,
        produtosIgnorados,
        erros,
        processadoEm: new Date(),
      };

      console.log(
        `[VERIFICACAO-ESTOQUE] ✅ Verificação concluída para tenant ${tenantId}: ` +
          `${produtosSincronizados} sincronizado(s), ${produtosIgnorados} ignorado(s), ${erros} erro(s)`
      );

      return resultado;
    } catch (error) {
      console.error(
        `[VERIFICACAO-ESTOQUE] ❌ Erro crítico na verificação para tenant ${tenantId}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Busca produtos desatualizados (última sincronização > intervalo)
   * @param {string} tenantId - ID do tenant
   * @param {number} intervaloMinutos - Intervalo em minutos
   * @returns {Promise<Array>} Lista de produtos desatualizados
   */
  async buscarProdutosDesatualizados(tenantId, intervaloMinutos) {
    const agora = new Date();
    const intervaloMs = intervaloMinutos * 60 * 1000;
    const dataLimite = new Date(agora.getTime() - intervaloMs);

    // Buscar produtos com última sincronização > intervalo ou sem sincronização
    const produtos = await Produto.find({
      tenantId,
      $or: [
        { ultimaSincronizacao: { $lt: dataLimite } },
        { ultimaSincronizacao: { $exists: false } },
        { ultimaSincronizacao: null },
      ],
    })
      .select('sku tenantId ultimaSincronizacao')
      .limit(100) // Limitar a 100 produtos por execução para não sobrecarregar
      .lean();

    return produtos;
  }

  /**
   * Verifica se um produto foi processado recentemente (anti-duplicação)
   * @param {string} sku - SKU do produto
   * @param {string} tenantId - ID do tenant
   * @param {number} minutos - Janela de tempo em minutos
   * @returns {Promise<boolean>} true se foi processado recentemente
   */
  async verificarAntiDuplicacaoRecente(sku, tenantId, minutos = 5) {
    const agora = new Date();
    const janelaMs = minutos * 60 * 1000;
    const dataLimite = new Date(agora.getTime() - janelaMs);

    // Buscar eventos processados recentes para este produto
    const eventosRecentes = await EventoProcessado.find({
      tenantId,
      produtoId: sku,
      origem: 'cronjob',
      processadoEm: { $gte: dataLimite },
      sucesso: true,
    }).limit(1);

    return eventosRecentes.length > 0;
  }

  /**
   * Verifica se um produto precisa ser sincronizado
   * Compara saldos atuais com última sincronização registrada
   * @param {Object} produto - Produto a verificar
   * @param {string} tenantId - ID do tenant
   * @param {Object} config - Configuração de sincronização
   * @returns {Promise<boolean>} true se precisa sincronizar
   */
  async verificarSePrecisaSincronizar(produto, tenantId, config) {
    try {
      // Buscar saldos atuais dos 3 depósitos principais
      const saldos = await sincronizadorEstoqueService.buscarSaldosDepositos(
        produto.sku,
        tenantId,
        config
      );

      // Calcular soma atual
      const somaAtual = sincronizadorEstoqueService.calcularSoma(saldos);

      // Buscar último evento processado com sucesso para este produto
      const ultimoEvento = await EventoProcessado.findOne({
        tenantId,
        produtoId: produto.sku,
        sucesso: true,
      })
        .sort({ processadoEm: -1 })
        .lean();

      // Se não há evento anterior, precisa sincronizar
      if (!ultimoEvento || !ultimoEvento.saldos) {
        return true;
      }

      // Comparar soma atual com soma do último evento
      const somaAnterior = ultimoEvento.saldos.soma || 0;

      // Se a soma mudou, precisa sincronizar
      if (somaAtual !== somaAnterior) {
        console.log(
          `[VERIFICACAO-ESTOQUE] Produto ${produto.sku} mudou: ${somaAnterior} → ${somaAtual}`
        );
        return true;
      }

      // Verificar se algum saldo individual mudou (mais preciso)
      // Comparar saldos atuais (array) com saldos anteriores (objeto ou array)
      const saldosAnteriores = ultimoEvento.saldos || {};
      
      // Se saldos atuais é array, comparar cada depósito
      if (Array.isArray(saldos)) {
        for (const saldoAtual of saldos) {
          // Buscar saldo anterior correspondente (pode estar em formato objeto ou array)
          let saldoAnterior = 0;
          
          // Tentar encontrar por depositoId
          if (saldosAnteriores[saldoAtual.depositoId] !== undefined) {
            saldoAnterior = saldosAnteriores[saldoAtual.depositoId];
          } else if (Array.isArray(saldosAnteriores)) {
            const saldoEncontrado = saldosAnteriores.find(s => s.depositoId === saldoAtual.depositoId);
            saldoAnterior = saldoEncontrado?.valor || 0;
          }
          
          if (saldoAtual.valor !== saldoAnterior) {
            console.log(
              `[VERIFICACAO-ESTOQUE] Produto ${produto.sku} teve mudança em saldo do depósito ${saldoAtual.depositoId}: ${saldoAnterior} → ${saldoAtual.valor}`
            );
            return true;
          }
        }
      } else {
        // Fallback: se saldos não é array, comparar soma apenas
        // (compatibilidade com formato antigo)
        const somaAnterior = saldosAnteriores.soma || 0;
        if (somaAtual !== somaAnterior) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error(
        `[VERIFICACAO-ESTOQUE] Erro ao verificar se precisa sincronizar produto ${produto.sku}:`,
        error.message
      );
      // Em caso de erro, assume que precisa sincronizar (mais seguro)
      return true;
    }
  }

  /**
   * Busca todos os tenants com cronjob ativo
   * @returns {Promise<Array<string>>} Lista de tenantIds
   */
  async buscarTenantsAtivos() {
    const configs = await ConfiguracaoSincronizacao.find({
      'cronjob.ativo': true,
      ativo: true, // Sincronização geral também deve estar ativa
    }).select('tenantId');

    return configs.map((config) => config.tenantId);
  }
}

export default new VerificacaoEstoqueService();


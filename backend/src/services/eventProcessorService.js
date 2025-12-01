import ConfiguracaoSincronizacao from '../models/ConfiguracaoSincronizacao.js';
import EventoProcessado from '../models/EventoProcessado.js';
import sincronizadorEstoqueService from './sincronizadorEstoqueService.js';

/**
 * Serviço de Processamento de Eventos da Fila
 * 
 * Processa eventos de forma genérica (sem hardcoding):
 * - Verifica anti-duplicação
 * - Filtra por depósito (usando array genérico)
 * - Identifica origem (usando método genérico do model)
 * - Chama sincronização de estoque
 * - Registra resultado e atualiza estatísticas
 */
class EventProcessorService {
  /**
   * Processa um evento da fila
   * @param {Object} evento - Objeto do evento com: produtoId, eventoId, depositoId, tenantId, blingAccountId, tipo, dados
   * @param {string} tenantId - ID do tenant (pode vir do evento ou ser passado separadamente)
   * @returns {Promise<Object>} Resultado do processamento
   */
  async processarEvento(evento, tenantId = null) {
    if (!evento || typeof evento !== 'object') {
      console.warn('[EVENT-PROCESSOR] ⚠️ Evento inválido ou vazio:', evento);
      return {
        ignorado: true,
        motivo: 'Evento inválido ou vazio',
        evento,
      };
    }

    const tenantIdFinal = tenantId || evento.tenantId;

    if (!tenantIdFinal) {
      console.error('[EVENT-PROCESSOR] ❌ TenantId não fornecido no evento');
      return {
        ignorado: true,
        motivo: 'TenantId não fornecido',
        evento,
      };
    }

    if (!evento.produtoId || !evento.eventoId) {
      console.warn('[EVENT-PROCESSOR] ⚠️ Evento sem produtoId ou eventoId:', evento);
      return {
        ignorado: true,
        motivo: 'Evento sem identificadores obrigatórios (produtoId ou eventoId)',
        evento,
      };
    }

    console.log(
      `[EVENT-PROCESSOR] 📥 Processando evento - Produto: ${evento.produtoId}, Evento: ${evento.eventoId}, Tenant: ${tenantIdFinal}`
    );

    try {
      // 1. Buscar configuração
      const config = await ConfiguracaoSincronizacao.findOne({ tenantId: tenantIdFinal });

      if (!config) {
        console.warn(
          `[EVENT-PROCESSOR] ⚠️ Configuração não encontrada para tenant ${tenantIdFinal}`
        );
        return {
          ignorado: true,
          motivo: 'Configuração de sincronização não encontrada',
          tenantId: tenantIdFinal,
        };
      }

      if (!config.ativo) {
        console.log(
          `[EVENT-PROCESSOR] ⚠️ Sincronização inativa para tenant ${tenantIdFinal}`
        );
        return {
          ignorado: true,
          motivo: 'Sincronização inativa',
          tenantId: tenantIdFinal,
        };
      }

      // 2. Verificar anti-duplicação
      const chaveUnica = EventoProcessado.criarChaveUnica(evento.produtoId, evento.eventoId);

      const jaProcessado = await EventoProcessado.verificarSeProcessado(
        chaveUnica,
        tenantIdFinal
      );

      if (jaProcessado) {
        console.log(
          `[EVENT-PROCESSOR] ⚠️ Evento já processado - Chave: ${chaveUnica}, Tenant: ${tenantIdFinal}`
        );
        return {
          ignorado: true,
          motivo: 'Evento já processado',
          chaveUnica,
          tenantId: tenantIdFinal,
        };
      }

      // 3. Filtrar por depósito (genérico)
      if (evento.depositoId) {
        const deveProcessar = this.filtrarPorDeposito(evento.depositoId, config);

        if (!deveProcessar) {
          console.log(
            `[EVENT-PROCESSOR] ⚠️ Depósito ${evento.depositoId} não monitorado para tenant ${tenantIdFinal}`
          );
          return {
            ignorado: true,
            motivo: 'Depósito não monitorado',
            depositoId: evento.depositoId,
            tenantId: tenantIdFinal,
          };
        }
      }

      // 4. Identificar origem (genérico)
      const origem = evento.blingAccountId
        ? this.identificarOrigem(evento.blingAccountId, config)
        : 'webhook';

      console.log(
        `[EVENT-PROCESSOR] 🔍 Origem identificada: ${origem} (blingAccountId: ${evento.blingAccountId || 'não fornecido'})`
      );

      // 5. Processar sincronização
      let resultadoSincronizacao = null;
      let sucesso = false;
      let erro = null;

      try {
        resultadoSincronizacao = await sincronizadorEstoqueService.sincronizarEstoque(
          evento.produtoId,
          tenantIdFinal,
          origem
        );

        sucesso = resultadoSincronizacao?.success === true;

        console.log(
          `[EVENT-PROCESSOR] ✅ Sincronização concluída - Produto: ${evento.produtoId}, Sucesso: ${sucesso}`
        );
      } catch (errorSincronizacao) {
        erro = errorSincronizacao.message || String(errorSincronizacao);
        console.error(
          `[EVENT-PROCESSOR] ❌ Erro na sincronização - Produto: ${evento.produtoId}, Erro: ${erro}`
        );
      }

      // 6. Registrar evento processado
      try {
        await EventoProcessado.create({
          tenantId: tenantIdFinal,
          blingAccountId: evento.blingAccountId || null,
          produtoId: evento.produtoId,
          eventoId: evento.eventoId,
          chaveUnica,
          depositoOrigem: evento.depositoId || null,
          origem,
          sucesso,
          erro: erro || null,
          processadoEm: new Date(),
        });

        console.log(
          `[EVENT-PROCESSOR] 📝 Evento registrado - Chave: ${chaveUnica}, Sucesso: ${sucesso}`
        );
      } catch (errorRegistro) {
        // Log do erro, mas não falha o processamento
        console.error(
          `[EVENT-PROCESSOR] ⚠️ Erro ao registrar evento processado:`,
          errorRegistro.message
        );
      }

      // 7. Atualizar estatísticas da configuração
      try {
        config.incrementarEstatistica(origem);
        await config.save();

        console.log(
          `[EVENT-PROCESSOR] 📊 Estatísticas atualizadas - Origem: ${origem}, Tenant: ${tenantIdFinal}`
        );
      } catch (errorEstatisticas) {
        // Log do erro, mas não falha o processamento
        console.error(
          `[EVENT-PROCESSOR] ⚠️ Erro ao atualizar estatísticas:`,
          errorEstatisticas.message
        );
      }

      // 8. Retornar resultado
      return {
        processado: true,
        ignorado: false,
        sucesso,
        produtoId: evento.produtoId,
        eventoId: evento.eventoId,
        tenantId: tenantIdFinal,
        origem,
        chaveUnica,
        resultadoSincronizacao,
        erro: erro || null,
        processadoEm: new Date(),
      };
    } catch (error) {
      console.error(
        `[EVENT-PROCESSOR] ❌ Erro ao processar evento - Produto: ${evento.produtoId}, Erro:`,
        error.message
      );

      // Tentar registrar evento com erro
      try {
        const chaveUnica = EventoProcessado.criarChaveUnica(evento.produtoId, evento.eventoId);
        await EventoProcessado.create({
          tenantId: tenantIdFinal,
          blingAccountId: evento.blingAccountId || null,
          produtoId: evento.produtoId,
          eventoId: evento.eventoId,
          chaveUnica,
          depositoOrigem: evento.depositoId || null,
          origem: 'webhook',
          sucesso: false,
          erro: error.message || String(error),
          processadoEm: new Date(),
        });
      } catch (errorRegistro) {
        console.error(
          `[EVENT-PROCESSOR] ❌ Erro ao registrar evento com falha:`,
          errorRegistro.message
        );
      }

      throw error;
    }
  }

  /**
   * Filtra evento por depósito (genérico)
   *
   * Para webhooks queremos processar qualquer depósito que chegar,
   * pois a sincronização já usa a configuração (principais/compartilhados)
   * para decidir o que somar/atualizar. Aqui não devemos bloquear.
   *
   * @returns {boolean} sempre true (apenas loga)
   */
  filtrarPorDeposito(depositoId, config) {
    const depLog = depositoId ? `Depósito ${depositoId}` : 'Depósito não informado';
    const tenantLog = config?.tenantId ? ` - tenant ${config.tenantId}` : '';
    console.log(`[EVENT-PROCESSOR] 🔍 Processando evento de webhook: ${depLog}${tenantLog}`);
    return true;
  }

  /**
   * Identifica origem do evento (genérico)
   * Busca a conta Bling pelo blingAccountId e retorna o accountName
   * @param {string} blingAccountId - ID da conta Bling
   * @param {Object} config - Configuração de sincronização
   * @returns {string} Nome da conta ou 'desconhecida' se não encontrar
   */
  identificarOrigem(blingAccountId, config) {
    if (!blingAccountId || !config) {
      return 'webhook';
    }

    // Usa método genérico do model para buscar conta
    const conta = config.buscarContaPorBlingAccountId(blingAccountId);

    if (!conta || !conta.accountName) {
      console.log(
        `[EVENT-PROCESSOR] ⚠️ Conta Bling não encontrada para blingAccountId: ${blingAccountId}`
      );
      return 'desconhecida';
    }

    console.log(
      `[EVENT-PROCESSOR] 🔍 Origem identificada - blingAccountId: ${blingAccountId}, accountName: ${conta.accountName}`
    );

    return conta.accountName;
  }
}

export default new EventProcessorService();


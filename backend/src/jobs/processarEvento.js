/**
 * Worker para processar eventos da fila de estoque
 * 
 * Funcionalidades:
 * - Processa eventos da fila 'eventos-bling' usando BullMQ
 * - Retry automático: 3 tentativas
 * - Backoff exponencial: 2s, 4s, 8s
 * - Dead letter queue para eventos que falharam após todas as tentativas
 * - Remove jobs completados após 24h
 * 
 * @module jobs/processarEvento
 */

import { getQueueConnection } from '../services/queueService.js';
import eventProcessorService from '../services/eventProcessorService.js';

// Nome da fila (deve corresponder ao nome usado no queueService)
const QUEUE_NAME = 'eventos-bling';

// Instância do worker
let worker = null;

/**
 * Processa um evento da fila
 * @param {Object} job - Job do BullMQ com os dados do evento
 * @returns {Promise<Object>} Resultado do processamento
 */
async function processarEventoJob(job) {
  const { evento, tenantId } = job.data;

  console.log(
    `\n========================================`
  );
  console.log(`[Worker] 🚀 Processando evento - Job ID: ${job.id}`);
  console.log(`[Worker] 📦 Produto: ${evento?.produtoId || 'N/A'}`);
  console.log(`[Worker] 🏢 Tenant: ${tenantId || 'N/A'}`);
  console.log(`[Worker] 📋 Evento ID: ${evento?.eventoId || 'N/A'}`);
  console.log(
    `========================================\n`
  );

  try {
    // Chama o serviço de processamento de eventos
    const resultado = await eventProcessorService.processarEvento(
      evento,
      tenantId
    );

    if (resultado.ignorado) {
      console.log(
        `[Worker] ⚠️ Evento ignorado - Motivo: ${resultado.motivo}`
      );
      return {
        success: true,
        ignorado: true,
        motivo: resultado.motivo,
        ...resultado,
      };
    }

    if (resultado.sucesso) {
      console.log(
        `[Worker] ✅ Evento processado com sucesso - Produto: ${evento?.produtoId}`
      );
    } else {
      console.log(
        `[Worker] ⚠️ Evento processado com avisos - Produto: ${evento?.produtoId}`
      );
    }

    console.log(
      `\n========================================`
    );
    console.log(`[Worker] ✅ Job ${job.id} concluído`);
    console.log(
      `========================================\n`
    );

    return {
      success: true,
      ...resultado,
    };
  } catch (error) {
    console.error(
      `\n========================================`
    );
    console.error(`[Worker] ❌ Erro ao processar evento - Job ID: ${job.id}`);
    console.error(`[Worker] Erro: ${error.message}`);
    console.error(`[Worker] Stack: ${error.stack}`);
    console.error(
      `========================================\n`
    );

    // Re-throw para o BullMQ lidar com retry
    throw error;
  }
}

/**
 * Inicia o worker de processamento de eventos
 * @returns {Promise<Worker>} Instância do worker
 */
export async function iniciarWorker() {
  if (worker) {
    console.log('[Worker] ⚠️ Worker já está rodando');
    return worker;
  }

  try {
    // Importar BullMQ dinamicamente
    let Worker;
    try {
      const bullmq = await import('bullmq');
      Worker = bullmq.Worker;
    } catch (importError) {
      console.warn(
        '[Worker] ⚠️ BullMQ não está instalado. Worker não será iniciado.'
      );
      console.warn(
        '[Worker] ⚠️ Para usar o worker, instale: npm install bullmq ioredis'
      );
      console.warn(
        '[Worker] ⚠️ Eventos serão processados via fallback (setImmediate)'
      );
      return null;
    }

    // Obter conexão Redis
    const connection = await getQueueConnection();

    if (!connection) {
      console.warn(
        '[Worker] ⚠️ Conexão Redis não disponível. Worker não será iniciado.'
      );
      console.warn(
        '[Worker] ⚠️ Para usar o worker, instale: npm install bullmq ioredis'
      );
      console.warn(
        '[Worker] ⚠️ Eventos serão processados via fallback (setImmediate)'
      );
      return null;
    }

    console.log('\n========================================');
    console.log('🚀 Iniciando Worker de Processamento de Eventos');
    console.log('========================================\n');

    // Criar worker
    worker = new Worker(QUEUE_NAME, processarEventoJob, {
      connection,
      concurrency: 5, // Processa 5 jobs simultaneamente
      removeOnComplete: {
        count: 100, // Mantém no máximo 100 jobs completos
        age: 24 * 3600, // Remove após 24 horas
      },
      removeOnFail: {
        count: 1000, // Mantém no máximo 1000 jobs falhados
        age: 7 * 24 * 3600, // Remove após 7 dias
      },
      // Retry automático já configurado na fila (3 tentativas, backoff exponencial)
    });

    // Event handlers
    worker.on('ready', () => {
      console.log('[Worker] ✅ Worker pronto e aguardando jobs');
      console.log(`[Worker] 📋 Fila: ${QUEUE_NAME}`);
      console.log(`[Worker] ⚙️  Concorrência: 5 jobs simultâneos\n`);
    });

    worker.on('active', (job) => {
      console.log(
        `[Worker] 🔄 Processando job: ${job.id} (Tentativa: ${job.attemptsMade + 1}/${job.opts?.attempts || 3})`
      );
    });

    worker.on('completed', (job, result) => {
      console.log(
        `[Worker] ✅ Job ${job.id} concluído - Produto: ${result?.produtoId || 'N/A'}`
      );
    });

    worker.on('failed', (job, error) => {
      console.error(
        `[Worker] ❌ Job ${job?.id || 'desconhecido'} falhou após ${job?.attemptsMade || 0} tentativa(s)`
      );
      console.error(`[Worker] Erro: ${error.message}`);
      
      if (job?.attemptsMade >= (job?.opts?.attempts || 3)) {
        console.error(
          `[Worker] ⚠️ Job será movido para dead letter queue (máximo de tentativas atingido)`
        );
      }
    });

    worker.on('error', (error) => {
      console.error('[Worker] ❌ Erro no worker:', error);
    });

    worker.on('stalled', (jobId) => {
      console.warn(`[Worker] ⚠️ Job travado: ${jobId}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\n[Worker] 🛑 SIGTERM recebido, encerrando worker...');
      if (worker) {
        await worker.close();
      }
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('\n[Worker] 🛑 SIGINT recebido, encerrando worker...');
      if (worker) {
        await worker.close();
      }
      process.exit(0);
    });

    console.log('✅ Worker iniciado com sucesso\n');

    return worker;
  } catch (error) {
    console.error('[Worker] ❌ Erro ao iniciar worker:', error.message);
    console.error(
      '[Worker] ⚠️ Worker não será iniciado. Eventos serão processados via fallback.'
    );
    // Não lança erro para não quebrar o servidor
    // O sistema continuará funcionando com fallback
    return null;
  }
}

/**
 * Para o worker
 * @returns {Promise<void>}
 */
export async function pararWorker() {
  if (worker) {
    console.log('[Worker] 🛑 Parando worker...');
    await worker.close();
    worker = null;
    console.log('[Worker] ✅ Worker parado com sucesso');
  }
}

/**
 * Obtém a instância do worker (se estiver rodando)
 * @returns {Worker|null} Instância do worker ou null
 */
export function obterWorker() {
  return worker;
}

// Exportar para uso no app principal
export default {
  iniciarWorker,
  pararWorker,
  obterWorker,
};


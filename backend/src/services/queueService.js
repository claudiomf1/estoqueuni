/**
 * Queue Service - EstoqueUni
 * Gerenciamento de filas com BullMQ para processamento assíncrono de eventos
 */

let Queue = null;
let QueueEvents = null;
let connection = null;
let bullmqLoaded = false;

/**
 * Inicializa o serviço de fila (lazy loading)
 */
async function inicializarQueue() {
  if (bullmqLoaded) {
    return;
  }
  
  bullmqLoaded = true;
  
  // Tentar importar BullMQ
  try {
    const bullmq = await import('bullmq');
    Queue = bullmq.Queue;
    QueueEvents = bullmq.QueueEvents;
    
    // Configuração do Redis
    const RedisModule = await import('ioredis');
    const Redis = RedisModule.default;
    
    const REDIS_HOST = process.env.REDIS_HOST || 'redis';
    const REDIS_PORT = process.env.REDIS_PORT || 6379;
    const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
    const REDIS_DB = process.env.REDIS_DB || 0;
    
    // Cria conexão Redis
    connection = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      db: REDIS_DB,
      maxRetriesPerRequest: null, // Necessário para BullMQ
      enableReadyCheck: false,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
    
    // Log de conexão
    connection.on('connect', () => {
      console.log('[Queue] ✅ Conectado ao Redis');
    });
    
    connection.on('error', (error) => {
      console.error('[Queue] ❌ Erro na conexão Redis:', error.message);
    });
    
    console.log('[Queue] ✅ BullMQ disponível');
  } catch (error) {
    console.warn('[Queue] ⚠️ BullMQ não disponível, usando fallback (setImmediate)');
    console.warn('[Queue] Para usar filas Redis, instale: npm install bullmq ioredis');
  }
}

// Nome da fila de eventos
const QUEUE_NAME = 'eventos-bling';

// Cache da instância da fila
let eventQueue = null;

/**
 * Obtém ou cria a instância da fila de eventos
 * @returns {Promise<Queue|null>} Instância da fila ou null se BullMQ não estiver disponível
 */
export async function getEventQueue() {
  await inicializarQueue();
  
  if (!Queue || !connection) {
    return null;
  }
  
  if (!eventQueue) {
    eventQueue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Remove jobs completos após 24 horas
          count: 1000, // Mantém no máximo 1000 jobs completos
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Remove jobs falhados após 7 dias
        },
      },
    });
    
    console.log(`[Queue] ✅ Fila "${QUEUE_NAME}" criada`);
  }
  
  return eventQueue;
}

/**
 * Adiciona um evento na fila de processamento
 * @param {string} jobName - Nome do job (ex: 'processar-evento')
 * @param {Object} data - Dados do evento
 * @param {Object} options - Opções do job (opcional)
 * @returns {Promise<Object>} Job criado ou resultado do fallback
 */
export async function adicionarEventoNaFila(jobName, data, options = {}) {
  const queue = await getEventQueue();
  
  if (queue) {
    // Usar BullMQ
    try {
      const job = await queue.add(jobName, data, {
        ...options,
        jobId: options.jobId || `${jobName}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      });
      
      console.log(`[Queue] ✅ Evento adicionado na fila: ${job.id}`);
      return { success: true, jobId: job.id, method: 'bullmq' };
    } catch (error) {
      console.error('[Queue] ❌ Erro ao adicionar evento na fila:', error);
      // Fallback para setImmediate se falhar
      return await adicionarEventoFallback(jobName, data);
    }
  } else {
    // Fallback: processar imediatamente em background
    return await adicionarEventoFallback(jobName, data);
  }
}

/**
 * Fallback: processa evento imediatamente em background usando setImmediate
 * @param {string} jobName - Nome do job
 * @param {Object} data - Dados do evento
 * @returns {Promise<Object>} Resultado do processamento
 */
async function adicionarEventoFallback(jobName, data) {
  console.warn('[Queue] ⚠️ Usando fallback (setImmediate) - BullMQ não disponível');
  
  // Processar em background usando setImmediate
  setImmediate(async () => {
    try {
      // Importar dinamicamente o processador de eventos
      const eventProcessorService = await import('./eventProcessorService.js');
      const { default: processor } = eventProcessorService;
      
      if (processor && data.evento) {
        console.log('[Queue] 🔄 Processando evento via fallback:', {
          produtoId: data.evento.produtoId,
          eventoId: data.evento.eventoId,
          tenantId: data.tenantId || data.evento.tenantId,
        });
        
        await processor.processarEvento(data.evento, data.tenantId || data.evento.tenantId);
      } else {
        console.warn('[Queue] ⚠️ Dados do evento inválidos no fallback:', { jobName, data });
      }
    } catch (error) {
      console.error('[Queue] ❌ Erro ao processar evento (fallback):', error);
    }
  });
  
  return { success: true, method: 'fallback', message: 'Evento será processado em background' };
}

/**
 * Obtém a conexão Redis para uso em workers
 * @returns {Promise<Object|null>} Conexão Redis ou null se não estiver disponível
 */
export async function getQueueConnection() {
  await inicializarQueue();
  return connection;
}

/**
 * Verifica se a fila está disponível
 * @returns {Promise<boolean>} true se BullMQ está disponível
 */
export async function isQueueAvailable() {
  await inicializarQueue();
  return Queue !== null && connection !== null;
}

/**
 * Obtém estatísticas da fila
 * @returns {Promise<Object>} Estatísticas da fila
 */
export async function obterEstatisticasFila() {
  const queue = await getEventQueue();
  
  if (!queue) {
    return {
      disponivel: false,
      metodo: 'fallback',
      mensagem: 'BullMQ não disponível, usando fallback',
    };
  }
  
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);
    
    return {
      disponivel: true,
      metodo: 'bullmq',
      nome: QUEUE_NAME,
      estatisticas: {
        aguardando: waiting,
        processando: active,
        completados: completed,
        falhados: failed,
      },
    };
  } catch (error) {
    console.error('[Queue] ❌ Erro ao obter estatísticas:', error);
    return {
      disponivel: false,
      erro: error.message,
    };
  }
}


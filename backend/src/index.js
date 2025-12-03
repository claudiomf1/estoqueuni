import app from './app.js';
import { config } from './config/index.js';
import { connectDatabase } from './config/database.js';
import { iniciarWorker } from './jobs/processarEvento.js';

async function startServer() {
  try {
    // Conectar ao MongoDB 
    await connectDatabase();

    // Iniciar servidor com tratamento de erro para porta ocupada
    const server = app.listen(config.port, () => {
      console.log(`🚀 Servidor rodando na porta ${config.port} em modo ${config.env}`);
    });

    // Tratar erro de porta ocupada ANTES do servidor iniciar completamente
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Porta ${config.port} já está em uso.`);
        console.error(`   Isso pode causar loop de restart no PM2.`);
        console.error(`   Aguardando 5 segundos antes de encerrar para evitar loop...`);
        // Aguardar um pouco antes de encerrar para evitar loop de restart rápido
        setTimeout(() => {
          console.error(`   Encerrando processo para evitar loop de restart.`);
          process.exit(1);
        }, 5000);
      } else {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
      }
    });

    // Iniciar worker de eventos (BullMQ)
    try {
      await iniciarWorker();
      console.log('✅ Worker de eventos iniciado (BullMQ)');
    } catch (error) {
      console.warn(
        '⚠️  Worker não pôde iniciar (Redis pode não estar disponível):',
        error.message
      );
      console.warn('   Eventos podem ser processados via fallback síncrono.');
    }

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM recebido, encerrando servidor graciosamente');
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT recebido, encerrando servidor graciosamente');
      server.close(() => {
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
}
 
startServer();

import app from './app.js';
import { config } from './config/index.js';
import { connectDatabase } from './config/database.js';
import verificacaoEstoqueJob from './jobs/verificacaoEstoqueJob.js';

async function startServer() {
  try {
    // Conectar ao MongoDB 
    await connectDatabase();

    // Iniciar servidor
    const server = app.listen(config.port, () => {
      console.log(`🚀 Servidor rodando na porta ${config.port} em modo ${config.env}`);
    });

    // Iniciar job de verificação de estoque
    verificacaoEstoqueJob.iniciarCronjob();

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

import 'dotenv/config';
import app from './app.js';
import { config } from './config/index.js';
import { conectarMongoDB } from './config/database.js';
import { iniciarWorker } from './jobs/processarEvento.js';

const PORT = config.port;

/**
 * Inicia o servidor
 */
async function iniciarServidor() {
  try {
    // Conectar MongoDB
    await conectarMongoDB();
    console.log('✅ MongoDB conectado com sucesso');

    // Iniciar Worker (opcional - não quebra se Redis não estiver disponível)
    try {
      await iniciarWorker();
      console.log('✅ Worker de eventos iniciado');
    } catch (error) {
      console.warn(
        '⚠️  Worker não iniciado (Redis pode não estar disponível):',
        error.message
      );
      console.warn(
        '   O sistema continuará funcionando, mas eventos de webhook podem não ser processados.'
      );
    }

    // Iniciar servidor Express
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`   Ambiente: ${config.env}`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

iniciarServidor();







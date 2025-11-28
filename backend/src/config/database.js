import mongoose from 'mongoose';
import { config } from './index.js';

// Opções do Mongoose - authMechanism só se houver credenciais na URI
const getMongooseOptions = (mongoUri) => {
  const hasCredentials = /mongodb(?:\+srv)?:\/\/[^:@/]+:[^@]+@/.test(mongoUri);
  
  const options = {
    directConnection: true,
    retryWrites: false,
    readPreference: 'primary',
    family: 4,
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 60000,
    connectTimeoutMS: 20000,
  };

  // Só adiciona authMechanism se houver credenciais na URI
  if (hasCredentials) {
    options.authMechanism = 'SCRAM-SHA-256';
  }

  return options;
};

export const connectDatabase = async () => {
  try {
    // Se já está conectado, não reconecta
    if (mongoose.connection?.readyState === 1) {
      return;
    }

    const mongoUri = config.mongodbUri;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI não configurada');
    }

    const maskedUri = mongoUri.replace(
      /(mongodb(?:\+srv)?:\/\/[^:@/]+:)([^@]+)(@)/i,
      '$1***$3'
    );

    console.log(`[DB] Conectando ao MongoDB -> ${maskedUri}`);
    
    const mongooseOptions = getMongooseOptions(mongoUri);
    await mongoose.connect(mongoUri, mongooseOptions);

    console.log('✅ MongoDB conectado com sucesso');
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ Erro de conexão do Mongoose:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ Mongoose desconectado do banco de dados');
    });

    mongoose.connection.on('reconnected', () => {
      console.info('✅ Mongoose reconectado ao banco de dados');
    });
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    throw error;
  }
};

export default connectDatabase;

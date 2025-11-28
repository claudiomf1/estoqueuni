import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar .env da raiz do projeto estoqueuni (não da pasta backend)
// __dirname está em backend/src/config/, então ../../../ vai para a raiz do estoqueuni
const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

// Debug: verificar se .env foi carregado
if (process.env.MONGODB_URI_LOCAL) {
  console.log('[CONFIG] .env carregado com sucesso de:', envPath);
} else {
  console.warn('[CONFIG] ⚠️ .env não encontrado ou MONGODB_URI_LOCAL não definido. Caminho tentado:', envPath);
}

// Função auxiliar para parsear boolean
const parseBooleanEnv = (key) => {
  const value = process.env[key];
  if (!value) return false;
  const TRUE_SET = new Set(['1', 'true', 'on', 'yes']);
  return TRUE_SET.has(String(value).trim().toLowerCase());
};

// Função auxiliar para parsear número
const parseNumericEnv = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isInteger(parsed)) return parsed;
    }
  }
  return null;
};

// Resolver tipo de conexão (1=remota, 2=local)
const resolveTipoConexao = () => {
  // Tipo explícito
  const explicit = parseNumericEnv('PFM_DB_TIPO', 'DB_TIPO', 'ESTOQUEUNI_DB_TIPO');
  if (explicit === 1 || explicit === 2) {
    return explicit;
  }

  // Forçar local
  if (parseBooleanEnv('PFM_DB_FORCE_LOCAL') || parseBooleanEnv('ESTOQUEUNI_DB_FORCE_LOCAL')) {
    return 2;
  }

  // Forçar remoto
  if (
    parseBooleanEnv('PFM_DB_FORCE_REMOTE') ||
    parseBooleanEnv('PFM_DB_ONLINE') ||
    parseBooleanEnv('BANCO_ONLINE') ||
    parseBooleanEnv('ESTOQUEUNI_DB_FORCE_REMOTE')
  ) {
    return 1;
  }

  // Se produção, usar remoto
  if (process.env.NODE_ENV === 'production') {
    return 1;
  }

  // Padrão: local em desenvolvimento
  return 2;
};

// Resolver URI do MongoDB (mesma lógica do precofacilmarket)
const resolveMongoUri = () => {
  const tipo = resolveTipoConexao();

  if (tipo === 1) {
    // Remoto
    return (
      process.env.MONGODB_URI_REMOTE ||
      process.env.PFM_DB_URI_REMOTE ||
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/precofacilmarket'
    );
  } else {
    // Local
    return (
      process.env.MONGODB_URI_LOCAL ||
      process.env.PFM_DB_URI_LOCAL ||
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/precofacilmarket'
    );
  }
};

export const config = {
  // Porta do servidor:
  // - Prioriza variável específica do estoqueuni para evitar conflito com outros projetos
  // - Depois usa PORT genérico
  // - Padrão: 5010 (em vez de 5000, para reduzir chance de colisão)
  port: process.env.ESTOQUEUNI_PORT || process.env.PORT || 5010,
  env: process.env.NODE_ENV || 'development',
  mongodbUri: resolveMongoUri(),
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
    credentials: true,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'seu-secret-jwt-aqui',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
};

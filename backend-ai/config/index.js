import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega .env na seguinte ordem:
// 1) ESTOQUEUNI_ENV_PATH (se informado)
// 2) .env local do backend-ai
// 3) .env raiz do projeto
const appRoot = path.resolve(__dirname, "..", "..", "..");
const centralizedEnvPath = path.resolve(appRoot, ".env");
const localEnvPath = path.resolve(__dirname, "..", ".env");

const envCandidates = [
  process.env.ESTOQUEUNI_ENV_PATH,
  fs.existsSync(localEnvPath) ? localEnvPath : null,
  centralizedEnvPath,
].filter(Boolean);

for (const candidate of envCandidates) {
  dotenv.config({ path: candidate });
}

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on", "enabled"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n", "off", "disabled", ""].includes(normalized)) {
      return false;
    }
  }
  return fallback;
};

const skipExternalsFlag = parseBoolean(process.env.ESTOQUEUNI_SKIP_EXTERNALS, false);

const resolveMongoUri = () => {
  const dbTipo = parseInt(process.env.DB_TIPO || process.env.ESTOQUEUNI_DB_TIPO || "0", 10);

  if (dbTipo === 1) {
    // remoto
    return (
      process.env.MONGODB_URI_REMOTE ||
      process.env.PFM_DB_URI_REMOTE ||
      process.env.MONGODB_URI ||
      process.env.ESTOQUEUNI_MONGODB_URI
    );
  }

  if (dbTipo === 2) {
    // local
    return (
      process.env.MONGODB_URI_LOCAL ||
      process.env.PFM_DB_URI_LOCAL ||
      process.env.MONGODB_URI ||
      process.env.ESTOQUEUNI_MONGODB_URI
    );
  }

  // fallback: usa MONGODB_URI direto, depois remoto/local
  return (
    process.env.MONGODB_URI ||
    process.env.ESTOQUEUNI_MONGODB_URI ||
    process.env.MONGODB_URI_REMOTE ||
    process.env.MONGODB_URI_LOCAL
  );
};

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.ESTOQUEUNI_AI_PORT || process.env.PORT, 10) || 5001,
  host: process.env.ESTOQUEUNI_AI_HOST || "127.0.0.1",
  apiPrefix: process.env.API_PREFIX || "/api/v1",
  skipExternals: skipExternalsFlag,

  mongodb: {
    uri: resolveMongoUri(),
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  qdrant: {
    url: process.env.QDRANT_URL || "http://localhost:6333",
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: process.env.QDRANT_COLLECTION_NAME || "estoqueuni_docs",
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    embeddingModel:
      process.env.GEMINI_EMBEDDING_MODEL ||
      process.env.ESTOQUEUNI_GEMINI_EMBEDDING_MODEL ||
      "embedding-001",
  },

  jwt: {
    secret: process.env.JWT_SECRET || process.env.ESTOQUEUNI_JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 20,
  },

  logging: {
    level: process.env.LOG_LEVEL || "info",
    filePath: process.env.LOG_FILE_PATH || "./logs",
  },

  observability: {
    loki: {
      url: process.env.LOKI_URL || "",
      tenantId: process.env.LOKI_TENANT_ID || "",
    },
  },

  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5174",
  },

  docsPath: process.env.DOCS_PATH || path.resolve(__dirname, "..", "docs-estoqueuni"),
};

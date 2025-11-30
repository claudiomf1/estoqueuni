import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "./index.js";
import logger from "../src/utils/logger.js";

let qdrantClient = null;

const shouldUseMockQdrant = () =>
  config.skipExternals || process.env.NODE_ENV === "test";

const createMockQdrantClient = () => {
  const collections = new Map();

  const ensureCollectionExists = (name) => {
    if (!collections.has(name)) {
      collections.set(name, new Map());
    }
    return collections.get(name);
  };

  return {
    async getCollections() {
      return {
        collections: Array.from(collections.keys()).map((name) => ({
          name,
        })),
      };
    },
    async createCollection(name) {
      ensureCollectionExists(name);
      return { result: "mock-created" };
    },
    async upsert(name, { points = [] } = {}) {
      const collection = ensureCollectionExists(name);
      for (const point of points) {
        collection.set(point.id, point);
      }
      return { result: "mock-upserted", count: points.length };
    },
    async search(name, { limit = 10 } = {}) {
      const collection = ensureCollectionExists(name);
      return Array.from(collection.values())
        .slice(0, limit)
        .map((point) => ({
          id: point.id,
          score: 0.99,
          payload: point.payload,
        }));
    },
  };
};

export function getQdrantClient() {
  if (qdrantClient) {
    return qdrantClient;
  }

  if (shouldUseMockQdrant()) {
    qdrantClient = createMockQdrantClient();
    logger.info("✅ Using in-memory Qdrant mock");
    return qdrantClient;
  }

  qdrantClient = new QdrantClient({
    url: config.qdrant.url,
    apiKey: config.qdrant.apiKey,
  });

  logger.info("✅ Qdrant client initialized");

  return qdrantClient;
}

export async function ensureCollection() {
  const client = getQdrantClient();
  const collectionName = config.qdrant.collectionName;
  const canFallbackToMock = config.env !== "production" || config.skipExternals;

  if (shouldUseMockQdrant()) {
    await client.createCollection(collectionName);
    return;
  }

  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === collectionName
    );

    if (!exists) {
      await client.createCollection(collectionName, {
        vectors: {
          size: 768, // Gemini embedding dimension
          distance: "Cosine",
        },
      });
      logger.info(`✅ Qdrant collection '${collectionName}' created`);
    } else {
      logger.info(`✅ Qdrant collection '${collectionName}' already exists`);
    }
  } catch (error) {
    logger.error("❌ Error ensuring Qdrant collection:", error);
    if (!canFallbackToMock) {
      throw error;
    }

    logger.warn("⚠️ Qdrant indisponível. Continuando com mock em memória (features de vetor desativadas)");
    qdrantClient = createMockQdrantClient();
    await qdrantClient.createCollection(collectionName);
  }
}


















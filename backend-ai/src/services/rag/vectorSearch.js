import axios from "axios";
import crypto from "crypto";
import { getQdrantClient } from "../../../config/vectordb.js";
import { config } from "../../../config/index.js";
import { EmbeddingsService } from "./embeddingsService.js";
import logger from "../../utils/logger.js";

export class VectorSearch {
  constructor() {
    this.client = getQdrantClient();
    this.collectionName = config.qdrant.collectionName;
    this.embeddingsService = new EmbeddingsService();
  }

  async indexDocuments(documents) {
    try {
      const points = [];

      for (const doc of documents) {
        const embedding = await this.embeddingsService.generateEmbedding(
          doc.content
        );

        points.push({
          id: doc.id,
          vector: embedding,
          payload: {
            filePath: doc.filePath,
            title: doc.title,
            category: doc.category,
            tags: doc.tags,
            content: doc.content,
            metadata: doc.metadata,
          },
        });
      }

      // Upsert in batches
      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        try {
          await this.client.upsert(this.collectionName, {
            wait: true,
            points: batch,
          });
          logger.info(
            `Indexed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
              points.length / batchSize
            )}`
          );
        } catch (error) {
          const message = error?.response?.data || error?.message || error;
          logger.warn("Upsert via client failed, trying legacy format:", message);
          await this.upsertLegacy(batch);
        }
      }

      logger.info(`✅ Indexed ${points.length} document chunks`);
    } catch (error) {
      logger.error("Error indexing documents:", error);
      throw error;
    }
  }

  async search(query, options = {}) {
    const { topK = 10, filter = null, scoreThreshold = 0.7 } = options;

    try {
      const queryEmbedding = await this.embeddingsService.generateEmbedding(
        query
      );

      const searchParams = {
        vector: queryEmbedding,
        limit: topK,
        score_threshold: scoreThreshold,
      };

      if (filter) {
        searchParams.filter = filter;
      }

      const results = await this.client.search(
        this.collectionName,
        searchParams
      );

      return results.map((result) => ({
        id: result.id,
        score: result.score,
        ...result.payload,
      }));
    } catch (error) {
      logger.error("Error searching vectors:", error);
      throw error;
    }
  }

  async upsertLegacy(points) {
    // Compatibilidade com versões antigas do Qdrant que esperam ids/vectors/payloads separados
    const toNumericId = (rawId) => {
      if (typeof rawId === "number") return rawId;
      const idString = String(rawId);
      const hash = crypto.createHash("sha256").update(idString).digest();
      const high = hash.readUInt32BE(0);
      const low = hash.readUInt32BE(4);
      const numeric = (high * 0x100000000 + low) % Number.MAX_SAFE_INTEGER;
      return numeric || low || idString.length;
    };

    const ids = points.map((p) => toNumericId(p.id));
    const vectors = points.map((p) => p.vector);
    const payloads = points.map((p) => p.payload);

    const url = `${config.qdrant.url.replace(/\/$/, "")}/collections/${this.collectionName}/points`;

    const body = {
      ids,
      vectors,
      payloads,
    };

    try {
      const response = await axios.post(url, body, {
        headers: { "Content-Type": "application/json" },
      });

      logger.info(
        `Indexed batch via legacy format (${ids.length} points): ${response.status}`
      );
    } catch (error) {
      const details =
        error?.response?.data ||
        error?.message ||
        "Erro desconhecido ao tentar upsert legacy no Qdrant";
      logger.error(
        "Legacy upsert failed:",
        typeof details === "object" ? JSON.stringify(details) : details
      );
      throw error;
    }
  }
}















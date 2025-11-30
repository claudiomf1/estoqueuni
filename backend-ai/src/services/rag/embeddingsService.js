import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../../../config/index.js";
import logger from "../../utils/logger.js";

const shouldUseMockEmbeddings =
  config.skipExternals || 
  process.env.NODE_ENV === "test";

export class EmbeddingsService {
  constructor() {
    this.useMock = shouldUseMockEmbeddings;
    
    // Se não tiver API key configurada, lança erro
    if (!this.useMock && !config.gemini.apiKey) {
      const error = new Error("GEMINI_API_KEY não configurada. Configure a variável de ambiente GEMINI_API_KEY.");
      logger.error("❌ Gemini API key not configured:", error.message);
      throw error;
    }
    
    if (!this.useMock) {
      try {
        this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
        this.model = this.genAI.getGenerativeModel({
          model: config.gemini.embeddingModel || "embedding-001",
        });
        logger.info("✅ Gemini embeddings service initialized successfully");
      } catch (error) {
        logger.error("❌ Failed to initialize Gemini embeddings:", error.message);
        throw error;
      }
    } else {
      logger.info("ℹ️ Using mock embeddings (skipExternals or test mode)");
    }
  }

  generateMockEmbedding(text = "") {
    const charCodes = Array.from(text).map((char) => char.charCodeAt(0));
    const vectorSize = 32;
    const vector = Array(vectorSize).fill(0);

    charCodes.forEach((code, index) => {
      const bucket = index % vectorSize;
      vector[bucket] = (vector[bucket] + code / 255) % 1;
    });

    return vector;
  }

  async generateEmbedding(text) {
    if (this.useMock) {
      return this.generateMockEmbedding(text);
    }

    // Sem fallback para mock - falha se a API não funcionar
    try {
      const result = await this.model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      logger.error("❌ Error generating embedding from Gemini API:", error.message);
      // Re-lança o erro sem fallback para mock
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  async generateEmbeddingsBatch(texts, batchSize = 10) {
    const embeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map((text) => this.generateEmbedding(text))
      );
      embeddings.push(...batchEmbeddings);

      if (!this.useMock) {
        logger.info(
          `Generated embeddings for batch ${
            Math.floor(i / batchSize) + 1
          }/${Math.ceil(texts.length / batchSize)}`
        );
        await this.sleep(1000);
      }
    }

    return embeddings;
  }

  sleep(ms) {
    if (this.useMock) {
      return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

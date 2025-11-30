import { HybridRetrieval } from "./hybridRetrieval.js";
import { ContextOptimizer } from "./contextOptimizer.js";
import { UpdatePipeline } from "./updatePipeline.js";
import logger from "../../utils/logger.js";

export class RAGService {
  constructor(docsPath) {
    this.docsPath = docsPath;
    this.retrieval = new HybridRetrieval();
    this.optimizer = new ContextOptimizer();
    this.pipeline = new UpdatePipeline(docsPath);
  }

  async initialize() {
    await this.pipeline.initialIndex();
    this.pipeline.startWatching();
  }

  async retrieveContext(query, options = {}) {
    const { topK = 5 } = options;

    try {
      // Retrieve relevant documents
      const documents = await this.retrieval.retrieve(query, { topK });

      // Optimize context for token limit
      const optimized = this.optimizer.optimize(query, documents);

      // Format for prompt
      const formattedContext = this.optimizer.formatContext(
        optimized.documents
      );

      return {
        context: formattedContext,
        sources: optimized.documents.map((doc) => doc.title),
        metadata: {
          documentCount: optimized.documents.length,
          estimatedTokens: optimized.totalTokens,
        },
      };
    } catch (error) {
      logger.error("Error retrieving context:", error);
      throw error;
    }
  }

  shutdown() {
    this.pipeline.stopWatching();
  }
}

export * from "./documentProcessor.js";
export * from "./embeddingsService.js";
export * from "./vectorSearch.js";
export * from "./keywordSearch.js";
export * from "./hybridRetrieval.js";
export * from "./reranker.js";
export * from "./contextOptimizer.js";
export * from "./updatePipeline.js";





















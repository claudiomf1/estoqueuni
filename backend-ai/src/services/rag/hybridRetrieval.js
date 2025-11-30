import { VectorSearch } from "./vectorSearch.js";
import { KeywordSearch } from "./keywordSearch.js";
import { Reranker } from "./reranker.js";
import logger from "../../utils/logger.js";

export class HybridRetrieval {
  constructor() {
    this.vectorSearch = new VectorSearch();
    this.keywordSearch = new KeywordSearch();
    this.reranker = new Reranker();
  }

  async indexDocuments(documents) {
    // Index for both vector and keyword search
    await this.vectorSearch.indexDocuments(documents);
    this.keywordSearch.indexDocuments(documents);
  }

  async retrieve(query, options = {}) {
    const { topK = 5, vectorWeight = 0.7, keywordWeight = 0.3 } = options;

    try {
      // Parallel retrieval
      const [vectorResults, keywordResults] = await Promise.all([
        this.vectorSearch.search(query, { topK: topK * 2 }),
        Promise.resolve(this.keywordSearch.search(query, { topK: topK * 2 })),
      ]);

      // Combine results
      const combined = this.combineResults(
        vectorResults,
        keywordResults,
        vectorWeight,
        keywordWeight
      );

      // Re-rank
      const reranked = await this.reranker.rerank(query, combined, topK);

      logger.info(
        `Retrieved ${reranked.length} documents for query: "${query}"`
      );

      return reranked;
    } catch (error) {
      logger.error("Error in hybrid retrieval:", error);
      throw error;
    }
  }

  combineResults(vectorResults, keywordResults, vectorWeight, keywordWeight) {
    const resultsMap = new Map();

    // Add vector results
    for (const result of vectorResults) {
      resultsMap.set(result.id, {
        ...result,
        combinedScore: result.score * vectorWeight,
        vectorScore: result.score,
        keywordScore: 0,
      });
    }

    // Normalize keyword scores (they're typically much higher)
    const maxKeywordScore = Math.max(...keywordResults.map((r) => r.score), 1);

    // Add/update with keyword results
    for (const result of keywordResults) {
      const normalizedScore = result.score / maxKeywordScore;

      if (resultsMap.has(result.id)) {
        const existing = resultsMap.get(result.id);
        existing.combinedScore += normalizedScore * keywordWeight;
        existing.keywordScore = normalizedScore;
      } else {
        resultsMap.set(result.id, {
          ...result,
          combinedScore: normalizedScore * keywordWeight,
          vectorScore: 0,
          keywordScore: normalizedScore,
        });
      }
    }

    // Convert to array and sort
    return Array.from(resultsMap.values()).sort(
      (a, b) => b.combinedScore - a.combinedScore
    );
  }
}





















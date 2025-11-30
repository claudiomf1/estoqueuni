import logger from "../../utils/logger.js";

export class Reranker {
  async rerank(query, documents, topK) {
    // Simple reranking based on:
    // 1. Combined score
    // 2. Recency (more recent docs get slight boost)
    // 3. Category relevance (if query mentions specific categories)

    const queryLower = query.toLowerCase();
    const now = new Date();

    const reranked = documents.map((doc) => {
      let score = doc.combinedScore;

      // Recency boost (docs updated in last 30 days get small boost)
      if (doc.metadata?.lastUpdate) {
        const docDate = new Date(doc.metadata.lastUpdate);
        const daysSinceUpdate = (now - docDate) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 30) {
          score += 0.05;
        }
      }

      // Category relevance boost
      const categoryKeywords = {
        produtos: ["produto", "cadastro", "item", "sku"],
        precos: ["preço", "precificação", "margem", "lucro", "custo"],
        marketplaces: ["marketplace", "mercado livre", "shopee", "magalu"],
        regras: ["regra", "frete", "desconto"],
      };

      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (doc.category === category) {
          for (const keyword of keywords) {
            if (queryLower.includes(keyword)) {
              score += 0.1;
              break;
            }
          }
        }
      }

      return {
        ...doc,
        finalScore: score,
      };
    });

    // Sort by final score and return top K
    const result = reranked
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, topK);

    logger.info(`Reranked to top ${result.length} documents`);

    return result;
  }
}





















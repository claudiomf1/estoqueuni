import logger from "../../utils/logger.js";

export class KeywordSearch {
  constructor() {
    this.documents = [];
  }

  indexDocuments(documents) {
    this.documents = documents;
    logger.info(`✅ Indexed ${documents.length} documents for keyword search`);
  }

  search(query, options = {}) {
    const { topK = 10 } = options;

    const queryTerms = this.tokenize(query.toLowerCase());
    const results = [];

    for (const doc of this.documents) {
      const docTokens = this.tokenize(doc.content.toLowerCase());
      const titleTokens = this.tokenize(doc.title.toLowerCase());
      const tagTokens = doc.tags.map((tag) => tag.toLowerCase());

      let score = 0;

      // Exact phrase match (highest weight)
      if (doc.content.toLowerCase().includes(query.toLowerCase())) {
        score += 10;
      }

      // Title match (high weight)
      for (const term of queryTerms) {
        if (titleTokens.includes(term)) {
          score += 5;
        }
      }

      // Tag match (high weight)
      for (const term of queryTerms) {
        if (tagTokens.includes(term)) {
          score += 3;
        }
      }

      // Content term match (medium weight)
      for (const term of queryTerms) {
        const count = docTokens.filter((t) => t === term).length;
        score += count * 0.5;
      }

      if (score > 0) {
        results.push({
          ...doc,
          score,
        });
      }
    }

    // Sort by score and return top K
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  tokenize(text) {
    return text
      .replace(/[^\w\sáàâãéèêíïóôõöúçñ]/gi, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2);
  }
}





















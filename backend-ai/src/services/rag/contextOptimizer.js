import logger from "../../utils/logger.js";

export class ContextOptimizer {
  constructor(maxTokens = 4000) {
    this.maxTokens = maxTokens;
  }

  optimize(query, documents) {
    // Estimate tokens (rough: 1 token ≈ 4 characters)
    let totalTokens = this.estimateTokens(query);
    const optimized = [];

    for (const doc of documents) {
      const docTokens = this.estimateTokens(doc.content);

      if (totalTokens + docTokens <= this.maxTokens) {
        optimized.push(doc);
        totalTokens += docTokens;
      } else {
        // Try to include truncated version
        const remainingTokens = this.maxTokens - totalTokens;
        if (remainingTokens > 100) {
          const truncatedContent = this.truncate(doc.content, remainingTokens);
          optimized.push({
            ...doc,
            content: truncatedContent,
            truncated: true,
          });
        }
        break;
      }
    }

    logger.info(
      `Optimized context: ${optimized.length} documents, ~${totalTokens} tokens`
    );

    return {
      documents: optimized,
      totalTokens,
    };
  }

  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  truncate(text, maxTokens) {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;

    return text.substring(0, maxChars) + "...";
  }

  formatContext(documents) {
    return documents
      .map(
        (doc, index) => `
--- DOCUMENTO ${index + 1}: ${doc.title} ---
Categoria: ${doc.category}
Tags: ${doc.tags.join(", ")}

${doc.content}
    `
      )
      .join("\n\n");
  }
}





















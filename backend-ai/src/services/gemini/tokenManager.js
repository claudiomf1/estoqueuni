import logger from "../../utils/logger.js";

export class TokenManager {
  estimateTokens(text) {
    // Rough estimation: 1 token ≈ 4 characters for PT-BR
    // Gemini uses SentencePiece, but this is close enough
    return Math.ceil(text.length / 4);
  }

  async countTokens(text) {
    // For now, use estimation
    // Future: use Gemini's countTokens API if available
    return this.estimateTokens(text);
  }

  checkTokenLimit(text, limit) {
    const tokens = this.estimateTokens(text);

    if (tokens > limit) {
      logger.warn(`Text exceeds token limit: ${tokens} > ${limit}`);
      return false;
    }

    return true;
  }

  truncateToTokenLimit(text, limit) {
    const estimatedChars = limit * 4;

    if (text.length <= estimatedChars) {
      return text;
    }

    return text.substring(0, estimatedChars) + "...";
  }
}





















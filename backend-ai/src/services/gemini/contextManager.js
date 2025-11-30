import { TokenManager } from "./tokenManager.js";
import logger from "../../utils/logger.js";

export class ContextManager {
  constructor(maxTokens = 8000) {
    this.maxTokens = maxTokens;
    this.tokenManager = new TokenManager();
  }

  manageHistory(conversationHistory, systemPrompt, currentMessage) {
    // Calculate tokens used by system prompt and current message
    const systemTokens = this.tokenManager.estimateTokens(systemPrompt);
    const currentTokens = this.tokenManager.estimateTokens(currentMessage);

    let availableTokens = this.maxTokens - systemTokens - currentTokens - 500; // 500 buffer

    // Trim history from oldest if needed
    const managedHistory = [];

    // Start from most recent and work backwards
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      const msgTokens = this.tokenManager.estimateTokens(msg.content);

      if (availableTokens - msgTokens >= 0) {
        managedHistory.unshift(msg);
        availableTokens -= msgTokens;
      } else {
        logger.info(`Trimmed ${i + 1} oldest messages from history`);
        break;
      }
    }

    return managedHistory;
  }

  summarizeOldMessages(messages) {
    // Future enhancement: use Gemini to summarize old messages
    // For now, just truncate
    const summary = `[Resumo da conversa anterior: ${messages.length} mensagens]`;
    return { role: "system", content: summary };
  }
}





















import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../../../config/index.js";
import logger from "../../utils/logger.js";
import { PromptTemplates } from "./promptTemplates.js";
import { ContextManager } from "./contextManager.js";
import { TokenManager } from "./tokenManager.js";
import { recordIARequestMetrics } from "../../utils/metrics.js";

export class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: config.gemini.model,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });
    this.promptTemplates = new PromptTemplates();
    this.contextManager = new ContextManager();
    this.tokenManager = new TokenManager();
  }

  async generateResponse(userMessage, options = {}) {
    const {
      conversationHistory = [],
      retrievedContext = null,
      streaming = false,
    } = options;

    try {
      // Build system prompt
      const systemPrompt =
        this.promptTemplates.buildSystemPrompt(retrievedContext);

      // Manage context (trim if needed)
      const managedHistory = this.contextManager.manageHistory(
        conversationHistory,
        systemPrompt,
        userMessage
      );

      // Build chat history
      const history = [
        { role: "user", parts: [{ text: systemPrompt }] },
        {
          role: "model",
          parts: [{ text: "Entendido! Estou pronto para ajudar." }],
        },
        ...managedHistory.map((msg) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        })),
      ];

      const chat = this.model.startChat({ history });

      const startTime = Date.now();

      if (streaming) {
        return this.streamResponse(chat, userMessage, startTime);
      } else {
        const result = await chat.sendMessage(userMessage);
        const response = result.response.text();
        const processingTime = Date.now() - startTime;
        const tokensUsed = await this.tokenManager.countTokens(response);

        recordIARequestMetrics({
          provider: "gemini",
          route: "ai.chat.generate",
          status: 200,
          durationMs: processingTime,
          completionTokens: tokensUsed,
          model: config.gemini.model,
        });

        return {
          content: response,
          metadata: {
            processingTime,
            tokensUsed,
          },
        };
      }
    } catch (error) {
      logger.error("Error generating response:", error);
      recordIARequestMetrics({
        provider: "gemini",
        route: "ai.chat.generate",
        status: error?.response?.status || 500,
        durationMs: Date.now() - startTime,
        errorCode: error.code || error.name || "unknown",
        model: config.gemini.model,
      });
      throw error;
    }
  }

  async *streamResponse(chat, userMessage, startTime) {
    try {
      const result = await chat.sendMessageStream(userMessage);

      let fullText = "";

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;

        yield {
          type: "chunk",
          content: chunkText,
        };
      }

      const processingTime = Date.now() - startTime;
      const tokensUsed = await this.tokenManager.countTokens(fullText);

      recordIARequestMetrics({
        provider: "gemini",
        route: "ai.chat.stream",
        status: 200,
        durationMs: processingTime,
        completionTokens: tokensUsed,
        model: config.gemini.model,
      });

      yield {
        type: "done",
        metadata: {
          processingTime,
          tokensUsed,
          fullContent: fullText,
        },
      };
    } catch (error) {
      logger.error("Error streaming response:", error);
      recordIARequestMetrics({
        provider: "gemini",
        route: "ai.chat.stream",
        status: error?.response?.status || 500,
        durationMs: Date.now() - startTime,
        errorCode: error.code || error.name || "unknown",
        model: config.gemini.model,
      });
      yield {
        type: "error",
        error: error.message,
      };
    }
  }

  async classifyQuestion(question) {
    try {
      const prompt = this.promptTemplates.buildClassificationPrompt(question);
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Parse JSON response
      const classification = JSON.parse(response.trim());

      return classification;
    } catch (error) {
      logger.error("Error classifying question:", error);
      recordIARequestMetrics({
        provider: "gemini",
        route: "ai.chat.classify",
        status: error?.response?.status || 500,
        durationMs: 0,
        errorCode: error.code || error.name || "unknown",
        model: config.gemini.model,
      });
      // Default to general if classification fails
      return {
        isPrecofacilmarketRelated: false,
        confidence: 0.5,
        category: "general",
      };
    }
  }
}





















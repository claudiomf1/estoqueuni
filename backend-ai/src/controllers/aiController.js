import { RAGService } from "../services/rag/index.js";
import { GeminiService } from "../services/gemini/index.js";
import { ResponseVerifier } from "../services/verification/responseVerifier.js";
import { ConfidenceScorer } from "../services/verification/confidenceScorer.js";
import { FallbackHandler } from "../services/verification/fallbackHandler.js";
import { StreamHandler } from "../services/gemini/streamHandler.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { ApiResponse } from "../utils/response.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import logger from "../utils/logger.js";
import { config } from "../../config/index.js";

// Initialize services (singleton)
let ragService = null;
let ragServiceAvailable = false;

try {
  ragService = new RAGService(config.docsPath);
  // Initialize RAG on first import - gracefully handle errors
  ragService
    .initialize()
    .then(() => {
      ragServiceAvailable = true;
      logger.info("✅ RAG service initialized successfully");
    })
    .catch((err) => {
      logger.warn("⚠️ RAG initialization failed, continuing without RAG:", err.message);
      ragServiceAvailable = false;
    });
} catch (error) {
  logger.warn("⚠️ Failed to create RAG service, continuing without RAG:", error.message);
  ragServiceAvailable = false;
}

const geminiService = new GeminiService();
const verifier = new ResponseVerifier();
const scorer = new ConfidenceScorer();
const fallbackHandler = new FallbackHandler();

export const chat = asyncHandler(async (req, res) => {
  const { message, conversationId, streaming = false } = req.body;
  const { user } = req;

  if (!message || !message.trim()) {
    return res.status(400).json(
      ApiResponse.error("Mensagem é obrigatória", 400)
    );
  }

  const startTime = Date.now();

  // Get or create conversation
  let conversation;
  if (conversationId) {
    conversation = await Conversation.findOne({
      _id: conversationId,
      tenantId: user.tenantId,
    });
    if (!conversation) {
      return res.status(404).json(
        ApiResponse.error("Conversa não encontrada", 404)
      );
    }
  } else {
    conversation = await Conversation.create({
      tenantId: user.tenantId,
      userId: user.id,
      title: message.substring(0, 50),
    });
  }

  // Get conversation history
  const history = await Message.find({
    conversationId: conversation._id,
  })
    .sort({ createdAt: 1 })
    .limit(20)
    .lean();

  // Retrieve context from RAG if available
  let context = null;
  if (ragServiceAvailable) {
    try {
      context = await ragService.retrieveContext(message, { topK: 5 });
    } catch (error) {
      logger.warn("Error retrieving context:", error);
    }
  }

  // Classify question
  let classification;
  try {
    classification = await geminiService.classifyQuestion(message);
  } catch (error) {
    logger.warn("Error classifying question:", error);
    classification = {
      isEstoqueuniRelated: false,
      confidence: 0.5,
      category: "general",
    };
  }

  // Save user message
  const userMessage = await Message.create({
    conversationId: conversation._id,
    role: "user",
    content: message,
    category: classification.category,
  });

  if (streaming) {
    // Streaming response
    const generator = await geminiService.generateResponse(message, {
      conversationHistory: history,
      retrievedContext: context,
      streaming: true,
    });

    await StreamHandler.handleStream(generator, res);
  } else {
    // Non-streaming response
    const response = await geminiService.generateResponse(message, {
      conversationHistory: history,
      retrievedContext: context,
      streaming: false,
    });

    // Verify response
    const verification = await verifier.verifyResponse(
      message,
      response.content,
      context
    );

    // Calculate confidence
    const confidence = scorer.calculateConfidence({
      retrievedDocs: context?.sources || [],
      verificationResult: verification,
      questionCategory: classification.category,
      responseLength: response.content.length,
    });

    // Handle fallback
    const finalResponse = fallbackHandler.handleLowConfidence(
      message,
      response.content,
      confidence,
      { sources: context?.sources || [], retrievedDocs: [] }
    );

    // Save assistant message
    const assistantMessage = await Message.create({
      conversationId: conversation._id,
      role: "assistant",
      content: finalResponse.answer,
      category: classification.category,
      metadata: {
        sources: context?.sources || [],
        confidence: confidence.score,
        processingTime: Date.now() - startTime,
      },
    });

    return ApiResponse.success(res, {
      answer: finalResponse.answer,
      conversationId: conversation._id.toString(),
      messageId: assistantMessage._id.toString(),
      sources: context?.sources || [],
      confidence: confidence.score,
    });
  }
});

export const getConversations = asyncHandler(async (req, res) => {
  const { user } = req;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const conversations = await Conversation.find({ tenantId: user.tenantId })
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await Conversation.countDocuments({ tenantId: user.tenantId });

  return ApiResponse.success(res, {
    conversations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getConversation = asyncHandler(async (req, res) => {
  const { user } = req;
  const { id } = req.params;

  const conversation = await Conversation.findOne({
    _id: id,
    tenantId: user.tenantId,
  });

  if (!conversation) {
    return res.status(404).json(ApiResponse.error("Conversa não encontrada", 404));
  }

  const messages = await Message.find({ conversationId: id })
    .sort({ createdAt: 1 })
    .lean();

  return ApiResponse.success(res, {
    conversation,
    messages,
  });
});

export const deleteConversation = asyncHandler(async (req, res) => {
  const { user } = req;
  const { id } = req.params;

  const conversation = await Conversation.findOneAndDelete({
    _id: id,
    tenantId: user.tenantId,
  });

  if (!conversation) {
    return res.status(404).json(ApiResponse.error("Conversa não encontrada", 404));
  }

  // Delete all messages
  await Message.deleteMany({ conversationId: id });

  return ApiResponse.success(res, { message: "Conversa deletada com sucesso" });
});

export const submitFeedback = asyncHandler(async (req, res) => {
  const { messageId, type, rating, comment } = req.body;

  // Implementation for feedback
  return ApiResponse.success(res, { message: "Feedback registrado" });
});





import express from "express";
import * as aiController from "../controllers/aiController.js";
import { authenticate } from "../middleware/auth.js";
import { rateLimitMiddleware } from "../middleware/rateLimiter.js";
import {
  validateChatMessage,
  validateFeedback,
  validatePagination,
} from "../middleware/validateAI.js";

const router = express.Router();

// All AI routes require authentication
router.use(authenticate);

// Chat endpoint
router.post(
  "/chat",
  rateLimitMiddleware,
  validateChatMessage,
  aiController.chat
);

// Conversations
router.get("/conversations", validatePagination, aiController.getConversations);
router.get("/conversations/:id", aiController.getConversation);
router.delete("/conversations/:id", aiController.deleteConversation);

// Feedback
router.post("/feedback", validateFeedback, aiController.submitFeedback);

export default router;







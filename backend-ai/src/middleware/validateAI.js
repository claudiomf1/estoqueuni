import { body, query, validationResult } from "express-validator";
import { ValidationError } from "../utils/errors.js";

export const validateChatMessage = [
  body("message")
    .trim()
    .notEmpty()
    .withMessage("Mensagem não pode estar vazia")
    .isLength({ max: 2000 })
    .withMessage("Mensagem muito longa (máximo 2000 caracteres)"),

  body("conversationId")
    .optional()
    .isMongoId()
    .withMessage("ID de conversa inválido"),

  body("streaming")
    .optional()
    .isBoolean()
    .withMessage("Streaming deve ser booleano"),

  handleValidationErrors,
];

export const validateFeedback = [
  body("messageId").isMongoId().withMessage("ID de mensagem inválido"),

  body("type")
    .isIn(["thumbs_up", "thumbs_down", "rating", "detailed"])
    .withMessage("Tipo de feedback inválido"),

  body("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating deve ser entre 1 e 5"),

  body("comment")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Comentário muito longo"),

  handleValidationErrors,
];

export const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Página deve ser >= 1"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit deve ser entre 1 e 100"),

  handleValidationErrors,
];

export const validateVisualBriefing = [
  body("titulo")
    .trim()
    .notEmpty()
    .withMessage("Título do produto é obrigatório")
    .isLength({ max: 150 })
    .withMessage("Título deve ter no máximo 150 caracteres"),
  body("descricao")
    .trim()
    .notEmpty()
    .withMessage("Descrição do produto é obrigatória")
    .isLength({ max: 5000 })
    .withMessage("Descrição deve ter no máximo 5000 caracteres"),
  handleValidationErrors,
];

export const validateImagePrompt = [
  body("prompt")
    .trim()
    .notEmpty()
    .withMessage("Prompt é obrigatório")
    .isLength({ max: 500 })
    .withMessage("Prompt deve ter no máximo 500 caracteres"),
  handleValidationErrors,
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg);
    throw new ValidationError(errorMessages.join(", "));
  }

  next();
}





















import logger from "../utils/logger.js";
import { AppError } from "../utils/errors.js";
import { ApiResponse } from "../utils/response.js";

export function errorHandler(err, req, res, next) {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(err);

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = "Recurso não encontrado";
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = "Registro duplicado";
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors).map((val) => val.message);
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    const message = "Token inválido";
    error = new AppError(message, 401);
  }

  if (err.name === "TokenExpiredError") {
    const message = "Token expirado";
    error = new AppError(message, 401);
  }

  return ApiResponse.error(
    res,
    error.message || "Erro interno do servidor",
    error.statusCode || 500
  );
}

export function notFound(req, res, next) {
  const error = new AppError(`Rota não encontrada - ${req.originalUrl}`, 404);
  next(error);
}





















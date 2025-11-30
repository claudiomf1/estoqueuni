import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { UnauthorizedError } from "../utils/errors.js";
import logger from "../utils/logger.js";

export async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError("Token não fornecido");
    }

    const decoded = jwt.verify(token, config.jwt.secret);

    // Attach user info to request
    req.user = {
      id: decoded.usuarioId || decoded.userId, // ✅ Aceita 'usuarioId' do sistema principal
      tenantId: decoded.tenantId,
      email: decoded.email,
    };

    logger.info(`User authenticated: ${req.user.id}`);
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      next(new UnauthorizedError("Token inválido"));
    } else if (error.name === "TokenExpiredError") {
      next(new UnauthorizedError("Token expirado"));
    } else {
      next(error);
    }
  }
}

function extractToken(req) {
  // Try Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Try cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  // Try query param (for WebSocket handshake)
  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
}

// Generate token (for testing or integration)
export function generateToken(userId, tenantId, email) {
  return jwt.sign({ userId, tenantId, email }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}




















import mongoose from "mongoose";
import { config } from "./index.js";
import logger from "../src/utils/logger.js";

export async function connectDatabase() {
  // Se não há URI configurada, pula a conexão (modo offline/mock)
  if (!config.mongodb.uri) {
    logger.warn("⚠️ MongoDB URI not configured, skipping database connection");
    logger.warn("⚠️ Server will start but database features will be unavailable");
    return;
  }

  try {
    await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    logger.info("✅ MongoDB connected successfully");
  } catch (error) {
    logger.error("❌ MongoDB connection failed:", error.message);
    
    // Em desenvolvimento, continua sem MongoDB (não quebra o servidor)
    if (config.env === "development" || config.skipExternals) {
      logger.warn("⚠️ Continuing without MongoDB (development/offline mode)");
      logger.warn("⚠️ Database features will be unavailable");
      return;
    }
    
    // Em produção, quebra o servidor se MongoDB for crítico
    logger.error("❌ MongoDB is required in production. Exiting...");
    process.exit(1);
  }

  mongoose.connection.on("error", (err) => {
    logger.error("MongoDB error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });
}





















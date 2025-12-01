import app from "./app.js";
import { config } from "../config/index.js";
import { connectDatabase } from "../config/database.js";
import { getRedisClient, closeRedis } from "../config/redis.js";
import { ensureCollection } from "../config/vectordb.js";
import logger from "./utils/logger.js";

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Connect to Redis
    getRedisClient();

    // Ensure Qdrant collection exists
    await ensureCollection();

    // Start server
    const server = app.listen(config.port, config.host || "127.0.0.1", () => {
      logger.info(
        `🚀 EstoqueUni AI Server running on ${config.host || "127.0.0.1"}:${config.port} in ${config.env} mode`
      );
    });

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      logger.info("SIGTERM received, shutting down gracefully");
      server.close(async () => {
        await closeRedis();
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();



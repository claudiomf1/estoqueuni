import Redis from "ioredis";
import { config } from "./index.js";
import logger from "../src/utils/logger.js";

let redisClient = null;

const shouldUseMockRedis = () =>
  config.skipExternals || process.env.NODE_ENV === "test";

const createMockRedis = () => {
  const store = new Map();
  const expirations = new Map();

  const isExpired = (key) => {
    const expiresAt = expirations.get(key);
    return typeof expiresAt === "number" && Date.now() > expiresAt;
  };

  const ensureValue = (key) => {
    if (isExpired(key)) {
      store.delete(key);
      expirations.delete(key);
    }
  };

  return {
    async get(key) {
      ensureValue(key);
      const value = store.get(key);
      return value === undefined ? null : value;
    },
    async set(key, value, mode, ttl) {
      store.set(key, value);
      if (typeof mode === "string" && ["EX", "PX"].includes(mode.toUpperCase())) {
        const ttlMs = mode.toUpperCase() === "EX" ? Number(ttl) * 1000 : Number(ttl);
        if (Number.isFinite(ttlMs)) {
          expirations.set(key, Date.now() + ttlMs);
        }
      }
      return "OK";
    },
    async incr(key) {
      ensureValue(key);
      const current = Number(store.get(key) ?? 0);
      const next = current + 1;
      store.set(key, next);
      return next;
    },
    async expire(key, seconds) {
      if (!Number.isFinite(seconds)) return 0;
      expirations.set(key, Date.now() + seconds * 1000);
      return 1;
    },
    async quit() {
      store.clear();
      expirations.clear();
    },
    on() {
      // noop
    },
  };
};

export function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  if (shouldUseMockRedis()) {
    redisClient = createMockRedis();
    logger.info("✅ Using in-memory Redis mock");
    return redisClient;
  }

  redisClient = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redisClient.on("connect", () => {
    logger.info("✅ Redis connected successfully");
  });

  redisClient.on("error", (err) => {
    logger.error("❌ Redis error:", err);
  });

  return redisClient;
}

export async function closeRedis() {
  if (redisClient?.quit) {
    await redisClient.quit();
    logger.info("Redis connection closed");
  }
}




















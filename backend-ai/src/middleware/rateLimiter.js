import { getRedisClient } from "../../config/redis.js";
import { RateLimitError } from "../utils/errors.js";
import { config } from "../../config/index.js";
import logger from "../utils/logger.js";

export class RateLimiter {
  constructor() {
    this.redis = getRedisClient();
  }

  async checkLimit(userId, limits) {
    const { perMinute, perDay } = limits;
    const now = Date.now();
    const minuteKey = `ratelimit:${userId}:minute:${Math.floor(now / 60000)}`;
    const dayKey = `ratelimit:${userId}:day:${
      new Date().toISOString().split("T")[0]
    }`;

    // Check minute limit
    const minuteCount = await this.redis.incr(minuteKey);
    if (minuteCount === 1) {
      await this.redis.expire(minuteKey, 60);
    }

    if (minuteCount > perMinute) {
      logger.warn(
        `Rate limit exceeded (minute): ${userId} - ${minuteCount}/${perMinute}`
      );
      throw new RateLimitError(
        `Limite de ${perMinute} mensagens por minuto excedido. Aguarde um momento.`
      );
    }

    // Check day limit
    const dayCount = await this.redis.incr(dayKey);
    if (dayCount === 1) {
      await this.redis.expire(dayKey, 86400); // 24 hours
    }

    if (dayCount > perDay) {
      logger.warn(
        `Rate limit exceeded (day): ${userId} - ${dayCount}/${perDay}`
      );
      throw new RateLimitError(
        `Limite diário de ${perDay} mensagens excedido. Tente novamente amanhã.`
      );
    }

    return {
      minuteRemaining: perMinute - minuteCount,
      dayRemaining: perDay - dayCount,
    };
  }
}

export async function rateLimitMiddleware(req, res, next) {
  try {
    const limiter = new RateLimiter();
    const { user } = req;

    // Disable rate limit (set very high values)
    const limits = { perMinute: 1000000, perDay: 1000000 };

    const remaining = await limiter.checkLimit(user.id, limits);

    // Add rate limit info to response headers
    res.setHeader("X-RateLimit-Remaining-Minute", remaining.minuteRemaining);
    res.setHeader("X-RateLimit-Remaining-Day", remaining.dayRemaining);

    next();
  } catch (error) {
    next(error);
  }
}




















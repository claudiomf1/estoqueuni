import { randomUUID } from "crypto";
import logger from "../utils/logger.js";
import { sanitizePayload } from "../utils/loggerSanitizer.js";
import { config } from "../../config/index.js";
import { pushToLoki } from "../utils/lokiClient.js";

function computeRoute(req) {
  if (req.baseUrl) {
    return `${req.baseUrl}${req.route?.path || ""}` || req.originalUrl;
  }
  return req.originalUrl;
}

export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  const requestId = req.headers["x-request-id"] || randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationNs = Number(end - start);
    const durationMs = Math.max(Math.round(durationNs / 1e6), 0);

    const tenantId =
      req.user?.tenantId ||
      req.headers["x-tenant-id"] ||
      res.locals?.tenantId ||
      null;

    const iaMetrics = res.locals?.iaMetrics || {};

    const logPayload = {
      event: "http_request_completed",
      requestId,
      method: req.method,
      route: computeRoute(req),
      status: res.statusCode,
      latencyMs: durationMs,
      tenantId,
      provider: iaMetrics.provider || res.locals?.provider || "internal",
      model: iaMetrics.model || null,
      creditsUsed: iaMetrics.creditsUsed ?? null,
      promptTokens: iaMetrics.promptTokens ?? null,
      completionTokens: iaMetrics.completionTokens ?? null,
      timestamp: new Date().toISOString(),
      userId: req.user?.id || null,
      sample: false,
    };

    const shouldSample =
      config.observability.sampleRate > 0 &&
      Math.random() < config.observability.sampleRate;

    if (shouldSample) {
      logPayload.sample = true;
      logPayload.body = sanitizePayload(req.body);
      logPayload.query = sanitizePayload(req.query);
      logPayload.headers = sanitizePayload({
        "x-tenant-id": req.headers["x-tenant-id"],
        "x-scope": req.headers["x-scope"],
        "user-agent": req.headers["user-agent"],
      });
    }

    logger.info(JSON.stringify(logPayload));

    if (shouldSample) {
      pushToLoki({
        level: "info",
        ...logPayload,
      }).catch(() => {
        /* Erros tratados internamente */
      });
    }
  });

  next();
}





















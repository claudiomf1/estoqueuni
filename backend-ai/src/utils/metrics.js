import client from "prom-client";
import { config } from "../../config/index.js";

const metricsEnabled = config.observability.metricsEnabled;

const registry = new client.Registry();

if (metricsEnabled) {
  client.collectDefaultMetrics({
    register: registry,
    prefix: "backend_ai_",
  });
}

const iaRequestLatency = new client.Histogram({
  name: "ia_request_latency_seconds",
  help: "Latência das chamadas aos provedores de IA",
  labelNames: ["provider", "route", "status"],
  buckets: [0.2, 0.5, 1, 1.5, 2, 3, 5, 8, 13],
  registers: metricsEnabled ? [registry] : [],
});

const iaRequestsTotal = new client.Counter({
  name: "ia_requests_total",
  help: "Total de requisições aos provedores de IA",
  labelNames: ["provider", "route", "status"],
  registers: metricsEnabled ? [registry] : [],
});

const iaErrorsTotal = new client.Counter({
  name: "ia_errors_total",
  help: "Total de erros por provedor de IA",
  labelNames: ["provider", "error_code"],
  registers: metricsEnabled ? [registry] : [],
});

const iaCreditsConsumedTotal = new client.Counter({
  name: "ia_credits_consumed_total",
  help: "Total de créditos consumidos pelos provedores de IA",
  labelNames: ["provider", "tenantId"],
  registers: metricsEnabled ? [registry] : [],
});

const iaPromptTokensGauge = new client.Gauge({
  name: "ia_prompt_tokens_gauge",
  help: "Quantidade de tokens utilizados na última requisição por modelo",
  labelNames: ["provider", "model"],
  registers: metricsEnabled ? [registry] : [],
});

export function recordIARequestMetrics({
  provider = "unknown",
  route = "unknown",
  status = "200",
  durationMs = 0,
  errorCode = null,
  promptTokens = null,
  completionTokens = null,
  tenantId = "unknown",
  creditsUsed = null,
  model = "unknown",
} = {}) {
  if (!metricsEnabled) {
    return;
  }

  const statusLabel = String(status);
  const labels = { provider, route, status: statusLabel };

  iaRequestsTotal.inc(labels);
  iaRequestLatency.observe(labels, Math.max(durationMs, 0) / 1000);

  if (errorCode) {
    iaErrorsTotal.inc({ provider, error_code: String(errorCode) });
  }

  if (typeof creditsUsed === "number") {
    iaCreditsConsumedTotal.inc({ provider, tenantId: tenantId || "unknown" }, creditsUsed);
  }

  if (typeof promptTokens === "number") {
    iaPromptTokensGauge.set({ provider, model }, promptTokens);
  } else if (typeof completionTokens === "number") {
    iaPromptTokensGauge.set({ provider, model }, completionTokens);
  }
}

export function resetIAMetrics() {
  if (!metricsEnabled) {
    return;
  }

  iaRequestLatency.reset();
  iaRequestsTotal.reset();
  iaErrorsTotal.reset();
  iaCreditsConsumedTotal.reset();
  iaPromptTokensGauge.reset();
}

export function getMetricsRegistry() {
  return registry;
}

export const IA_METRICS_ENABLED = metricsEnabled;



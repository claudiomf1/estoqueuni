import { getMetricsRegistry, IA_METRICS_ENABLED } from "../utils/metrics.js";

export async function metricsEndpoint(req, res) {
  if (!IA_METRICS_ENABLED) {
    return res.status(404).json({
      error: "Metrics endpoint desabilitado. Ative IA_METRICS_ENABLED=1.",
    });
  }

  const registry = getMetricsRegistry();
  res.setHeader("Content-Type", registry.contentType);
  res.send(await registry.metrics());
}



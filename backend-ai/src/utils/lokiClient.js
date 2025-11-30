import axios from "axios";
import { config } from "../../config/index.js";

const lokiConfig = config.observability.loki;
const enabled = Boolean(lokiConfig?.url);

export async function pushToLoki(logEntry) {
  if (!enabled) {
    return;
  }

  const timestamp = `${Date.now()}000000`;
  const stream = {
    stream: {
      app: "backend-ai",
      provider: logEntry.provider || "internal",
      level: logEntry.level || "info",
      tenantId: logEntry.tenantId || "unknown",
      route: logEntry.route || "unknown",
    },
    values: [[timestamp, JSON.stringify(logEntry)]],
  };

  try {
    await axios.post(
      `${lokiConfig.url.replace(/\/$/, "")}/loki/api/v1/push`,
      { streams: [stream] },
      {
        headers: {
          "Content-Type": "application/json",
          ...(lokiConfig.tenantId
            ? { "X-Scope-OrgID": lokiConfig.tenantId }
            : {}),
        },
        timeout: 3000,
      }
    );
  } catch (error) {
    if (config.env !== "production") {
      console.error("Falha ao enviar log para Loki:", error.message);
    }
  }
}

export function isLokiEnabled() {
  return enabled;
}



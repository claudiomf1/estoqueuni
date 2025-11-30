const API_PREFIX = "/api/v1";
const LOCAL_FALLBACKS = [
  "http://localhost:5001",
  "http://127.0.0.1:5001",
];

const trimTrailingSlash = (value) => (value ? value.replace(/\/+$/, "") : "");

const enforceBrowserProtocol = (value) => {
  if (!value) return "";
  if (typeof window === "undefined") return value;
  if (window.location?.protocol === "https:" && value.startsWith("http://")) {
    return value.replace(/^http:\/\//i, "https://");
  }
  return value;
};

const ensurePrefix = (base) => {
  if (!base) return "";
  const trimmed = trimTrailingSlash(base);
  const normalized = trimmed.endsWith(API_PREFIX) ? trimmed : `${trimmed}${API_PREFIX}`;
  return enforceBrowserProtocol(normalized);
};

export const resolveBackendAiBaseFromHost = (host) => {
  if (!host) return "";
  try {
    const url = new URL(host);
    return ensurePrefix(url.origin);
  } catch {
    if (host.startsWith("http://") || host.startsWith("https://")) {
      return ensurePrefix(host);
    }
    return ensurePrefix(`https://${host}`);
  }
};

export const getBackendAiBase = () => {
  const runtimeHost =
    typeof window !== "undefined" && window.__ESTOQUEUNI_API_BASE
      ? ensurePrefix(window.__ESTOQUEUNI_API_BASE)
      : typeof globalThis !== "undefined" && globalThis.__ESTOQUEUNI_API_BASE
      ? ensurePrefix(globalThis.__ESTOQUEUNI_API_BASE)
      : "";

  if (runtimeHost) {
    if (typeof window !== "undefined") {
      window.__ESTOQUEUNI_API_BASE = runtimeHost;
    } else if (typeof globalThis !== "undefined") {
      globalThis.__ESTOQUEUNI_API_BASE = runtimeHost;
    }
    return runtimeHost;
  }

  const browserOrigin =
    typeof window !== "undefined" && window.location
      ? `${window.location.protocol}//${window.location.host}`
      : null;

  const isLocalhost =
    typeof window !== "undefined" &&
    window.location &&
    /localhost|127\.0\.0\.1/.test(window.location.hostname);

  const preferredHosts = [
    typeof import.meta !== "undefined" && import.meta.env?.VITE_ESTOQUEUNI_AI_API_BASE,
    typeof import.meta !== "undefined" && import.meta.env?.VITE_ESTOQUEUNI_AI_DEV_HOST,
    typeof window !== "undefined" && window.__ESTOQUEUNI_API_HOST
      ? resolveBackendAiBaseFromHost(window.__ESTOQUEUNI_API_HOST)
      : null,
    typeof globalThis !== "undefined" && globalThis.__ESTOQUEUNI_API_HOST
      ? resolveBackendAiBaseFromHost(globalThis.__ESTOQUEUNI_API_HOST)
      : null,
    ...(isLocalhost ? LOCAL_FALLBACKS : []),
    browserOrigin,
    ...(!isLocalhost ? LOCAL_FALLBACKS : []),
  ].filter(Boolean);

  const baseUrl = ensurePrefix(preferredHosts[0] || LOCAL_FALLBACKS[0]);

  if (typeof window !== "undefined") {
    window.__ESTOQUEUNI_API_BASE = baseUrl;
  } else if (typeof globalThis !== "undefined") {
    globalThis.__ESTOQUEUNI_API_BASE = baseUrl;
  }

  return baseUrl;
};

export const buildTenantAiEndpoint = (tenantId, suffix = "") => {
  const base = getBackendAiBase();
  const trimmedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${base}/tenants/${tenantId}${trimmedSuffix}`;
};

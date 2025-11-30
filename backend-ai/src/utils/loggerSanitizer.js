const SENSITIVE_KEYS = [
  "authorization",
  "accessToken",
  "refreshToken",
  "apiKey",
  "apikey",
  "secret",
  "password",
  "token",
  "bearer",
];

function maskValue(value) {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length <= 4) {
      return "***";
    }
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }
  if (typeof value === "number") {
    return "***";
  }
  if (Buffer.isBuffer(value)) {
    return "***";
  }
  return "***";
}

export function sanitizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item));
  }

  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (SENSITIVE_KEYS.some((sensitive) =>
      key.toLowerCase().includes(sensitive.toLowerCase())
    )) {
      acc[key] = maskValue(value);
      return acc;
    }

    if (typeof value === "object" && value !== null) {
      acc[key] = sanitizePayload(value);
    } else {
      acc[key] = value;
    }

    return acc;
  }, {});
}



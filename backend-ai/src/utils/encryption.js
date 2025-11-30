import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import logger from "./logger.js";
import { config } from "../../config/index.js";

let cachedKey = null;

function getKey() {
  if (cachedKey) {
    return cachedKey;
  }

  const rawKey = config.bling.encryptionKey;

  if (!rawKey) {
    const message =
      "BLING_TOKEN_ENCRYPTION_KEY não configurada. Configure uma chave secreta para habilitar armazenamento seguro.";
    if (!config.bling.mockMode) {
      throw new Error(message);
    }

    logger.warn(`${message} Usando chave derivada temporária (modo mock).`);
  }

  const source = rawKey || "mock-key";
  cachedKey = createHash("sha256").update(source).digest();
  return cachedKey;
}

export function encryptSecret(plainText) {
  if (plainText == null) {
    return null;
  }

  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  const payload = {
    iv: iv.toString("base64"),
    tag: authTag.toString("base64"),
    data: encrypted.toString("base64"),
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function decryptSecret(cipherText) {
  if (!cipherText) {
    return null;
  }

  const key = getKey();

  try {
    const json = Buffer.from(cipherText, "base64").toString("utf8");
    const payload = JSON.parse(json);
    const iv = Buffer.from(payload.iv, "base64");
    const authTag = Buffer.from(payload.tag, "base64");
    const encrypted = Buffer.from(payload.data, "base64");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    logger.error("Erro ao descriptografar segredo Bling:", error);
    if (!config.bling.mockMode) {
      throw error;
    }
    return null;
  }
}



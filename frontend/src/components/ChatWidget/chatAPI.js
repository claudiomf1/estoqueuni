import axios from "axios";

import { getBackendAiBase } from "../../utils/backendAiApi.js";

const API_BASE = getBackendAiBase();
const API_REQUEST_TIMEOUT = 12000;
const TOKEN_REQUEST_TIMEOUT = 3000;
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Cliente dedicado ao backend de IA
const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: API_REQUEST_TIMEOUT,
});

const getBackendHost = () => {
  const envHost = import.meta.env.VITE_API_BASE;
  if (typeof window !== "undefined" && window.__ESTOQUEUNI_API_HOST) {
    return window.__ESTOQUEUNI_API_HOST;
  }
  return envHost || "http://localhost:5010";
};

const getCookie = (name) => {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
};

let tokenCache = null;
let tokenCacheTime = null;

async function getAuthToken() {
  if (tokenCache && tokenCacheTime && Date.now() - tokenCacheTime < TOKEN_CACHE_TTL) {
    return tokenCache;
  }

  try {
    const backendHost = getBackendHost();
    const response = await axios.post(
      `${backendHost}/getToken`,
      {},
      {
        withCredentials: true,
        timeout: TOKEN_REQUEST_TIMEOUT,
      }
    );

    if (response.data?.success && response.data?.token) {
      tokenCache = response.data.token;
      tokenCacheTime = Date.now();
      console.log("[chatAPI] Token obtido do backend principal via /getToken");
      return tokenCache;
    }
  } catch (error) {
    console.warn("[chatAPI] Erro ao obter token do backend principal:", error.message);
    tokenCache = null;
    tokenCacheTime = null;
  }

  const cookieToken = getCookie("token");
  if (cookieToken) {
    tokenCache = cookieToken;
    tokenCacheTime = Date.now();
    console.log("[chatAPI] Token obtido do cookie diretamente");
    return cookieToken;
  }

  return null;
}

apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.withCredentials = true;
    return config;
  },
  (error) => Promise.reject(error)
);

export const chatAPI = {
  async sendMessage(message, conversationId = null, streaming = false, tenantId = null, userId = null) {
    const payload = {
      message,
      streaming,
      tenantId,
      userId,
    };

    if (conversationId) {
      payload.conversationId = conversationId;
    }

    const response = await apiClient.post("/ai/chat", payload, {
      withCredentials: true,
      timeout: API_REQUEST_TIMEOUT,
    });

    return response.data;
  },

  async getConversations(page = 1, limit = 20) {
    const response = await apiClient.get("/ai/conversations", {
      params: { page, limit },
      withCredentials: true,
      timeout: API_REQUEST_TIMEOUT,
    });
    return response.data;
  },

  async getConversation(conversationId) {
    const response = await apiClient.get(`/ai/conversations/${conversationId}`, {
      withCredentials: true,
      timeout: API_REQUEST_TIMEOUT,
    });
    return response.data;
  },

  async deleteConversation(conversationId) {
    const response = await apiClient.delete(`/ai/conversations/${conversationId}`, {
      withCredentials: true,
      timeout: API_REQUEST_TIMEOUT,
    });
    return response.data;
  },
};

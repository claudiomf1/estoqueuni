import { randomUUID } from 'crypto';

/**
 * Helper para logs estruturados de integração com Bling API
 * Feature flag: ESTOQUEUNI_BLING_DEBUG=true para ativar logs detalhados
 */

const BLING_DEBUG_ENABLED = process.env.ESTOQUEUNI_BLING_DEBUG === 'true';

// Log inicial para confirmar que a variável está sendo lida
console.log(
  `[BLING-LOGGER] 🔍 ESTOQUEUNI_BLING_DEBUG=${process.env.ESTOQUEUNI_BLING_DEBUG || 'não definida'} -> BLING_DEBUG_ENABLED=${BLING_DEBUG_ENABLED}`
);

/**
 * Mascara o token de autorização mostrando apenas primeiros e últimos 4 caracteres
 * @param {string} token - Token completo (Bearer TOKEN ou apenas TOKEN)
 * @returns {string} Token mascarado
 */
function maskAuthorization(token) {
  if (!token) return 'Bearer (empty)';
  
  const parts = token.replace(/^Bearer\s+/i, '').trim();
  if (parts.length <= 8) {
    return 'Bearer ***';
  }
  
  const first4 = parts.substring(0, 4);
  const last4 = parts.substring(parts.length - 4);
  return `Bearer ${first4}...${last4}`;
}

/**
 * Extrai o token do header Authorization
 * @param {string|undefined} authHeader
 * @returns {string}
 */
function extractToken(authHeader) {
  if (!authHeader) return '';
  if (typeof authHeader === 'string') {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }
  return '';
}

/**
 * Gera um correlationId único para rastrear operações
 * @returns {string} UUID v4
 */
export function generateCorrelationId() {
  return randomUUID();
}

/**
 * Log estruturado para REQUEST HTTP real ao Bling API
 * @param {Object} params
 */
export function logBlingRequest({
  correlationId,
  httpMethod,
  url,
  endpoint,
  produtoId,
  depositoId,
  tipoOperacao,
  quantidade,
  requestBody,
  headers,
}) {
  if (!BLING_DEBUG_ENABLED) return;

  const authHeader = headers?.Authorization || headers?.authorization;
  const token = extractToken(authHeader);
  const authorizationMasked = maskAuthorization(authHeader || token);

  // Preparar headers relevantes
  const relevantHeaders = {};
  if (headers?.['Content-Type'] || headers?.['content-type']) {
    relevantHeaders['Content-Type'] = headers['Content-Type'] || headers['content-type'];
  }

  // Serializar body se não for string
  const bodyString = typeof requestBody === 'string' 
    ? requestBody 
    : (requestBody !== null && requestBody !== undefined ? JSON.stringify(requestBody) : null);

  const log = {
    tag: 'BLING_HTTP_REQUEST',
    httpMethod,
    url,
    authorizationMasked,
    headers: relevantHeaders,
    body: bodyString,
    ...(produtoId !== undefined && { produtoId }),
    ...(depositoId !== undefined && { depositoId }),
    ...(tipoOperacao && { tipoOperacao }),
    ...(quantidade !== undefined && { quantidade }),
    correlationId,
  };

  console.log(JSON.stringify(log));
}

/**
 * Log estruturado para RESPONSE HTTP real do Bling API
 * @param {Object} params
 */
export function logBlingResponse({
  correlationId,
  httpMethod,
  url,
  endpoint,
  statusCode,
  statusText,
  produtoId,
  depositoId,
  tipoOperacao,
  quantidade,
  responseBody,
  responseHeaders,
}) {
  if (!BLING_DEBUG_ENABLED) return;

  // Serializar response body
  const bodyString = typeof responseBody === 'string' 
    ? responseBody 
    : JSON.stringify(responseBody || {});

  const log = {
    tag: 'BLING_HTTP_RESPONSE',
    httpMethod,
    url,
    status: statusCode,
    ...(statusText && { statusText }),
    ...(responseHeaders && { headers: responseHeaders }),
    body: bodyString,
    ...(produtoId !== undefined && { produtoId }),
    ...(depositoId !== undefined && { depositoId }),
    ...(tipoOperacao && { tipoOperacao }),
    ...(quantidade !== undefined && { quantidade }),
    correlationId,
  };

  console.log(JSON.stringify(log));
}

/**
 * Log estruturado para fluxo de negócio do EstoqueUni
 * @param {Object} params
 */
export function logStockFlow({
  correlationId,
  step,
  produtoId,
  sku,
  depositoId,
  saldoAtualDetectado,
  quantidadeDesejada,
  tipoOperacaoEscolhida,
  saldoLidoNaAPI,
  saldoEsperado,
}) {
  if (!BLING_DEBUG_ENABLED) return;

  const log = {
    tag: 'ESTOQUEUNI_STOCK_FLOW',
    timestamp: new Date().toISOString(),
    step,
    produtoId,
    ...(sku && { sku }),
    depositoId,
    ...(saldoAtualDetectado !== undefined && { saldoAtualDetectado }),
    ...(quantidadeDesejada !== undefined && { quantidadeDesejada }),
    ...(tipoOperacaoEscolhida && { tipoOperacaoEscolhida }),
    ...(saldoLidoNaAPI !== undefined && { saldoLidoNaAPI }),
    ...(saldoEsperado !== undefined && { saldoEsperado }),
    correlationId,
  };

  console.log(JSON.stringify(log));
}

/**
 * Log do JSON bruto retornado pelo GET /estoques/saldos
 * @param {Object} params
 */
export function logBlingSaldoRaw({
  correlationId,
  produtoId,
  depositoId,
  responseData,
  error,
}) {
  if (!BLING_DEBUG_ENABLED) return;

  const log = {
    tag: 'BLING_SALDO_RAW',
    timestamp: new Date().toISOString(),
    produtoId,
    depositoId,
    ...(responseData && { responseData }),
    ...(error && { error }),
    correlationId,
  };

  console.log(JSON.stringify(log));
}


/**
 * Rastreador simples de atualizações automáticas enviadas ao Bling.
 * Quando o EstoqueUni atualiza um depósito, ele dispara um webhook de volta;
 * para evitar loops infinitos, marcamos a combinação (tenant, deposito, produto)
 * e ignoramos o próximo evento correspondente.
 */ 

const TTL_MS = 30_000;
const MAX_REGISTRATIONS_PER_KEY = 5;
const cache = new Map(); 

function montarChave(tenantId, depositoId, produtoId) {
  if (!tenantId || !depositoId || !produtoId) return null;
  return `${tenantId}:${depositoId}:${produtoId}`;
}

function registrarAtualizacaoAutomatica({ tenantId, depositoId, produtoId }) {
  const chave = montarChave(tenantId, depositoId, produtoId);
  if (!chave) {
    return;
  }

  const agora = Date.now();
  const existente = cache.get(chave) || {
    timestamps: [],
    lastUpdate: agora,
  };

  existente.timestamps.push(agora);
  existente.lastUpdate = agora;
  while (existente.timestamps.length > MAX_REGISTRATIONS_PER_KEY) {
    existente.timestamps.shift();
  }

  cache.set(chave, existente);

  // Programar limpeza futura caso não seja consumido
  setTimeout(() => {
    const entry = cache.get(chave);
    if (!entry) {
      return;
    }
    if (Date.now() - entry.lastUpdate >= TTL_MS) {
      cache.delete(chave);
    }
  }, TTL_MS + 1000);
}

function ehEventoGeradoPorAtualizacaoAutomatica({ tenantId, depositoId, produtoId }) {
  const chave = montarChave(tenantId, depositoId, produtoId);
  if (!chave) {
    return false;
  }

  const entry = cache.get(chave);
  if (!entry || !Array.isArray(entry.timestamps) || entry.timestamps.length === 0) {
    return false;
  }

  const agora = Date.now();
  entry.timestamps = entry.timestamps.filter((ts) => agora - ts <= TTL_MS);

  if (entry.timestamps.length === 0) {
    cache.delete(chave);
    return false;
  }

  // Consumir o registro mais antigo
  entry.timestamps.shift();
  entry.lastUpdate = entry.timestamps[entry.timestamps.length - 1] || entry.lastUpdate;
  if (entry.timestamps.length === 0) {
    cache.delete(chave);
  } else {
    cache.set(chave, entry);
  }

  return true;
}

const autoUpdateTracker = {
  registrarAtualizacaoAutomatica,
  ehEventoGeradoPorAtualizacaoAutomatica,
};

export default autoUpdateTracker;

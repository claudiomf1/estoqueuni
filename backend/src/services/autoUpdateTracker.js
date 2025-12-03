/**
 * Rastreador simples de atualizações automáticas enviadas ao Bling.
 * Quando o EstoqueUni atualiza um depósito, ele dispara um webhook de volta;
 * para evitar loops infinitos, marcamos a combinação (tenant, deposito, produto)
 * e ignoramos o próximo evento correspondente.
 */ 

const TTL_MS = 30_000;
const MAX_REGISTRATIONS_PER_KEY = 5;
const cache = new Map();
const cacheProduto = new Map();

function montarChave(tenantId, depositoId, produtoId) {
  if (!tenantId || !depositoId || !produtoId) return null;
  return `${tenantId}:${depositoId}:${produtoId}`;
}

function montarChaveProduto(tenantId, produtoId) {
  if (!tenantId || !produtoId) return null;
  return `${tenantId}::${produtoId}`;
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

  // Registrar também no nível de produto (para casos em que o webhook não traz depósito)
  const chaveProduto = montarChaveProduto(tenantId, produtoId);
  if (chaveProduto) {
    const existenteProduto = cacheProduto.get(chaveProduto) || {
      timestamps: [],
      lastUpdate: agora,
    };
    existenteProduto.timestamps.push(agora);
    existenteProduto.lastUpdate = agora;
    while (existenteProduto.timestamps.length > MAX_REGISTRATIONS_PER_KEY) {
      existenteProduto.timestamps.shift();
    }
    cacheProduto.set(chaveProduto, existenteProduto);

    setTimeout(() => {
      const entry = cacheProduto.get(chaveProduto);
      if (!entry) {
        return;
      }
      if (Date.now() - entry.lastUpdate >= TTL_MS) {
        cacheProduto.delete(chaveProduto);
      }
    }, TTL_MS + 1000);
  }
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

  // Mantém bloqueio enquanto dentro do TTL (não consome)
  entry.lastUpdate = entry.timestamps[entry.timestamps.length - 1] || entry.lastUpdate;
  cache.set(chave, entry);

  return true;
}

function ehEventoGeradoPorAtualizacaoAutomaticaProduto({ tenantId, produtoId }) {
  const chave = montarChaveProduto(tenantId, produtoId);
  if (!chave) {
    return false;
  }

  const entry = cacheProduto.get(chave);
  if (!entry || !Array.isArray(entry.timestamps) || entry.timestamps.length === 0) {
    return false;
  }

  const agora = Date.now();
  entry.timestamps = entry.timestamps.filter((ts) => agora - ts <= TTL_MS);

  if (entry.timestamps.length === 0) {
    cacheProduto.delete(chave);
    return false;
  }

  entry.lastUpdate = entry.timestamps[entry.timestamps.length - 1] || entry.lastUpdate;
  cacheProduto.set(chave, entry);

  return true;
}

const autoUpdateTracker = {
  registrarAtualizacaoAutomatica,
  ehEventoGeradoPorAtualizacaoAutomatica,
  ehEventoGeradoPorAtualizacaoAutomaticaProduto,
};

export default autoUpdateTracker;

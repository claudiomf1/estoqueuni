/**
 * Utilitário para processar webhooks de vendas do Bling
 * 
 * Extrai produtos de pedidos de venda e cria eventos para sincronização
 */

/**
 * Extrai produtos de um pedido de venda do Bling
 * @param {Object} payload - Payload do webhook do Bling
 * @returns {Array} Array de produtos com { produtoId, quantidade, depositoId }
 */
export function extrairProdutosDoPedido(payload) {
  const produtos = [];

  // Formato 1: payload.pedido ou payload.data.pedido
  const pedido = payload.pedido || payload.data?.pedido || payload;

  // Formato 2: payload.itens ou pedido.itens
  const itens = pedido.itens || payload.itens || [];

  if (!Array.isArray(itens) || itens.length === 0) {
    console.warn('[Webhook-Venda] ⚠️ Nenhum item encontrado no pedido');
    return produtos;
  }

  // Extrair produtos dos itens
  for (const item of itens) {
    // O produto pode vir como objeto com id ou como string
    const produtoId = item.produto?.id || 
                      item.idProduto || 
                      item.produtoId || 
                      item.productId ||
                      item.id;

    if (!produtoId) {
      console.warn('[Webhook-Venda] ⚠️ Item sem produtoId:', item);
      continue;
    }

    const quantidade = item.quantidade || 
                      item.qtd || 
                      item.quantity || 
                      0;

    const depositoId = item.deposito?.id || 
                       item.depositoId || 
                       item.idDeposito ||
                       pedido.deposito?.id ||
                       pedido.depositoId ||
                       null;

    produtos.push({
      produtoId: String(produtoId),
      quantidade: Number(quantidade),
      depositoId: depositoId ? String(depositoId) : null,
      item: item, // Manter referência ao item original para debug
    });
  }

  return produtos;
}

/**
 * Identifica o tipo de evento do webhook do Bling
 * @param {Object} payload - Payload do webhook
 * @returns {string} Tipo do evento: 'venda', 'pedido', 'estoque', 'desconhecido'
 */
function normalizarTexto(valor) {
  if (!valor || typeof valor !== 'string') {
    return '';
  }
  return valor.toLowerCase();
}

export function identificarTipoEvento(payload) {
  const eventNome = normalizarTexto(payload.event || payload.tipo || payload.type);
  const dataTipo = normalizarTexto(payload.data?.tipo || payload.data?.type);

  // Verifica se é um pedido de venda
  if (
    payload.pedido ||
    payload.data?.pedido ||
    payload.itens ||
    eventNome.includes('pedido') ||
    dataTipo.includes('pedido') ||
    eventNome.includes('sale')
  ) {
    return 'venda';
  }

  // Verifica se é evento de estoque
  if (
    payload.estoque ||
    payload.data?.estoque ||
    eventNome.includes('estoque') ||
    dataTipo.includes('estoque') ||
    eventNome.includes('stock') ||
    dataTipo.includes('stock') ||
    eventNome.includes('inventory')
  ) {
    return 'estoque';
  }

  // Verifica se tem produtoId direto (evento de estoque)
  if (payload.produtoId || payload.idProduto || payload.productId) {
    return 'estoque';
  }

  return 'desconhecido';
}

function extrairProdutoEstoque(payload) {
  const candidatos = [
    payload,
    payload.data,
    payload.data?.produto,
    payload.data?.product,
    payload.data?.estoque?.produto,
    payload.data?.estoque?.product,
    payload.data?.stock?.produto,
    payload.data?.stock?.product,
    payload.data?.item,
    payload.produto,
    payload.product,
  ].filter(Boolean);

  for (const item of candidatos) {
    const sku =
      item.codigo ||
      item.codigoPai ||
      item.codigoProduto ||
      item.sku ||
      item.SKU ||
      item.idProdutoLoja;
    if (sku) {
      return { produtoId: String(sku), origem: 'sku' };
    }

    const id = item.id || item.produtoId || item.productId;
    if (id) {
      return { produtoId: String(id), origem: 'id' };
    }
  }

  const direto = payload.produtoId || payload.idProduto || payload.productId || payload.sku;
  if (direto) {
    return { produtoId: String(direto), origem: 'direto' };
  }

  return { produtoId: null, origem: null };
}

function extrairDeposito(payload) {
  const candidatos = [
    payload.deposito,
    payload.data?.deposito,
    payload.data?.stock?.deposito,
    payload.data?.estoque?.deposito,
    payload.data?.deposit,
    payload.data?.stock?.deposit,
    payload.data?.estoque?.deposit,
  ].filter(Boolean);

  for (const deposito of candidatos) {
    const id = deposito.id || deposito.depositoId || deposito.depositId || deposito.codigo;
    if (id) {
      return String(id);
    }
  }

  return (
    payload.depositoId ||
    payload.idDeposito ||
    payload.depositId ||
    payload.data?.depositoId ||
    null
  );
}

/**
 * Extrai informações do pedido de venda
 * @param {Object} payload - Payload do webhook
 * @returns {Object} Informações do pedido { pedidoId, numero, data, blingAccountId }
 */
export function extrairInfoPedido(payload) {
  const pedido = payload.pedido || payload.data?.pedido || payload;

  return {
    pedidoId: pedido.id || payload.id || payload.pedidoId || null,
    numero: pedido.numero || pedido.numeroPedido || null,
    data: pedido.data || pedido.dataEmissao || new Date().toISOString(),
    blingAccountId: payload.blingAccountId || payload.accountId || payload.contaBlingId || null,
    situacao: pedido.situacao || pedido.status || null,
  };
}

/**
 * Processa webhook de venda e retorna eventos para cada produto
 * @param {Object} payload - Payload do webhook do Bling
 * @param {string} tenantId - ID do tenant (opcional, pode ser extraído depois)
 * @param {string} blingAccountId - ID da conta Bling (opcional)
 * @returns {Array} Array de eventos prontos para serem adicionados na fila
 */
export function processarWebhookVenda(payload, tenantId = null, blingAccountId = null) {
  const tipoEvento = identificarTipoEvento(payload);
  const eventos = [];

  console.log(`[Webhook-Venda] 📦 Tipo de evento identificado: ${tipoEvento}`);

  if (tipoEvento === 'venda') {
    // Extrair informações do pedido
    const infoPedido = extrairInfoPedido(payload);
    const pedidoId = infoPedido.pedidoId || `pedido-${Date.now()}`;

    // Extrair produtos do pedido
    const produtos = extrairProdutosDoPedido(payload);

    console.log(`[Webhook-Venda] 📦 Produtos encontrados no pedido: ${produtos.length}`);

    // Criar um evento para cada produto
    for (const produto of produtos) {
      const eventoId = `${pedidoId}-produto-${produto.produtoId}`;

      eventos.push({
        produtoId: produto.produtoId,
        eventoId: eventoId,
        depositoId: produto.depositoId,
        tenantId: tenantId,
        blingAccountId: blingAccountId || infoPedido.blingAccountId,
        tipo: 'venda',
        origem: 'webhook',
        dados: {
          pedidoId: pedidoId,
          numeroPedido: infoPedido.numero,
          quantidade: produto.quantidade,
          dataPedido: infoPedido.data,
          situacao: infoPedido.situacao,
          item: produto.item,
        },
        recebidoEm: new Date().toISOString(),
      });
    }
  } else if (tipoEvento === 'estoque') {
    // Evento direto de estoque (não é venda)
    const eventoId = payload.eventoId || payload.idEvento || payload.eventId || `estoque-${Date.now()}`;
    const produtoExtraido = extrairProdutoEstoque(payload);
    const produtoId = produtoExtraido.produtoId;

    if (produtoId) {
      eventos.push({
        produtoId: String(produtoId),
        eventoId: eventoId,
        depositoId: extrairDeposito(payload),
        tenantId: tenantId,
        blingAccountId: blingAccountId || payload.blingAccountId || payload.accountId,
        tipo: 'estoque',
        origem: 'webhook',
        dados: payload,
        recebidoEm: new Date().toISOString(),
      });
    } else {
      console.warn('[Webhook-Venda] ⚠️ Evento de estoque sem produtoId identificável', {
        event: payload.event,
        dataKeys: Object.keys(payload.data || {}),
      });
    }
  } else {
    console.warn('[Webhook-Venda] ⚠️ Evento desconhecido. Conteúdo:', {
      event: payload.event,
      tipo: payload.tipo,
      dataKeys: Object.keys(payload.data || {}),
    });
  }

  return eventos;
}

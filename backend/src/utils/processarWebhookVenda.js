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
export function identificarTipoEvento(payload) {
  // Verifica se é um pedido de venda
  if (payload.pedido || payload.data?.pedido || payload.itens || payload.tipo === 'pedido' || payload.type === 'pedido') {
    return 'venda';
  }

  // Verifica se é evento de estoque
  if (payload.estoque || payload.data?.estoque || payload.tipo === 'estoque' || payload.type === 'estoque') {
    return 'estoque';
  }

  // Verifica se tem produtoId direto (evento de estoque)
  if (payload.produtoId || payload.idProduto || payload.productId) {
    return 'estoque';
  }

  return 'desconhecido';
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
    const produtoId = payload.produtoId || payload.idProduto || payload.productId;

    if (produtoId) {
      eventos.push({
        produtoId: String(produtoId),
        eventoId: eventoId,
        depositoId: payload.depositoId || payload.idDeposito || payload.depositId || null,
        tenantId: tenantId,
        blingAccountId: blingAccountId || payload.blingAccountId || payload.accountId,
        tipo: 'estoque',
        origem: 'webhook',
        dados: payload,
        recebidoEm: new Date().toISOString(),
      });
    }
  }

  return eventos;
}




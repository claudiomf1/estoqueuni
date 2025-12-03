/**
 * Utilitário para processar webhooks de vendas do Bling
 * 
 * Extrai produtos de pedidos de venda e cria eventos para sincronização
 */
 
import blingService from '../services/blingService.js';
import BlingConfig from '../models/BlingConfig.js';

/**
 * Extrai produtos de um pedido de venda do Bling
 * @param {Object} payload - Payload do webhook do Bling
 * @param {string} tenantId - ID do tenant (opcional, necessário para buscar detalhes via API)
 * @param {string} blingAccountId - ID da conta Bling (opcional, necessário para buscar detalhes via API)
 * @returns {Promise<Array>} Array de produtos com { produtoId, quantidade, depositoId }
 */
export async function extrairProdutosDoPedido(payload, tenantId = null, blingAccountId = null) {
  const produtos = [];

  // Formato 1: payload.pedido ou payload.data.pedido
  // Formato novo: payload.data (quando event é "order.created")
  const pedido = payload.pedido || 
                 payload.data?.pedido || 
                 (payload.event === 'order.created' ? payload.data : null) ||
                 payload;

  // Formato 2: payload.itens ou pedido.itens
  let itens = pedido?.itens || payload.itens || payload.data?.itens || [];

  // Se não encontrou itens e temos informações suficientes, buscar detalhes completos do pedido via API
  if ((!Array.isArray(itens) || itens.length === 0) && tenantId) {
    // Tentar extrair pedidoId de várias formas possíveis
    const pedidoId = pedido?.id || 
                     pedido?.pedidoId || 
                     payload.data?.id || 
                     payload.data?.pedidoId ||
                     payload.pedido?.pedidoId ||
                     payload.pedido?.id ||
                     payload.id ||
                     payload.pedidoId;
    
    if (pedidoId) {
      // Sempre tentar buscar a conta correta usando o companyId do webhook
      // O companyId pode não corresponder ao blingAccountId armazenado
      let blingAccountIdFinal = blingAccountId;
      const companyId = payload.companyId || payload.data?.companyId;
      
      if (tenantId && companyId) {
        // Verificar se a conta fornecida existe e está autorizada
        let contaValida = null;
        if (blingAccountIdFinal) {
          try {
            contaValida = await BlingConfig.findOne({ 
              tenantId, 
              blingAccountId: blingAccountIdFinal,
              is_active: true 
            });
          } catch (error) {
            console.warn(`[Webhook-Venda] ⚠️ Erro ao verificar conta ${blingAccountIdFinal}:`, error.message);
          }
        }
        
        // Se a conta fornecida não existe ou não está autorizada, buscar pelo companyId
        if (!contaValida) {
          console.log(`[Webhook-Venda] 🔍 Buscando conta Bling pelo companyId ${companyId}...`);
          try {
            // Tentar buscar pelo blingAccountId (que pode ser o companyId)
            let conta = await BlingConfig.findOne({ 
              tenantId, 
              blingAccountId: companyId,
              is_active: true 
            });
            
            // Se não encontrou, buscar todas as contas do tenant e verificar se alguma corresponde
            if (!conta) {
              const contas = await BlingConfig.find({ 
                tenantId, 
                is_active: true 
              });
              
              // Tentar encontrar por store_id ou blingAccountId
              conta = contas.find(c => 
                c.blingAccountId === companyId || 
                c.store_id === companyId ||
                String(c.blingAccountId) === String(companyId)
              );
            }
            
            if (conta) {
              blingAccountIdFinal = conta.blingAccountId;
              console.log(`[Webhook-Venda] ✅ Conta Bling encontrada: ${blingAccountIdFinal} (${conta.accountName || conta.store_name || 'N/A'})`);
            } else {
              console.warn(`[Webhook-Venda] ⚠️ Conta Bling não encontrada para companyId ${companyId} no tenant ${tenantId}`);
              // Listar contas disponíveis para debug
              const contasDisponiveis = await BlingConfig.find({ tenantId, is_active: true }).select('blingAccountId accountName store_id').lean();
              console.log(`[Webhook-Venda] 📋 Contas disponíveis no tenant:`, contasDisponiveis.map(c => ({
                blingAccountId: c.blingAccountId,
                accountName: c.accountName,
                store_id: c.store_id
              })));
            }
          } catch (error) {
            console.error(`[Webhook-Venda] ❌ Erro ao buscar conta Bling:`, error.message);
          }
        } else {
          console.log(`[Webhook-Venda] ✅ Conta Bling válida: ${blingAccountIdFinal} (${contaValida.accountName || contaValida.store_name || 'N/A'})`);
        }
      }
      
      if (blingAccountIdFinal) {
        console.log(`[Webhook-Venda] 🔍 Itens não encontrados no webhook. Buscando detalhes completos do pedido ${pedidoId} via API...`);
        console.log(`[Webhook-Venda] 📋 Dados para busca:`, {
          pedidoId: String(pedidoId),
          tenantId: tenantId,
          blingAccountId: blingAccountIdFinal,
          pedidoKeys: pedido ? Object.keys(pedido) : [],
          payloadKeys: Object.keys(payload),
        });
        
        try {
          const pedidoCompleto = await blingService.getPedidoVenda(String(pedidoId), tenantId, blingAccountIdFinal);
          
          // Log detalhado da estrutura do pedido retornado
          console.log(`[Webhook-Venda] 📦 Estrutura do pedido retornado pela API:`, {
            temPedido: !!pedidoCompleto,
            keys: pedidoCompleto ? Object.keys(pedidoCompleto) : [],
            temItens: !!pedidoCompleto?.itens,
            tipoItens: pedidoCompleto?.itens ? (Array.isArray(pedidoCompleto.itens) ? 'array' : typeof pedidoCompleto.itens) : 'undefined',
            quantidadeItens: Array.isArray(pedidoCompleto?.itens) ? pedidoCompleto.itens.length : 'N/A',
            primeiroItem: Array.isArray(pedidoCompleto?.itens) && pedidoCompleto.itens.length > 0 
              ? JSON.stringify(pedidoCompleto.itens[0]).slice(0, 500) 
              : 'N/A',
          });
          
          // Tentar diferentes formatos de itens
          if (pedidoCompleto) {
            // Formato 1: pedidoCompleto.itens (array direto)
            if (pedidoCompleto.itens && Array.isArray(pedidoCompleto.itens) && pedidoCompleto.itens.length > 0) {
              itens = pedidoCompleto.itens;
              console.log(`[Webhook-Venda] ✅ ${itens.length} item(ns) encontrado(s) em pedidoCompleto.itens`);
            }
            // Formato 2: pedidoCompleto.data.itens
            else if (pedidoCompleto.data?.itens && Array.isArray(pedidoCompleto.data.itens) && pedidoCompleto.data.itens.length > 0) {
              itens = pedidoCompleto.data.itens;
              console.log(`[Webhook-Venda] ✅ ${itens.length} item(ns) encontrado(s) em pedidoCompleto.data.itens`);
            }
            // Formato 3: pedidoCompleto.items (em inglês)
            else if (pedidoCompleto.items && Array.isArray(pedidoCompleto.items) && pedidoCompleto.items.length > 0) {
              itens = pedidoCompleto.items;
              console.log(`[Webhook-Venda] ✅ ${itens.length} item(ns) encontrado(s) em pedidoCompleto.items`);
            }
            // Formato 4: pedidoCompleto.produtos
            else if (pedidoCompleto.produtos && Array.isArray(pedidoCompleto.produtos) && pedidoCompleto.produtos.length > 0) {
              itens = pedidoCompleto.produtos;
              console.log(`[Webhook-Venda] ✅ ${itens.length} item(ns) encontrado(s) em pedidoCompleto.produtos`);
            }
            else {
              console.warn(`[Webhook-Venda] ⚠️ Pedido ${pedidoId} encontrado mas sem itens em formato conhecido`, {
                temPedidoCompleto: !!pedidoCompleto,
                estruturaCompleta: JSON.stringify(pedidoCompleto).slice(0, 2000),
              });
            }
          }
        } catch (error) {
          console.error(`[Webhook-Venda] ❌ Erro ao buscar detalhes do pedido ${pedidoId}:`, {
            message: error.message,
            stack: error.stack,
            tenantId: tenantId,
            blingAccountId: blingAccountIdFinal,
          });
          // Continua mesmo com erro, pode ser que os itens estejam em outro formato
        }
      } else {
        console.warn(`[Webhook-Venda] ⚠️ Não foi possível identificar o blingAccountId para buscar pedido via API`, {
          temBlingAccountId: !!blingAccountId,
          companyId: payload.companyId,
          tenantId: tenantId,
        });
      }
    } else {
      console.warn(`[Webhook-Venda] ⚠️ Não foi possível identificar o pedidoId para buscar via API`, {
        temPedido: !!pedido,
        temPayloadData: !!payload.data,
        event: payload.event,
        pedidoKeys: pedido ? Object.keys(pedido) : [],
        payloadKeys: Object.keys(payload),
      });
    }
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    console.warn('[Webhook-Venda] ⚠️ Nenhum item encontrado no pedido', {
      pedidoId: pedido?.id || payload.data?.id,
      temPedido: !!pedido,
      temPayloadData: !!payload.data,
      event: payload.event,
    });
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
        console.warn('[Webhook-Venda] ⚠️ Item sem produtoId:', JSON.stringify(item, null, 2));
        continue;
      }

      const quantidade = item.quantidade || 
                        item.qtd || 
                        item.quantity || 
                        0;

      const depositoId = item.deposito?.id || 
                         item.depositoId || 
                         item.idDeposito ||
                         pedido?.deposito?.id ||
                         pedido?.depositoId ||
                         null;

      console.log(`[Webhook-Venda] 📦 Produto extraído:`, {
        produtoId: String(produtoId),
        quantidade: Number(quantidade),
        depositoId: depositoId ? String(depositoId) : 'não informado',
      });

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
  const eventNome = normalizarTexto(
    payload.event ||
      payload.tipo ||
      payload.type ||
      payload.data?.event ||
      payload.data?.evento
  );
  const dataTipo = normalizarTexto(
    payload.data?.tipoEvento || payload.data?.tipo || payload.data?.type
  );

  // Verifica se é um pedido de venda
  if (
    payload.pedido ||
    payload.data?.pedido ||
    payload.itens ||
    payload.data?.itens ||
    eventNome.includes('pedido') ||
    eventNome.includes('order') ||
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

  if (
    payload.data?.estoque ||
    payload.data?.stock ||
    payload.data?.produto ||
    payload.data?.product ||
    payload.produto ||
    payload.product
  ) {
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
  // Formato novo: payload.data (quando event é "order.created")
  // Formato antigo: payload.pedido ou payload.data.pedido
  const pedido = payload.pedido || 
                 payload.data?.pedido || 
                 (payload.event === 'order.created' ? payload.data : null) ||
                 payload;

  return {
    pedidoId: pedido?.id || 
              pedido?.pedidoId || 
              payload.data?.id || 
              payload.data?.pedidoId ||
              payload.pedido?.pedidoId ||
              payload.pedido?.id ||
              payload.id || 
              payload.pedidoId || 
              null,
    numero: pedido?.numero || payload.data?.numero || pedido?.numeroPedido || payload.pedido?.numero || null,
    numeroLoja: pedido?.numeroLoja || payload.data?.numeroLoja || payload.pedido?.numeroLoja || null,
    data: pedido?.data || payload.data?.data || pedido?.dataEmissao || payload.pedido?.data || new Date().toISOString(),
    blingAccountId: payload.blingAccountId || payload.accountId || payload.contaBlingId || payload.companyId || null,
    situacao: pedido?.situacao || payload.data?.situacao || pedido?.status || payload.data?.status || payload.pedido?.situacao || null,
  };
}

/**
 * Processa webhook de venda e retorna eventos para cada produto
 * @param {Object} payload - Payload do webhook do Bling
 * @param {string} tenantId - ID do tenant (opcional, pode ser extraído depois)
 * @param {string} blingAccountId - ID da conta Bling (opcional)
 * @returns {Promise<Array>} Array de eventos prontos para serem adicionados na fila
 */
export async function processarWebhookVenda(payload, tenantId = null, blingAccountId = null) {
  const tipoEvento = identificarTipoEvento(payload);
  const eventos = [];

  console.log(`[Webhook-Venda] 📦 Tipo de evento identificado: ${tipoEvento}`);

  if (tipoEvento === 'venda') {
    // Extrair informações do pedido
    const infoPedido = extrairInfoPedido(payload);
    const pedidoId = infoPedido.pedidoId || `pedido-${Date.now()}`;
    
    // Usar companyId como blingAccountId se não foi fornecido
    const blingAccountIdFinal = blingAccountId || infoPedido.blingAccountId || payload.companyId;

    // Log detalhado do pedido para facilitar identificação no Bling
    console.log(`[Webhook-Venda] 📦 Informações do pedido:`, {
      pedidoId: infoPedido.pedidoId,
      numero: infoPedido.numero,
      numeroLoja: infoPedido.numeroLoja,
      data: infoPedido.data,
      situacao: infoPedido.situacao,
      companyId: payload.companyId,
      eventId: payload.eventId,
      blingAccountId: blingAccountIdFinal,
      tenantId: tenantId,
    });

    // Extrair produtos do pedido (agora é async e pode buscar via API se necessário)
    const produtos = await extrairProdutosDoPedido(payload, tenantId, blingAccountIdFinal);

    console.log(`[Webhook-Venda] 📦 Produtos encontrados no pedido: ${produtos.length}`);
    
    if (produtos.length === 0) {
      console.warn(`[Webhook-Venda] ⚠️ Nenhum produto extraído do pedido ${pedidoId}. Verifique se o webhook inclui os itens ou se a API do Bling está acessível.`);
    }

    // Criar um evento para cada produto
    for (const produto of produtos) {
      const eventoId = `${pedidoId}-produto-${produto.produtoId}`;

      eventos.push({
        produtoId: produto.produtoId,
        eventoId: eventoId,
        depositoId: produto.depositoId,
        tenantId: tenantId,
        blingAccountId: blingAccountIdFinal,
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
      payloadPreview: JSON.stringify(payload).slice(0, 1500),
    });
  }

  return eventos;
}






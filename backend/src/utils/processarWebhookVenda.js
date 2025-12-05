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
 * @returns {Promise<{ produtos: Array, blingAccountIdUsado: string|null }>} Produtos com { produtoId, quantidade, depositoId } e conta usada para buscar itens
 */
export async function extrairProdutosDoPedido(payload, tenantId = null, blingAccountId = null) {
  const produtos = [];
  let blingAccountIdUsado =
    blingAccountId || payload?.companyId || payload?.data?.companyId || null;
  const forcarBuscaPedidoCompleto = payload.event === 'order.created';

  // Formato 1: payload.pedido ou payload.data.pedido
  // Formato novo: payload.data (quando event é "order.created")
  const pedido = payload.pedido || 
                 payload.data?.pedido || 
                 (payload.event === 'order.created' ? payload.data : null) ||
                 payload;

  // Formato 2: payload.itens ou pedido.itens
  let itens = pedido?.itens || payload.itens || payload.data?.itens || [];

  const registrarItensDoPedido = (pedidoCompleto, pedidoIdLog, contaLog = {}) => {
    console.log(`[Webhook-Venda] 📦 Estrutura do pedido retornado pela API:`, {
      temPedido: !!pedidoCompleto,
      contaBlingId: contaLog.blingAccountId,
      contaNome: contaLog.accountName,
      keys: pedidoCompleto ? Object.keys(pedidoCompleto) : [],
      temItens: !!pedidoCompleto?.itens,
      tipoItens: pedidoCompleto?.itens
        ? (Array.isArray(pedidoCompleto.itens) ? 'array' : typeof pedidoCompleto.itens)
        : 'undefined',
      quantidadeItens: Array.isArray(pedidoCompleto?.itens) ? pedidoCompleto.itens.length : 'N/A',
      primeiroItem: Array.isArray(pedidoCompleto?.itens) && pedidoCompleto.itens.length > 0 
        ? JSON.stringify(pedidoCompleto.itens[0]).slice(0, 500) 
        : 'N/A',
    });

    if (pedidoCompleto) {
      // Formato 1: pedidoCompleto.itens (array direto)
      if (pedidoCompleto.itens && Array.isArray(pedidoCompleto.itens) && pedidoCompleto.itens.length > 0) {
        itens = pedidoCompleto.itens;
        console.log(`[Webhook-Venda] ✅ ${itens.length} item(ns) encontrado(s) em pedidoCompleto.itens`);
        return true;
      }
      // Formato 2: pedidoCompleto.data.itens
      if (pedidoCompleto.data?.itens && Array.isArray(pedidoCompleto.data.itens) && pedidoCompleto.data.itens.length > 0) {
        itens = pedidoCompleto.data.itens;
        console.log(`[Webhook-Venda] ✅ ${itens.length} item(ns) encontrado(s) em pedidoCompleto.data.itens`);
        return true;
      }
      // Formato 3: pedidoCompleto.items (em inglês)
      if (pedidoCompleto.items && Array.isArray(pedidoCompleto.items) && pedidoCompleto.items.length > 0) {
        itens = pedidoCompleto.items;
        console.log(`[Webhook-Venda] ✅ ${itens.length} item(ns) encontrado(s) em pedidoCompleto.items`);
        return true;
      }
      // Formato 4: pedidoCompleto.produtos
      if (pedidoCompleto.produtos && Array.isArray(pedidoCompleto.produtos) && pedidoCompleto.produtos.length > 0) {
        itens = pedidoCompleto.produtos;
        console.log(`[Webhook-Venda] ✅ ${itens.length} item(ns) encontrado(s) em pedidoCompleto.produtos`);
        return true;
      }

      console.warn(`[Webhook-Venda] ⚠️ Pedido ${pedidoIdLog} encontrado mas sem itens em formato conhecido`, {
        temPedidoCompleto: !!pedidoCompleto,
        contaBlingId: contaLog.blingAccountId,
        estruturaCompleta: JSON.stringify(pedidoCompleto).slice(0, 2000),
      });
    }
    return false;
  };

  // Se não encontrou itens e temos informações suficientes, buscar detalhes completos do pedido via API
  if ((forcarBuscaPedidoCompleto || (!Array.isArray(itens) || itens.length === 0)) && tenantId) {
    const pedidoId = pedido?.id || 
                     pedido?.pedidoId || 
                     payload.data?.id || 
                     payload.data?.pedidoId ||
                     payload.pedido?.pedidoId ||
                     payload.pedido?.id ||
                     payload.id ||
                     payload.pedidoId;
    const companyId = payload.companyId || payload.data?.companyId;

    if (pedidoId) {
      const contasAtivas = await BlingConfig.find({
        tenantId,
        is_active: true,
        access_token: { $exists: true, $ne: null },
      })
        .select('blingAccountId accountName store_id store_name')
        .lean();

      const candidatos = [];
      const candidatosSet = new Set();

      const adicionarCandidato = (conta, motivo) => {
        if (!conta?.blingAccountId) {
          return;
        }
        const id = String(conta.blingAccountId);
        if (candidatosSet.has(id)) {
          return;
        }
        candidatosSet.add(id);
        candidatos.push({ ...conta, blingAccountId: id, motivo });
      };

      let blingAccountIdFinal = blingAccountId;

      if (blingAccountIdFinal) {
        const contaPayload = contasAtivas.find(
          (c) => String(c.blingAccountId) === String(blingAccountIdFinal)
        );
        if (contaPayload) {
          adicionarCandidato(contaPayload, 'blingAccountId-payload');
        } else {
          console.warn(
            `[Webhook-Venda] ⚠️ Conta ${blingAccountIdFinal} informada no webhook não está ativa para o tenant ${tenantId}`
          );
        }
      }

      if (companyId) {
        const contaPorCompany = contasAtivas.find(
          (c) =>
            String(c.blingAccountId) === String(companyId) ||
            String(c.store_id) === String(companyId)
        );
        if (contaPorCompany) {
          blingAccountIdFinal = contaPorCompany.blingAccountId;
          adicionarCandidato(contaPorCompany, 'companyId');
          console.log(
            `[Webhook-Venda] ✅ Conta Bling identificada pelo companyId ${companyId}: ${contaPorCompany.blingAccountId} (${contaPorCompany.accountName || contaPorCompany.store_name || 'N/A'})`
          );
        } else {
          console.warn(
            `[Webhook-Venda] ⚠️ Conta Bling não encontrada para companyId ${companyId} no tenant ${tenantId}`
          );
          if (Array.isArray(contasAtivas) && contasAtivas.length > 0) {
            console.log(
              `[Webhook-Venda] 📋 Contas disponíveis no tenant:`,
              contasAtivas.map((c) => ({
                blingAccountId: c.blingAccountId,
                accountName: c.accountName,
                store_id: c.store_id,
              }))
            );
          }
        }
      }

      if (candidatos.length === 0 && contasAtivas.length > 0) {
        contasAtivas.forEach((conta) => adicionarCandidato(conta, 'fallback-conta-ativa'));
      }

      const contasTestadas = [];

      const tentarBuscarPedido = async (conta, motivo) => {
        contasTestadas.push({ ...conta, motivo });
        console.log(
          `[Webhook-Venda] 🔍 Itens não encontrados no webhook. Buscando detalhes completos do pedido ${pedidoId} via API (conta ${conta.blingAccountId}, motivo: ${motivo})...`
        );
        console.log(`[Webhook-Venda] 📋 Dados para busca:`, {
          pedidoId: String(pedidoId),
          tenantId: tenantId,
          blingAccountId: conta.blingAccountId,
          pedidoKeys: pedido ? Object.keys(pedido) : [],
          payloadKeys: Object.keys(payload),
        });

        try {
          const pedidoCompleto = await blingService.getPedidoVenda(
            String(pedidoId),
            tenantId,
            conta.blingAccountId
          );
          console.log(
            `[Webhook-Venda] 🧾 Retorno completo do pedido ${pedidoId} (conta ${conta.blingAccountId}, event ${payload.event || 'n/a'}):`,
            JSON.stringify(pedidoCompleto, null, 2)
          );
          const temItens = registrarItensDoPedido(pedidoCompleto, pedidoId, conta);
          if (temItens) {
            blingAccountIdUsado = conta.blingAccountId;
            return true;
          }
        } catch (error) {
          console.error(`[Webhook-Venda] ❌ Erro ao buscar detalhes do pedido ${pedidoId}:`, {
            message: error.message,
            tenantId: tenantId,
            blingAccountId: conta.blingAccountId,
            motivo,
          });
        }
        return false;
      };

      for (const candidato of candidatos) {
        const sucesso = await tentarBuscarPedido(candidato, candidato.motivo);
        if (sucesso) {
          break;
        }
      }

      if ((!Array.isArray(itens) || itens.length === 0) && candidatos.length === 0) {
        console.warn(
          `[Webhook-Venda] ⚠️ Não foi possível buscar itens do pedido ${pedidoId} porque nenhuma conta Bling ativa com token foi encontrada para o tenant ${tenantId}`
        );
      } else if (!Array.isArray(itens) || itens.length === 0) {
        console.warn(
          `[Webhook-Venda] ⚠️ Pedido ${pedidoId} não retornou itens nas contas testadas`,
          {
            contasTestadas: contasTestadas.map((c) => ({
              blingAccountId: c.blingAccountId,
              motivo: c.motivo,
              accountName: c.accountName,
              store_id: c.store_id,
            })),
            companyId,
          }
        );
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
    return { produtos, blingAccountIdUsado };
  }

  // Extrair produtos dos itens
  for (const item of itens) {
    // Preferir código/SKU; se não existir, usa IDs
    const produtoId = item.codigo ||
                      item.codigoProduto ||
                      item.produto?.codigo ||
                      item.produto?.id || 
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
      sku: item.codigo || item.codigoProduto || null,
    });
  }

  return { produtos, blingAccountIdUsado };
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

// Busca um produtoId/codigo em estruturas diversas do payload (fallback para eventos sem itens)
function buscarProdutoIdNoPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidatos = [
    payload?.data?.produto,
    payload?.data?.product,
    payload?.produto,
    payload?.product,
    payload?.data,
  ].filter(Boolean);

  const tentarExtrair = (obj) => {
    if (!obj || typeof obj !== 'object') {
      return null;
    }
    const possiveisIds = [
      obj.id,
      obj.produtoId,
      obj.productId,
      obj.codigo,
      obj.sku,
      obj.codigoProduto,
    ].filter(Boolean);
    if (possiveisIds.length > 0) {
      return possiveisIds[0];
    }
    if (Array.isArray(obj.itens) && obj.itens.length > 0) {
      const item0 = obj.itens[0];
      return (
        item0?.produto?.id ||
        item0?.produtoId ||
        item0?.idProduto ||
        item0?.productId ||
        item0?.codigo ||
        item0?.sku ||
        null
      );
    }
    if (obj.item) {
      return (
        obj.item?.produto?.id ||
        obj.item?.produtoId ||
        obj.item?.idProduto ||
        obj.item?.productId ||
        obj.item?.codigo ||
        obj.item?.sku ||
        null
      );
    }
    return null;
  };

  for (const candidato of candidatos) {
    const valor = tentarExtrair(candidato);
    if (valor) {
      return valor;
    }
  }

  // Busca rasa em todas as chaves de data
  if (payload.data && typeof payload.data === 'object') {
    for (const value of Object.values(payload.data)) {
      const valor = tentarExtrair(value);
      if (valor) {
        return valor;
      }
    }
  }

  return null;
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
    const nomeEvento = normalizarTexto(
      payload.event ||
      payload.tipo ||
      payload.type ||
      payload.data?.event ||
      payload.data?.tipo
    );
    const ehCancelamento =
      nomeEvento.includes('cancel') ||
      nomeEvento.includes('delete') ||
      nomeEvento.includes('remocao') ||
      nomeEvento.includes('remover') ||
      nomeEvento.includes('excluir') ||
      nomeEvento.includes('canceled') ||
      nomeEvento.includes('removed');

    // Não processar order.deleted (não há itens e o pedido já foi removido)
    if (ehCancelamento) {
      console.warn('[Webhook-Venda] ⚠️ Evento de cancelamento/remoção detectado. Nenhum item disponível. Ignorando para evitar carga desnecessária.');
      return [];
    }

    // Extrair informações do pedido
    const infoPedido = extrairInfoPedido(payload);
    const pedidoId = infoPedido.pedidoId || `pedido-${Date.now()}`;
    
    // Usar companyId como blingAccountId se não foi fornecido
    let blingAccountIdFinal = blingAccountId || infoPedido.blingAccountId || payload.companyId;

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
    const produtosResultado = await extrairProdutosDoPedido(payload, tenantId, blingAccountIdFinal);
    const produtos = Array.isArray(produtosResultado)
      ? produtosResultado
      : produtosResultado?.produtos || [];
    const contaUsadaParaItens = Array.isArray(produtosResultado)
      ? null
      : produtosResultado?.blingAccountIdUsado;

    if (contaUsadaParaItens) {
      blingAccountIdFinal = contaUsadaParaItens;
      console.log(
        `[Webhook-Venda] 🔗 Conta Bling usada para ler itens do pedido: ${contaUsadaParaItens}`
      );
    }

    console.log(`[Webhook-Venda] 📦 Produtos encontrados no pedido: ${produtos.length}`);
    
    if (produtos.length === 0) {
      console.warn(`[Webhook-Venda] ⚠️ Nenhum produto extraído do pedido ${pedidoId}. Verifique se o webhook inclui os itens ou se a API do Bling está acessível.`);
      // Fallback: se o webhook trouxer produto/quantidade diretamente, ainda assim gerar evento para recalcular compartilhado
      const produtoDireto =
        payload?.data?.produto?.id ||
        payload?.data?.produtoId ||
        payload?.produtoId ||
        payload?.idProduto ||
        buscarProdutoIdNoPayload(payload) ||
        null;
      const quantidadeDireta =
        payload?.data?.quantidade ||
        payload?.quantidade ||
        payload?.data?.qtd ||
        null;
      const depositoDireto =
        payload?.data?.deposito?.id ||
        payload?.data?.depositoId ||
        payload?.depositoId ||
        null;

      if (produtoDireto) {
        console.log(
          `[Webhook-Venda] 🔄 Fallback: gerando evento único com produto direto do payload para recalcular compartilhado (produto ${produtoDireto}, quantidade ${quantidadeDireta ?? 'N/A'})`
        );
        const eventoId = `${pedidoId}-produto-${produtoDireto}`;
        eventos.push({
          produtoId: String(produtoDireto),
          eventoId,
          depositoId: depositoDireto ? String(depositoDireto) : null,
          tenantId,
          blingAccountId: blingAccountIdFinal,
          tipo: ehCancelamento ? 'venda_removida' : 'venda',
          origem: 'webhook',
          dados: {
            pedidoId,
            numeroPedido: infoPedido.numero,
            quantidade: Number(quantidadeDireta) || null,
            dataPedido: infoPedido.data,
            situacao: infoPedido.situacao,
            sku: null,
            item: null,
            tipoOperacaoEstoque: ehCancelamento ? 'entrada' : 'saida',
            evento: payload.event,
            ajustarCompartilhadoPorVenda: payload.event === 'order.created',
          },
          recebidoEm: new Date().toISOString(),
        });
      }
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
        tipo: ehCancelamento ? 'venda_removida' : 'venda',
        origem: 'webhook',
        dados: {
          pedidoId: pedidoId,
          numeroPedido: infoPedido.numero,
          quantidade: produto.quantidade,
          dataPedido: infoPedido.data,
          situacao: infoPedido.situacao,
          sku: produto.sku || produto.produtoId,
          item: produto.item,
          tipoOperacaoEstoque: ehCancelamento ? 'entrada' : 'saida',
          evento: payload.event,
          ajustarCompartilhadoPorVenda: payload.event === 'order.created',
        },
        recebidoEm: new Date().toISOString(),
      });
    }
  } else if (tipoEvento === 'estoque') {
    // Evento direto de estoque (ajuste manual/entrada/saída)
    const eventoId = payload.eventoId || payload.idEvento || payload.eventId || `estoque-${Date.now()}`;
    const produtoExtraido = extrairProdutoEstoque(payload);
    const produtoId = produtoExtraido.produtoId;
    const depositoId = extrairDeposito(payload);
    const quantidadeEstoque =
      payload?.quantidade ??
      payload?.data?.quantidade ??
      payload?.data?.deposito?.saldoFisico ??
      null;
    const operacaoEstoque = payload?.data?.operacao || payload?.operacao || null;

    // Log detalhado do webhook de estoque para investigar problema de reservado
    console.log('[Webhook-Estoque] 📦 Webhook de estoque recebido:', {
      produtoId,
      depositoId,
      operacaoEstoque,
      quantidadeEstoque,
      saldoFisicoTotal: payload?.data?.saldoFisicoTotal,
      saldoVirtualTotal: payload?.data?.saldoVirtualTotal,
      saldoReservado: payload?.data?.saldoReservado || payload?.data?.reservado,
      saldoDepositoFisico: payload?.data?.deposito?.saldoFisico,
      saldoDepositoVirtual: payload?.data?.deposito?.saldoVirtual,
      saldoDepositoReservado: payload?.data?.deposito?.saldoReservado || payload?.data?.deposito?.reservado,
      payloadKeys: Object.keys(payload || {}),
      dataKeys: Object.keys(payload?.data || {}),
      depositoKeys: Object.keys(payload?.data?.deposito || {}),
      payloadPreview: JSON.stringify(payload).slice(0, 2000),
    });

    if (produtoId) {
      eventos.push({
        produtoId: String(produtoId),
        eventoId: eventoId,
        depositoId,
        tenantId: tenantId,
        blingAccountId: blingAccountId || payload.blingAccountId || payload.accountId || payload.data?.companyId,
        tipo: 'estoque',
        origem: 'webhook',
        dados: {
          quantidade: quantidadeEstoque,
          depositoId,
          operacaoEstoque,
          saldoFisicoTotal: payload?.data?.saldoFisicoTotal,
          saldoVirtualTotal: payload?.data?.saldoVirtualTotal,
          saldoReservado: payload?.data?.saldoReservado || payload?.data?.reservado,
          saldoDepositoFisico: payload?.data?.deposito?.saldoFisico,
          saldoDepositoVirtual: payload?.data?.deposito?.saldoVirtual,
          saldoDepositoReservado: payload?.data?.deposito?.saldoReservado || payload?.data?.deposito?.reservado,
          raw: payload,
        },
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

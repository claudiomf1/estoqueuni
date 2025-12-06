import { manipuladoresContas } from './manipuladores-contas.js';
import { manipuladoresOAuth } from './manipuladores-oauth.js';
import { manipuladoresEstoque } from './manipuladores-estoque.js';
import { manipuladoresDepositos } from './manipuladores-depositos.js';
import blingService from '../../services/blingService.js';
import sincronizadorEstoqueService from '../../services/sincronizadorEstoqueService.js';
import BlingConfig from '../../models/BlingConfig.js';
import pedidoReservadoService from '../../services/pedidoReservadoService.js';
import ReservaEstoqueCache from '../../models/ReservaEstoqueCache.js';

/**
 * Controller para gerenciar múltiplas contas Bling por tenant
 * 
 * Este controller orquestra as operações relacionadas a:
 * - Gerenciamento de contas Bling
 * - Autorização OAuth
 * - Sincronização de estoque
 * - Gerenciamento de depósitos
 */
class BlingMultiAccountController {
  // ===== GERENCIAMENTO DE CONTAS =====
  
  async listarContas(req, res) {
    return manipuladoresContas.listarContas(req, res);
  }

  async obterConta(req, res) {
    return manipuladoresContas.obterConta(req, res);
  }

  async adicionarConta(req, res) {
    return manipuladoresContas.adicionarConta(req, res);
  }

  async removerConta(req, res) {
    return manipuladoresContas.removerConta(req, res);
  }

  async atualizarConta(req, res) {
    return manipuladoresContas.atualizarConta(req, res);
  }

  async toggleConta(req, res) {
    return manipuladoresContas.toggleConta(req, res);
  }

  // ===== OAUTH =====

  async callbackAutorizacao(req, res) {
    return manipuladoresOAuth.callbackAutorizacao(req, res);
  }

  async iniciarAutorizacao(req, res) {
    return manipuladoresOAuth.iniciarAutorizacao(req, res);
  }

  // ===== SINCRONIZAÇÃO DE ESTOQUE =====

  async sincronizarEstoqueUnificado(req, res) {
    return manipuladoresEstoque.sincronizarEstoqueUnificado(req, res);
  }

  async sincronizarEstoqueProdutoUnico(req, res) {
    return manipuladoresEstoque.sincronizarEstoqueProdutoUnico(req, res);
  }

  async buscarEstoqueUnificado(req, res) {
    return manipuladoresEstoque.buscarEstoqueUnificado(req, res);
  }

  // ===== GERENCIAMENTO DE DEPÓSITOS =====

  async listarDepositos(req, res) {
    return manipuladoresDepositos.listarDepositos(req, res);
  }

  async criarDeposito(req, res) {
    return manipuladoresDepositos.criarDeposito(req, res);
  }

  async verificarDeposito(req, res) {
    return manipuladoresDepositos.verificarDeposito(req, res);
  }

  async deletarDeposito(req, res) {
    return manipuladoresDepositos.deletarDeposito(req, res);
  }

  // ===== PEDIDOS =====
  async listarPedidos(req, res) {
    try {
      const { tenantId, blingAccountId } = req.query;
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId é obrigatório' });
      }
      const [pedidosDb, contas] = await Promise.all([
        pedidoReservadoService.listar({
          tenantId,
          blingAccountId: blingAccountId || undefined,
        }),
        BlingConfig.find({
          tenantId,
          ...(blingAccountId ? { blingAccountId } : {}),
        })
          .select('blingAccountId accountName')
          .lean(),
      ]);

      const contaPorId = contas.reduce((acc, conta) => {
        acc[conta.blingAccountId] = conta.accountName || conta.blingAccountId;
        return acc;
      }, {});

      const reservas = await ReservaEstoqueCache.find({
        tenantId,
        ...(blingAccountId ? { blingAccountId } : {}),
        $or: [{ saldoReservadoEfetivo: { $gt: 0 } }, { reservadoCalculado: { $gt: 0 } }],
      })
        .select('blingAccountId produtoId depositoId saldoReservadoEfetivo reservadoCalculado updatedAt')
        .lean();

      const fallbackPedidos = (reservas || []).map((r) => ({
        pedidoId: `cache:${r.produtoId}:${r.depositoId}`,
        numero: '-',
        data: r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : '-',
        clienteNome: 'Reserva detectada',
        total: 0,
        blingAccountId: r.blingAccountId,
        produtoIds: [String(r.produtoId)],
        origem: 'cache',
      }));

      // Mescla pedidos da coleção com as reservas do cache (fallback) para não perder entradas
      const pedidosMap = new Map();
      const adicionarPedido = (p) => {
        const pedidoId = String(p.pedidoId || p.id || `pedido-${pedidosMap.size}`);
        const chave = `${p.blingAccountId || 'sem-conta'}:${pedidoId}`;
        pedidosMap.set(chave, {
          ...p,
          pedidoId,
          accountName: p.accountName || contaPorId[p.blingAccountId] || p.blingAccountId,
        });
      };

      (pedidosDb || []).forEach(adicionarPedido);
      (fallbackPedidos || []).forEach(adicionarPedido);

      const pedidosEnriquecidos = Array.from(pedidosMap.values());

      // Completa dados faltantes (cliente, numero, total) buscando no Bling quando possível
      for (const pedido of pedidosEnriquecidos) {
        const precisaEnriquecerCliente = !pedido.clienteNome;
        const precisaEnriquecerNumero = !pedido.numero || pedido.numero === '-';
        const precisaEnriquecerData = !pedido.data || pedido.data === '-';
        const precisaEnriquecerTotal =
          pedido.total === undefined || pedido.total === null || Number.isNaN(pedido.total);

        const ehPedidoCache = String(pedido.pedidoId).startsWith('cache:');
        if (ehPedidoCache || !(precisaEnriquecerCliente || precisaEnriquecerNumero || precisaEnriquecerTotal || precisaEnriquecerData)) {
          continue;
        }

        try {
          const detalhes = await blingService.getPedidoVenda(
            pedido.pedidoId,
            tenantId,
            pedido.blingAccountId
          );
          if (detalhes) {
            pedido.clienteNome =
              pedido.clienteNome ||
              detalhes?.cliente?.nome ||
              detalhes?.contato?.nome ||
              detalhes?.clienteNome ||
              null;
            pedido.numero = pedido.numero || detalhes?.numero || detalhes?.numeroPedido || null;
            pedido.data =
              pedido.data ||
              detalhes?.data ||
              detalhes?.dataEmissao ||
              detalhes?.createdAt ||
              null;
            const totalDetalhes =
              detalhes?.total ??
              detalhes?.valor ??
              detalhes?.valorTotal ??
              detalhes?.valorPedido ??
              null;
            if (pedido.total === undefined || pedido.total === null || Number(pedido.total) === 0) {
              const totalNormalizado = Number(totalDetalhes);
              pedido.total = Number.isFinite(totalNormalizado) ? totalNormalizado : pedido.total;
            }
          }
        } catch (error) {
          console.warn(
            `[BlingMultiAccountController] ⚠️ Falha ao enriquecer pedido ${pedido.pedidoId}:`,
            error.message
          );
        }
      }

      return res.json({ data: pedidosEnriquecidos });
    } catch (error) {
      console.error('[BlingMultiAccountController] Erro ao listar pedidos:', error.message);
      return res.status(500).json({ error: error.message || 'Falha ao listar pedidos' });
    }
  }

  async removerPedido(req, res) {
    try {
      const { pedidoId } = req.params;
      const { tenantId, blingAccountId } = req.body;
      if (!pedidoId) {
        return res.status(400).json({ error: 'pedidoId é obrigatório' });
      }
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId é obrigatório' });
      }
      if (!blingAccountId) {
        return res.status(400).json({ error: 'blingAccountId é obrigatório' });
      }

      const resultado = await sincronizadorEstoqueService.removerPedido({
        pedidoId,
        tenantId,
        blingAccountId,
      });

      if (resultado.sucesso) {
        return res.json({ sucesso: true, resultado });
      }
      return res.status(400).json({ sucesso: false, resultado });
    } catch (error) {
      console.error('[BlingMultiAccountController] Erro ao remover pedido:', error.message);
      return res.status(500).json({ error: error.message || 'Falha ao remover pedido' });
    }
  }
}

export default BlingMultiAccountController;

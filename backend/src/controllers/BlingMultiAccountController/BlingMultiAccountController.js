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

      // Se já existem pedidos no banco, tentar enriquecer dados faltantes (cliente/total/numero/data) e não exibir fallback de cache
      if (pedidosDb && pedidosDb.length > 0) {
        const pedidosEnriquecidos = [];

        for (const p of pedidosDb) {
          const pedidoEnriquecido = {
            ...p,
            accountName: p.accountName || contaPorId[p.blingAccountId] || p.blingAccountId,
          };

          const precisaCliente =
            !pedidoEnriquecido.clienteNome && !pedidoEnriquecido.cliente;
          const precisaNumero = !pedidoEnriquecido.numero || pedidoEnriquecido.numero === '-';
          const precisaData = !pedidoEnriquecido.data || pedidoEnriquecido.data === '-';
          const precisaTotal =
            pedidoEnriquecido.total === undefined ||
            pedidoEnriquecido.total === null ||
            Number.isNaN(pedidoEnriquecido.total);

          const ehPedidoCache = String(pedidoEnriquecido.pedidoId).startsWith('cache:');

          if (!ehPedidoCache && (precisaCliente || precisaNumero || precisaData || precisaTotal)) {
            try {
              const detalhes = await blingService.getPedidoVenda(
                pedidoEnriquecido.pedidoId,
                tenantId,
                pedidoEnriquecido.blingAccountId
              );
              if (detalhes) {
                pedidoEnriquecido.clienteNome =
                  pedidoEnriquecido.clienteNome ||
                  detalhes?.cliente?.nome ||
                  detalhes?.contato?.nome ||
                  detalhes?.clienteNome ||
                  null;
                pedidoEnriquecido.numero =
                  pedidoEnriquecido.numero || detalhes?.numero || detalhes?.numeroPedido || null;
                pedidoEnriquecido.data =
                  pedidoEnriquecido.data ||
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
                if (
                  pedidoEnriquecido.total === undefined ||
                  pedidoEnriquecido.total === null ||
                  Number(pedidoEnriquecido.total) === 0
                ) {
                  const totalNormalizado = Number(totalDetalhes);
                  pedidoEnriquecido.total = Number.isFinite(totalNormalizado)
                    ? totalNormalizado
                    : pedidoEnriquecido.total;
                }
              }
            } catch (error) {
              console.warn(
                `[BlingMultiAccountController] ⚠️ Falha ao enriquecer pedido ${pedidoEnriquecido.pedidoId}:`,
                error.message
              );
            }
          }

          pedidosEnriquecidos.push(pedidoEnriquecido);
        }

        return res.json({ data: pedidosEnriquecidos });
      }

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

      // Somente fallback de cache (sem pedidos no banco)
      return res.json({ data: fallbackPedidos.map((p) => ({
        ...p,
        accountName: contaPorId[p.blingAccountId] || p.blingAccountId,
      })) });
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

import PedidoReservado from '../models/PedidoReservado.js';

const pedidoReservadoService = {
  async upsert({
    tenantId,
    blingAccountId,
    pedidoId,
    numero,
    data,
    clienteNome,
    total,
    produtoIds = [],
  }) {
    if (!tenantId || !blingAccountId || !pedidoId) return null;
    const produtoIdsUnicos = Array.from(
      new Set(
        (Array.isArray(produtoIds) ? produtoIds : []).filter(Boolean).map(String)
      )
    );
    try {
      await PedidoReservado.findOneAndUpdate(
        { tenantId, blingAccountId, pedidoId: String(pedidoId) },
        {
          $set: {
            numero: numero ? String(numero) : undefined,
            data: data || undefined,
            clienteNome: clienteNome || undefined,
            total: Number(total) || 0,
            produtoIds: produtoIdsUnicos,
          },
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.warn('[PedidoReservadoService] Falha ao salvar pedido reservado:', error.message);
    }
  },

  async remover({ tenantId, pedidoId, blingAccountId }) {
    if (!tenantId || !pedidoId) return;
    const filtro = {
      tenantId,
      pedidoId: String(pedidoId),
      ...(blingAccountId ? { blingAccountId } : {}),
    };
    try {
      await PedidoReservado.deleteMany(filtro);
    } catch (error) {
      console.warn('[PedidoReservadoService] Falha ao remover pedido reservado:', error.message);
    }
  },

  async listar({ tenantId, blingAccountId }) {
    if (!tenantId) return [];
    const filtro = { tenantId, ...(blingAccountId ? { blingAccountId } : {}) };
    return PedidoReservado.find(filtro)
      .sort({ updatedAt: -1 })
      .lean();
  },
};

export default pedidoReservadoService;

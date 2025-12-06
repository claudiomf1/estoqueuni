import mongoose from 'mongoose';

const pedidoReservadoSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    blingAccountId: { type: String, required: true, index: true, trim: true },
    pedidoId: { type: String, required: true, index: true, trim: true },
    numero: { type: String, trim: true },
    data: { type: String, trim: true },
    clienteNome: { type: String, trim: true },
    total: { type: Number, default: 0 },
    produtoIds: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

pedidoReservadoSchema.index(
  { tenantId: 1, blingAccountId: 1, pedidoId: 1 },
  { unique: true }
);

const PedidoReservado = mongoose.model(
  'PedidoReservado',
  pedidoReservadoSchema,
  'estoqueuni_pedidos_reservados'
);

export default PedidoReservado;

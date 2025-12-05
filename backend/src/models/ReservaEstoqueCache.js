import mongoose from 'mongoose';

const seteDiasMs = 7 * 24 * 60 * 60 * 1000;

const reservaCacheSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    blingAccountId: { type: String, required: true, index: true, trim: true },
    produtoId: { type: String, required: true, index: true, trim: true },
    depositoId: { type: String, required: true, index: true, trim: true },
    sku: { type: String, trim: true, index: true },
    saldoReservadoEfetivo: { type: Number, default: 0 },
    saldoFisico: { type: Number, default: 0 },
    saldoVirtual: { type: Number, default: 0 },
    reservadoCalculado: { type: Number, default: 0 },
    origem: { type: String, default: 'desconhecida' },
    ultimaLeitura: { type: Date, default: Date.now, index: true },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + seteDiasMs),
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true }
);

reservaCacheSchema.index(
  { tenantId: 1, blingAccountId: 1, produtoId: 1, depositoId: 1 },
  { unique: true }
);

const ReservaEstoqueCache = mongoose.model(
  'ReservaEstoqueCache',
  reservaCacheSchema,
  'estoqueuni_reservaCache'
);

export default ReservaEstoqueCache;

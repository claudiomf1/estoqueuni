import mongoose from 'mongoose';

const inconsistenciaSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    motivo: {
      type: String,
      trim: true,
    },
    ultimaDeteccao: {
      type: Date,
      default: Date.now,
      index: true,
    },
    contador: {
      type: Number,
      default: 1,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: true,
  }
);

inconsistenciaSchema.index({ tenantId: 1, sku: 1 }, { unique: true });

const InconsistenciaEstoque = mongoose.model(
  'InconsistenciaEstoque',
  inconsistenciaSchema,
  'estoqueuni_inconsistenciasEstoque'
);

export default InconsistenciaEstoque;

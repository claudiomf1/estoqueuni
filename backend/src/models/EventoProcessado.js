import mongoose from 'mongoose';

const saldosSchema = new mongoose.Schema(
  {
    depositoId: { type: String, trim: true },
    nomeDeposito: { type: String, trim: true },
    valor: { type: Number, default: 0 },
    origemConta: { type: String, trim: true },
  },
  { _id: false }
);

const compartilhadoSchema = new mongoose.Schema(
  {
    depositoId: { type: String, trim: true },
    nomeDeposito: { type: String, trim: true },
    sucesso: { type: Boolean, default: true },
    mensagem: { type: String, trim: true },
    erro: { type: String, trim: true },
  },
  { _id: false }
);

const eventoProcessadoSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    blingAccountId: {
      type: String,
      trim: true,
    },
    produtoId: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },
    eventoId: {
      type: String,
      trim: true,
    },
    chaveUnica: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    depositoOrigem: {
      type: String,
      trim: true,
    },
    origem: {
      type: String,
      enum: ['webhook', 'cronjob', 'manual', 'fallback', 'api'],
      default: 'manual',
    },
    saldos: {
      type: [saldosSchema],
      default: [],
    },
    soma: {
      type: Number,
      default: 0,
    },
    compartilhadosAtualizados: {
      type: [compartilhadoSchema],
      default: [],
    },
    resultado: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    sucesso: {
      type: Boolean,
      default: true,
    },
    erro: {
      type: String,
      trim: true,
      default: null,
    },
    processadoEm: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

eventoProcessadoSchema.index({ tenantId: 1, processadoEm: -1 });
eventoProcessadoSchema.index({ origem: 1, processadoEm: -1 });

eventoProcessadoSchema.statics.criarChaveUnica = function (
  produtoId,
  eventoId,
  depositoId = null,
  quantidade = null
) {
  if (!produtoId || !eventoId) {
    return null;
  }
  const partes = [produtoId, eventoId];
  if (depositoId) {
    partes.push(`dep:${depositoId}`);
  }
  if (quantidade !== null && quantidade !== undefined) {
    const q = Number(quantidade);
    if (Number.isFinite(q)) {
      partes.push(`q:${q}`);
    }
  }
  return partes.join('-');
};

eventoProcessadoSchema.statics.verificarSeProcessado = async function (
  chaveUnica,
  tenantId = null
) {
  if (!chaveUnica) {
    return false;
  }

  const filtro = { chaveUnica };
  if (tenantId) {
    filtro.tenantId = tenantId;
  }

  const existente = await this.findOne(filtro).select('_id').lean();
  return Boolean(existente);
};

const EventoProcessado = mongoose.model(
  'EventoProcessado',
  eventoProcessadoSchema,
  'estoqueuni_eventosProcessados'
);

export default EventoProcessado;

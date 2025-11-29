import mongoose from 'mongoose';

/**
 * Model de Tenant para o EstoqueUni
 * Collection: tenants-estoqueuni
 */
const tenantSchema = new mongoose.Schema(
  {
    usuario: {
      type: String,
      required: true,
      trim: true,
    },
    nome: String,
    rota_base: {
      type: String,
      default: 'estoqueuni',
    },
    identificacaoFiscal: String,
    tipoLocatario: String,
    email: {
      type: String,
      trim: true,
    },
    senha: {
      type: String,
      required: true,
    },
    nivel_acesso: {
      type: String,
      default: 'Administrador',
    },
    assinatura: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'estoqueuni_assinaturas',
    },
  },
  {
    strict: false,
    timestamps: true,
  }
);

// Índices
tenantSchema.index({ usuario: 1, rota_base: 1 });
tenantSchema.index({ email: 1, rota_base: 1 });

const Tenant =
  mongoose.models['tenants-estoqueuni'] ||
  mongoose.model('tenants-estoqueuni', tenantSchema, 'tenants-estoqueuni');

export default Tenant;


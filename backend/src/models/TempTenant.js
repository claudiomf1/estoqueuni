import mongoose from 'mongoose';

/**
 * Model de Tenant Temporário para o EstoqueUni
 * Collection: estoqueuni_temp_tenants
 * Usado para armazenar cadastros pendentes de verificação de email
 */
const tempTenantSchema = new mongoose.Schema(
  {
    usuario: {
      type: String,
      required: true,
      trim: true,
    },
    nome: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    senha: {
      type: String,
      required: true,
    },
    rota_base: {
      type: String,
      default: 'estoqueuni',
    },
    tipoLocatario: {
      type: String,
      default: 'Pessoa Jurídica',
    },
    nivel_acesso: {
      type: String,
      default: 'Administrador',
    },
  },
  {
    strict: false,
    timestamps: true,
  }
);

// Índices
tempTenantSchema.index({ email: 1, rota_base: 1 });
tempTenantSchema.index({ usuario: 1, rota_base: 1 });

const TempTenant =
  mongoose.models.estoqueuni_temp_tenants ||
  mongoose.model('estoqueuni_temp_tenants', tempTenantSchema, 'estoqueuni_temp_tenants');

export default TempTenant;


// backend/src/models/BlingConfig.js
import mongoose from 'mongoose';

/**
 * Model de configuração do Bling
 * Suporta múltiplas contas Bling por tenant
 * Armazena tokens OAuth, informações da loja e status da integração
 */
const blingConfigSchema = new mongoose.Schema({
  // Identificação única da conta Bling
  blingAccountId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },

  // Identificação do tenant (NÃO unique - permite múltiplas contas)
  tenantId: {
    type: String,
    required: true,
    index: true,
    trim: true,
  },

  // Nome amigável da conta
  accountName: {
    type: String,
    default: 'Conta Bling',
    trim: true,
  },

  // Credenciais da aplicação Bling (opcionais por conta)
  // Se não forem preenchidas, o sistema usa as credenciais globais
  bling_client_id: {
    type: String,
    required: false,
    trim: true,
  },
  bling_client_secret: {
    type: String,
    required: false,
    trim: true,
  },
  bling_redirect_uri: {
    type: String,
    required: false,
    trim: true,
  },

  // Tokens OAuth 2.0
  access_token: {
    type: String,
    required: false,
  },
  refresh_token: {
    type: String,
    required: false,
  },
  expires_in: {
    type: Number,
    required: false,
  },
  expiry_date: {
    type: Number, // timestamp em milissegundos
    required: false,
  },

  // Informações da loja Bling
  store_id: {
    type: String,
    required: false,
    trim: true,
  },
  store_name: {
    type: String,
    required: false,
    trim: true,
  },

  // Status da integração
  is_active: {
    type: Boolean,
    default: true,
    index: true,
  },
  last_sync: {
    type: Date,
    default: null,
  },
  last_error: {
    type: String,
    default: null,
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Índice composto único: garante que não haverá duplicatas de tenantId + blingAccountId
blingConfigSchema.index({ tenantId: 1, blingAccountId: 1 }, { unique: true });

// Índice simples para tenantId (já existe acima, mas mantido para clareza)
// Índice simples para blingAccountId (já existe acima, mas mantido para clareza)

// Middleware pre('save') - Atualiza updatedAt e gera blingAccountId se não fornecido
blingConfigSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  // Gerar blingAccountId automaticamente se não fornecido
  if (!this.blingAccountId) {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 11);
    this.blingAccountId = `bling_${timestamp}_${randomStr}`;
  }

  next();
});

// Métodos de instância

/**
 * Verifica se o token está expirado
 * @returns {boolean} true se o token expirou ou não existe
 */
blingConfigSchema.methods.isTokenExpired = function () {
  if (!this.expiry_date) return true;
  return Date.now() >= this.expiry_date;
};

/**
 * Verifica se a configuração está completa
 * @returns {boolean} true se todos os campos necessários estão preenchidos
 */
blingConfigSchema.methods.isConfigurationComplete = function () {
  return !!(
    this.access_token &&
    this.refresh_token &&
    this.expiry_date &&
    this.is_active
  );
};

/**
 * Verifica se a conta possui credenciais próprias configuradas
 * @returns {boolean}
 */
blingConfigSchema.methods.temCredenciaisProprias = function () {
  return !!(this.bling_client_id && this.bling_client_secret);
};

/**
 * Verifica se precisa de re-autorização
 * @returns {boolean} true se precisa re-autorizar a conta
 */
blingConfigSchema.methods.needsReauthorization = function () {
  return (
    !this.refresh_token ||
    !this.is_active ||
    (this.last_error && this.last_error.includes('invalid_grant'))
  );
};

const BlingConfig = mongoose.model('BlingConfig', blingConfigSchema, 'estoqueuni_blingConfigs');

export default BlingConfig;


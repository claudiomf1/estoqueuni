// backend/src/models/ConfiguracaoSincronizacao.js
import mongoose from 'mongoose';
import { getBrazilNow } from '../utils/timezone.js';

/**
 * Model de configuração de sincronização de estoques (Multitenant Genérico)
 * Armazena configurações de webhook, contas Bling e depósitos para sincronização
 * 
 * Estrutura genérica que permite N contas Bling e N depósitos por tenant,
 * removendo hardcoding de nomes de empresas específicas.
 */
const configuracaoSincronizacaoSchema = new mongoose.Schema({
  // Identificação do tenant (único)
  tenantId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  // Status geral da sincronização
  ativo: {
    type: Boolean,
    default: false,
    index: true,
  },

  // ✅ GENÉRICO: Array de contas Bling (permite N contas por tenant)
  contasBling: [{
    blingAccountId: {
      type: String,
      required: true,
      trim: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    webhookConfigurado: {
      type: Boolean,
      default: false,
    },
    webhookConfiguradoEm: {
      type: Date,
      default: null,
    },
    depositosPrincipais: [{
      type: String,
      trim: true,
    }],
    depositoCompartilhado: {
      type: String,
      trim: true,
    },
  }],

  // ✅ GENÉRICO: Array de depósitos (permite N depósitos por tenant)
  depositos: [{
    id: {
      type: String,
      required: true,
      trim: true,
    },
    nome: {
      type: String,
      required: true,
      trim: true,
    },
    tipo: {
      type: String,
      required: true,
      enum: ['principal', 'compartilhado'],
    },
    contaBlingId: {
      type: String,
      trim: true,
    },
  }],

  // ✅ GENÉRICO: Regra de sincronização
  regraSincronizacao: {
    tipo: {
      type: String,
      enum: ['soma', 'media', 'max', 'min'],
      default: 'soma',
    },
    depositosPrincipais: [{
      type: String,
      trim: true,
    }],
    depositosCompartilhados: [{
      type: String,
      trim: true,
    }],
  },

  // Configuração do webhook
  webhook: {
    url: {
      type: String,
      trim: true,
    },
    secret: {
      type: String,
      trim: true,
    },
    ativo: {
      type: Boolean,
      default: false,
    },
    ultimaRequisicao: {
      type: Date,
      default: null,
    },
  },

  // Data da última sincronização
  ultimaSincronizacao: {
    type: Date,
    default: null,
  },

  // Estatísticas de sincronização
  estatisticas: {
    totalWebhooks: {
      type: Number,
      default: 0,
    },
    totalCronjobs: {
      type: Number,
      default: 0,
    },
    totalManuais: {
      type: Number,
      default: 0,
    },
    eventosPerdidos: {
      type: Number,
      default: 0,
    },
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

// Middleware pre('save') - Atualiza updatedAt
configuracaoSincronizacaoSchema.pre('save', function (next) {
  this.updatedAt = getBrazilNow();
  next();
});

// Métodos de instância

/**
 * Incrementa contador de estatísticas por origem
 * @param {string} origem - Origem do evento ('webhook', 'manual')
 */
configuracaoSincronizacaoSchema.methods.incrementarEstatistica = function (origem) {
  if (!this.estatisticas) {
    this.estatisticas = {
      totalWebhooks: 0,
      totalCronjobs: 0,
      totalManuais: 0,
      eventosPerdidos: 0,
    };
  }

  switch (origem) {
    case 'webhook':
      this.estatisticas.totalWebhooks = (this.estatisticas.totalWebhooks || 0) + 1;
      break;
    case 'manual':
      this.estatisticas.totalManuais = (this.estatisticas.totalManuais || 0) + 1;
      break;
    default:
      break;
  }
};

/**
 * Incrementa contador de eventos perdidos
 */
configuracaoSincronizacaoSchema.methods.incrementarEventosPerdidos = function () {
  if (!this.estatisticas) {
    this.estatisticas = {
      totalWebhooks: 0,
      totalCronjobs: 0,
      totalManuais: 0,
      eventosPerdidos: 0,
    };
  }
  this.estatisticas.eventosPerdidos = (this.estatisticas.eventosPerdidos || 0) + 1;
};

/**
 * Verifica se a configuração está completa (estrutura genérica)
 * @returns {boolean} true se todos os campos obrigatórios estão preenchidos
 */
configuracaoSincronizacaoSchema.methods.isConfigurationComplete = function () {
  // Valida tenantId
  if (!this.tenantId) {
    return false;
  }

  // Valida que há pelo menos uma conta Bling configurada e ativa
  if (!Array.isArray(this.contasBling) || this.contasBling.length === 0) {
    return false;
  }

  const contasAtivas = this.contasBling.filter(conta => conta.isActive !== false);
  if (contasAtivas.length === 0) {
    return false;
  }

  // Valida que todas as contas ativas têm blingAccountId e accountName
  const contasValidas = contasAtivas.every(conta => 
    conta.blingAccountId && conta.accountName
  );
  if (!contasValidas) {
    return false;
  }

  // Valida que há depósitos configurados
  if (!Array.isArray(this.depositos) || this.depositos.length === 0) {
    return false;
  }

  // Valida que todos os depósitos têm id, nome e tipo
  const depositosValidos = this.depositos.every(deposito =>
    deposito.id && deposito.nome && deposito.tipo
  );
  if (!depositosValidos) {
    return false;
  }

  // Valida regra de sincronização
  if (!this.regraSincronizacao) {
    return false;
  }

  if (!Array.isArray(this.regraSincronizacao.depositosPrincipais) || 
      this.regraSincronizacao.depositosPrincipais.length === 0) {
    return false;
  }

  if (!Array.isArray(this.regraSincronizacao.depositosCompartilhados) || 
      this.regraSincronizacao.depositosCompartilhados.length === 0) {
    return false;
  }

  return true;
};

/**
 * Verifica se há contas Bling configuradas (estrutura genérica)
 * @returns {boolean} true se há pelo menos uma conta configurada e ativa
 */
configuracaoSincronizacaoSchema.methods.contasBlingConfiguradas = function () {
  if (!Array.isArray(this.contasBling) || this.contasBling.length === 0) {
    return false;
  }

  // Verifica se há pelo menos uma conta ativa com blingAccountId
  return this.contasBling.some(conta => 
    conta.isActive !== false && 
    conta.blingAccountId && 
    conta.accountName
  );
};

/**
 * Atualiza última requisição do webhook
 */
configuracaoSincronizacaoSchema.methods.atualizarUltimaRequisicaoWebhook = function () {
  if (!this.webhook) {
    this.webhook = {
      url: null,
      secret: null,
      ativo: false,
      ultimaRequisicao: null,
    };
  }
  this.webhook.ultimaRequisicao = getBrazilNow();
};

/**
 * Busca uma conta Bling pelo blingAccountId
 * @param {string} blingAccountId - ID da conta no Bling
 * @returns {Object|null} Conta encontrada ou null
 */
configuracaoSincronizacaoSchema.methods.buscarContaPorBlingAccountId = function (blingAccountId) {
  if (!Array.isArray(this.contasBling) || !blingAccountId) {
    return null;
  }

  return this.contasBling.find(conta => 
    conta.blingAccountId === blingAccountId
  ) || null;
};

/**
 * Busca depósitos por tipo
 * @param {string} tipo - Tipo do depósito ('principal' ou 'compartilhado')
 * @returns {Array} Array de depósitos do tipo especificado
 */
configuracaoSincronizacaoSchema.methods.buscarDepositosPorTipo = function (tipo) {
  if (!Array.isArray(this.depositos) || !tipo) {
    return [];
  }

  return this.depositos.filter(deposito => deposito.tipo === tipo);
};

// Métodos estáticos

/**
 * Busca ou cria configuração para um tenant (estrutura genérica)
 * @param {string} tenantId - ID do tenant
 * @returns {Promise<Object>} Configuração do tenant
 */
configuracaoSincronizacaoSchema.statics.buscarOuCriar = async function (tenantId) {
  let config = await this.findOne({ tenantId });
  
  if (!config) {
    config = await this.create({
      tenantId,
      ativo: false,
      contasBling: [],
      depositos: [],
      regraSincronizacao: {
        tipo: 'soma',
        depositosPrincipais: [],
        depositosCompartilhados: [],
      },
      webhook: {
        ativo: false,
      },
      estatisticas: {
        totalWebhooks: 0,
        totalCronjobs: 0,
        totalManuais: 0,
        eventosPerdidos: 0,
      },
    });
  }
  
  return config;
};

const ConfiguracaoSincronizacao = mongoose.model(
  'ConfiguracaoSincronizacao',
  configuracaoSincronizacaoSchema,
  'estoqueuni_configuracoesSincronizacao'
);

export default ConfiguracaoSincronizacao;

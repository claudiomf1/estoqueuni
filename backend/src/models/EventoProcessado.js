// backend/src/models/EventoProcessado.js
import mongoose from 'mongoose';

/**
 * Model de eventos processados do Bling
 * Armazena histórico de eventos de estoque processados para anti-duplicação e auditoria
 */
const eventoProcessadoSchema = new mongoose.Schema({
  // Identificação do tenant
  tenantId: {
    type: String,
    required: true,
    index: true,
    trim: true,
  },

  // ID da conta Bling (genérico - qualquer conta)
  blingAccountId: {
    type: String,
    trim: true,
  },

  // ID do produto no Bling
  produtoId: {
    type: String,
    trim: true,
  },

  // ID do evento no Bling
  eventoId: {
    type: String,
    trim: true,
  },

  // Chave única para anti-duplicação: produtoId-eventId
  chaveUnica: {
    type: String,
    unique: true,
    index: true,
    trim: true,
  },

  // ID do depósito que originou o evento
  depositoOrigem: {
    type: String,
    trim: true,
  },

  // Origem do evento
  origem: {
    type: String,
    enum: ['webhook', 'cronjob', 'manual'],
    trim: true,
  },

  // Saldos dos depósitos no momento do processamento (genérico)
  // Formato: { depositoId1: quantidade1, depositoId2: quantidade2, ..., soma: total }
  saldos: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // Valores atualizados nos depósitos compartilhados (genérico)
  // Formato: { depositoId1: quantidade1, depositoId2: quantidade2, ... }
  compartilhadosAtualizados: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // Data/hora do processamento
  processadoEm: {
    type: Date,
    default: Date.now,
    index: true,
  },

  // Status do processamento
  sucesso: {
    type: Boolean,
    default: false,
  },

  // Mensagem de erro (se houver)
  erro: {
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

// Índice composto para busca por tenant e data
eventoProcessadoSchema.index({ tenantId: 1, processadoEm: -1 });

// Índice composto para busca por origem e data
eventoProcessadoSchema.index({ origem: 1, processadoEm: -1 });

// Middleware pre('save') - Atualiza updatedAt e gera chaveUnica se necessário
eventoProcessadoSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  // Gerar chaveUnica automaticamente se não fornecido
  if (!this.chaveUnica && this.produtoId && this.eventoId) {
    this.chaveUnica = EventoProcessado.criarChaveUnica(this.produtoId, this.eventoId);
  }

  next();
});

// Métodos estáticos

/**
 * Cria chave única para anti-duplicação
 * @param {string} produtoId - ID do produto no Bling
 * @param {string} eventoId - ID do evento no Bling
 * @returns {string} Chave única no formato "produtoId-eventoId"
 */
eventoProcessadoSchema.statics.criarChaveUnica = function (produtoId, eventoId) {
  if (!produtoId || !eventoId) {
    throw new Error('produtoId e eventoId são obrigatórios para criar chave única');
  }
  return `${produtoId}-${eventoId}`;
};

/**
 * Verifica se um evento já foi processado
 * @param {string} chaveUnica - Chave única do evento
 * @param {string} tenantId - ID do tenant
 * @returns {Promise<boolean>} true se já foi processado
 */
eventoProcessadoSchema.statics.verificarSeProcessado = async function (chaveUnica, tenantId) {
  const evento = await this.findOne({ chaveUnica, tenantId });
  return !!evento;
};

/**
 * Busca eventos processados por tenant e período
 * @param {string} tenantId - ID do tenant
 * @param {Date} dataInicio - Data de início
 * @param {Date} dataFim - Data de fim
 * @param {Object} options - Opções de paginação
 * @returns {Promise<Array>} Lista de eventos processados
 */
eventoProcessadoSchema.statics.buscarPorPeriodo = async function (
  tenantId,
  dataInicio,
  dataFim,
  options = {}
) {
  const { limite = 100, pagina = 1, origem } = options;
  const skip = (pagina - 1) * limite;

  const query = {
    tenantId,
    processadoEm: {
      $gte: dataInicio,
      $lte: dataFim,
    },
  };

  if (origem) {
    query.origem = origem;
  }

  return await this.find(query)
    .sort({ processadoEm: -1 })
    .skip(skip)
    .limit(limite);
};

const EventoProcessado = mongoose.model(
  'EventoProcessado',
  eventoProcessadoSchema,
  'estoqueuni_eventosProcessados'
);

export default EventoProcessado;


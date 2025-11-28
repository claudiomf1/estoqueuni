// backend/src/models/Produto.js
import mongoose from 'mongoose';

const produtoSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  nome: {
    type: String,
    trim: true,
  },
  descricao: {
    type: String,
    trim: true,
  },
  estoque: {
    type: Number,
    default: 0,
  },
  estoquePorConta: {
    type: Map,
    of: Number,
    default: {},
  },
  ultimaSincronizacao: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Índice composto único para garantir unicidade de tenantId + sku
produtoSchema.index({ tenantId: 1, sku: 1 }, { unique: true });

// Índice simples para tenantId (já existe acima, mas mantido para clareza)
// Índice simples para sku (já existe acima, mas mantido para clareza)

// Middleware pre('save') - Atualiza updatedAt e calcula estoque total
produtoSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  
  // Calcular estoque total a partir de estoquePorConta
  if (this.estoquePorConta && this.estoquePorConta instanceof Map) {
    let total = 0;
    for (const quantidade of this.estoquePorConta.values()) {
      if (typeof quantidade === 'number' && !isNaN(quantidade)) {
        total += quantidade;
      }
    }
    this.estoque = total;
  } else if (this.estoquePorConta && typeof this.estoquePorConta === 'object') {
    // Caso estoquePorConta seja um objeto simples (não Map)
    let total = 0;
    for (const quantidade of Object.values(this.estoquePorConta)) {
      if (typeof quantidade === 'number' && !isNaN(quantidade)) {
        total += quantidade;
      }
    }
    this.estoque = total;
  }
  
  next();
});

// Middleware pre('findOneAndUpdate') - Atualiza updatedAt e recalcula estoque
produtoSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  const updatePayload = update.$set || update;
  
  updatePayload.updatedAt = new Date();
  
  // Se estoquePorConta foi atualizado, recalcular estoque
  if (updatePayload.estoquePorConta) {
    let total = 0;
    const estoquePorConta = updatePayload.estoquePorConta;
    
    if (estoquePorConta instanceof Map) {
      for (const quantidade of estoquePorConta.values()) {
        if (typeof quantidade === 'number' && !isNaN(quantidade)) {
          total += quantidade;
        }
      }
    } else if (typeof estoquePorConta === 'object') {
      for (const quantidade of Object.values(estoquePorConta)) {
        if (typeof quantidade === 'number' && !isNaN(quantidade)) {
          total += quantidade;
        }
      }
    }
    
    updatePayload.estoque = total;
  }
  
  next();
});

// Método de instância: atualizarEstoqueUnificado
produtoSchema.methods.atualizarEstoqueUnificado = function (estoquePorConta) {
  if (!estoquePorConta) {
    throw new Error('estoquePorConta é obrigatório');
  }
  
  // Converter para Map se for objeto
  if (!(estoquePorConta instanceof Map)) {
    const mapEstoque = new Map();
    for (const [contaId, quantidade] of Object.entries(estoquePorConta)) {
      mapEstoque.set(contaId, quantidade);
    }
    this.estoquePorConta = mapEstoque;
  } else {
    this.estoquePorConta = estoquePorConta;
  }
  
  // Calcular estoque total
  let total = 0;
  for (const quantidade of this.estoquePorConta.values()) {
    if (typeof quantidade === 'number' && !isNaN(quantidade)) {
      total += quantidade;
    }
  }
  
  this.estoque = total;
  this.ultimaSincronizacao = new Date();
  
  return this;
};

// Método de instância: getEstoqueTotal
produtoSchema.methods.getEstoqueTotal = function () {
  // Se estoque já está calculado, retorna ele
  if (this.estoque !== undefined && this.estoque !== null) {
    return this.estoque;
  }
  
  // Caso contrário, calcula a partir de estoquePorConta
  if (!this.estoquePorConta) {
    return 0;
  }
  
  let total = 0;
  if (this.estoquePorConta instanceof Map) {
    for (const quantidade of this.estoquePorConta.values()) {
      if (typeof quantidade === 'number' && !isNaN(quantidade)) {
        total += quantidade;
      }
    }
  } else if (typeof this.estoquePorConta === 'object') {
    for (const quantidade of Object.values(this.estoquePorConta)) {
      if (typeof quantidade === 'number' && !isNaN(quantidade)) {
        total += quantidade;
      }
    }
  }
  
  return total;
};

const Produto = mongoose.model('Produto', produtoSchema, 'estoqueuni_produtos');

export default Produto;


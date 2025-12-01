// backend/src/models/Produto.js
import mongoose from 'mongoose';
import { getBrazilNow } from '../utils/timezone.js';

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
  // Array de IDs das contas Bling onde o produto existe
  contasBling: {
    type: [String],
    default: [],
    index: true,
  },
  ultimaSincronizacao: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: getBrazilNow,
  },
  updatedAt: {
    type: Date,
    default: getBrazilNow,
  },
});

// Índice composto único para garantir unicidade de tenantId + sku
produtoSchema.index({ tenantId: 1, sku: 1 }, { unique: true });

// Índice simples para tenantId (já existe acima, mas mantido para clareza)
// Índice simples para sku (já existe acima, mas mantido para clareza)

// Middleware pre('save') - Atualiza updatedAt, calcula estoque total e sincroniza contasBling
produtoSchema.pre('save', function (next) {
  this.updatedAt = getBrazilNow();
  
  // Calcular estoque total e sincronizar contasBling a partir de estoquePorConta
  if (this.estoquePorConta && this.estoquePorConta instanceof Map) {
    let total = 0;
    const contas = [];
    for (const [contaId, quantidade] of this.estoquePorConta.entries()) {
      if (contaId && typeof quantidade === 'number' && !isNaN(quantidade)) {
        total += quantidade;
        contas.push(contaId);
      }
    }
    this.estoque = total;
    this.contasBling = [...new Set(contas)]; // Remove duplicatas
  } else if (this.estoquePorConta && typeof this.estoquePorConta === 'object') {
    // Caso estoquePorConta seja um objeto simples (não Map)
    let total = 0;
    const contas = [];
    for (const [contaId, quantidade] of Object.entries(this.estoquePorConta)) {
      if (contaId && typeof quantidade === 'number' && !isNaN(quantidade)) {
        total += quantidade;
        contas.push(contaId);
      }
    }
    this.estoque = total;
    this.contasBling = [...new Set(contas)]; // Remove duplicatas
  }
  
  next();
});

// Middleware pre('findOneAndUpdate') - Atualiza updatedAt, recalcula estoque e sincroniza contasBling
produtoSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  const updatePayload = update.$set || update;
  
  updatePayload.updatedAt = getBrazilNow();
  
  // Se estoquePorConta foi atualizado, recalcular estoque e sincronizar contasBling
  if (updatePayload.estoquePorConta) {
    let total = 0;
    const contas = [];
    const estoquePorConta = updatePayload.estoquePorConta;
    
    if (estoquePorConta instanceof Map) {
      for (const [contaId, quantidade] of estoquePorConta.entries()) {
        if (contaId && typeof quantidade === 'number' && !isNaN(quantidade)) {
          total += quantidade;
          contas.push(contaId);
        }
      }
    } else if (typeof estoquePorConta === 'object') {
      for (const [contaId, quantidade] of Object.entries(estoquePorConta)) {
        if (contaId && typeof quantidade === 'number' && !isNaN(quantidade)) {
          total += quantidade;
          contas.push(contaId);
        }
      }
    }
    
    updatePayload.estoque = total;
    updatePayload.contasBling = [...new Set(contas)]; // Remove duplicatas
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
  
  // Calcular estoque total e sincronizar contasBling
  let total = 0;
  const contas = [];
  for (const [contaId, quantidade] of this.estoquePorConta.entries()) {
    if (contaId && typeof quantidade === 'number' && !isNaN(quantidade)) {
      total += quantidade;
      contas.push(contaId);
    }
  }
  
  this.estoque = total;
  this.contasBling = [...new Set(contas)]; // Remove duplicatas
  this.ultimaSincronizacao = getBrazilNow();
  
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

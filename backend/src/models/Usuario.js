import mongoose from 'mongoose';

/**
 * Model de Usuário para o EstoqueUni
 * Collection: estoqueuni_usuarios
 */
const usuarioSchema = new mongoose.Schema(
  {
    id: Number,
    data_cadastro: Date,
    data_admicao: Date,
    data_demicao: Date,
    data_nascimento: Date,
    nome: String,
    sobrenome: String,
    cpf: String,
    cargo: String,
    email: String,
    telefone: String,
    endereco: String,
    estado: String,
    cidade: String,
    rota_base: {
      type: String,
      default: 'estoqueuni',
    },
    cep: String,
    nome_usuario: {
      type: String,
      required: true,
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
    id_nivel_acesso: Number,
    ativo: {
      type: Boolean,
      default: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    strict: false,
    timestamps: true,
  }
);

// Índices
usuarioSchema.index({ nome_usuario: 1, rota_base: 1 });
usuarioSchema.index({ email: 1, rota_base: 1 });
usuarioSchema.index({ tenantId: 1 });

const Usuario =
  mongoose.models.estoqueuni_usuarios ||
  mongoose.model('estoqueuni_usuarios', usuarioSchema, 'estoqueuni_usuarios');

export default Usuario;




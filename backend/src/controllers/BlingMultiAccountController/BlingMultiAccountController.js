import { manipuladoresContas } from './manipuladores-contas.js';
import { manipuladoresOAuth } from './manipuladores-oauth.js';
import { manipuladoresEstoque } from './manipuladores-estoque.js';
import { manipuladoresDepositos } from './manipuladores-depositos.js';

/**
 * Controller para gerenciar múltiplas contas Bling por tenant
 * 
 * Este controller orquestra as operações relacionadas a:
 * - Gerenciamento de contas Bling
 * - Autorização OAuth
 * - Sincronização de estoque
 * - Gerenciamento de depósitos
 */
class BlingMultiAccountController {
  // ===== GERENCIAMENTO DE CONTAS =====
  
  async listarContas(req, res) {
    return manipuladoresContas.listarContas(req, res);
  }

  async obterConta(req, res) {
    return manipuladoresContas.obterConta(req, res);
  }

  async adicionarConta(req, res) {
    return manipuladoresContas.adicionarConta(req, res);
  }

  async removerConta(req, res) {
    return manipuladoresContas.removerConta(req, res);
  }

  async atualizarConta(req, res) {
    return manipuladoresContas.atualizarConta(req, res);
  }

  async toggleConta(req, res) {
    return manipuladoresContas.toggleConta(req, res);
  }

  // ===== OAUTH =====

  async callbackAutorizacao(req, res) {
    return manipuladoresOAuth.callbackAutorizacao(req, res);
  }

  async iniciarAutorizacao(req, res) {
    return manipuladoresOAuth.iniciarAutorizacao(req, res);
  }

  // ===== SINCRONIZAÇÃO DE ESTOQUE =====

  async sincronizarEstoqueUnificado(req, res) {
    return manipuladoresEstoque.sincronizarEstoqueUnificado(req, res);
  }

  async sincronizarEstoqueProdutoUnico(req, res) {
    return manipuladoresEstoque.sincronizarEstoqueProdutoUnico(req, res);
  }

  async buscarEstoqueUnificado(req, res) {
    return manipuladoresEstoque.buscarEstoqueUnificado(req, res);
  }

  // ===== GERENCIAMENTO DE DEPÓSITOS =====

  async listarDepositos(req, res) {
    return manipuladoresDepositos.listarDepositos(req, res);
  }

  async criarDeposito(req, res) {
    return manipuladoresDepositos.criarDeposito(req, res);
  }
}

export default BlingMultiAccountController;


import blingService from '../../services/blingService.js';
import ConfiguracaoSincronizacao from '../../models/ConfiguracaoSincronizacao.js';

/**
 * Manipuladores para gerenciamento de depósitos Bling
 */
export const manipuladoresDepositos = {
  /**
   * Lista depósitos de uma conta Bling
   */
  async listarDepositos(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;
      const blingAccountId = req.query.blingAccountId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      if (!blingAccountId) {
        return res.status(400).json({
          success: false,
          error: 'blingAccountId é obrigatório'
        });
      }

      const depositos = await blingService.getDepositos(tenantId, blingAccountId);

      return res.json({
        success: true,
        data: depositos
      });
    } catch (error) {
      console.error('❌ Erro ao listar depósitos:', error);

      if (error.message === 'REAUTH_REQUIRED') {
        return res.status(401).json({
          success: false,
          error: 'Reautorização necessária',
          reauthUrl: error.reauthUrl,
          reason: error.reason
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao listar depósitos',
        message: error.message
      });
    }
  },

  /**
   * Cria um novo depósito no Bling
   */
  async criarDeposito(req, res) {
    try {
      const tenantId = req.tenantId || req.body.tenantId;
      const { blingAccountId, descricao, situacao, desconsiderarSaldo } = req.body;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      if (!blingAccountId) {
        return res.status(400).json({
          success: false,
          error: 'blingAccountId é obrigatório'
        });
      }

      if (!descricao || !descricao.trim()) {
        return res.status(400).json({
          success: false,
          error: 'descricao é obrigatória'
        });
      }

      const deposito = await blingService.criarDeposito(tenantId, blingAccountId, {
        descricao: descricao.trim(),
        situacao: situacao || 'A',
        desconsiderarSaldo: desconsiderarSaldo || false
      });

      return res.json({
        success: true,
        data: deposito,
        message: 'Depósito criado com sucesso'
      });
    } catch (error) {
      console.error('❌ Erro ao criar depósito:', error);

      if (error.message === 'REAUTH_REQUIRED') {
        return res.status(401).json({
          success: false,
          error: 'Reautorização necessária',
          reauthUrl: error.reauthUrl,
          reason: error.reason
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao criar depósito',
        message: error.message
      });
    }
  },

  /**
   * Verifica se um depósito específico existe no Bling
   */
  async verificarDeposito(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId;
      const { blingAccountId, depositoId, descricao } = req.query;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      if (!blingAccountId) {
        return res.status(400).json({
          success: false,
          error: 'blingAccountId é obrigatório'
        });
      }

      // Buscar todos os depósitos
      const depositos = await blingService.getDepositos(tenantId, blingAccountId, true);

      // Buscar pelo ID ou descrição
      let depositoEncontrado = null;
      if (depositoId) {
        depositoEncontrado = depositos.find(
          d => d.id === depositoId || 
               d.id === depositoId.toString() ||
               d.id === Number(depositoId)
        );
      } else if (descricao) {
        depositoEncontrado = depositos.find(
          d => d.descricao === descricao || 
               d.nome === descricao ||
               (d.descricao && d.descricao.toLowerCase().includes(descricao.toLowerCase()))
        );
      }

      if (depositoEncontrado) {
        return res.json({
          success: true,
          encontrado: true,
          data: depositoEncontrado,
          message: 'Depósito encontrado no Bling'
        });
      } else {
        return res.json({
          success: true,
          encontrado: false,
          totalDepositos: depositos.length,
          depositos: depositos.map(d => ({
            id: d.id,
            descricao: d.descricao || d.nome,
            situacao: d.situacao
          })),
          message: 'Depósito não encontrado na listagem do Bling'
        });
      }
    } catch (error) {
      console.error('❌ Erro ao verificar depósito:', error);

      if (error.message === 'REAUTH_REQUIRED') {
        return res.status(401).json({
          success: false,
          error: 'Reautorização necessária',
          reauthUrl: error.reauthUrl,
          reason: error.reason
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar depósito',
        message: error.message
      });
    }
  },

  /**
   * Remove um depósito da configuração do EstoqueUni e tenta inativá-lo no Bling
   * Tenta inativar o depósito via API primeiro, depois remove da configuração local.
   */
  async deletarDeposito(req, res) {
    try {
      const tenantId = req.tenantId || req.query.tenantId || req.body.tenantId;
      const blingAccountId = req.query.blingAccountId || req.body.blingAccountId;
      const depositoId = req.params.depositoId || req.body.depositoId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      if (!depositoId) {
        return res.status(400).json({
          success: false,
          error: 'depositoId é obrigatório'
        });
      }

      // Buscar configuração do tenant
      const config = await ConfiguracaoSincronizacao.findOne({ tenantId });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Configuração não encontrada para este tenant'
        });
      }

      // Verificar se o depósito existe na configuração
      const depositoEncontrado = config.depositos.find(d => d.id === depositoId.toString());
      const estaNaConfiguracao = !!depositoEncontrado;

      // Tentar inativar no Bling primeiro (se blingAccountId foi fornecido)
      let resultadoInativacao = null;
      if (blingAccountId) {
        try {
          resultadoInativacao = await blingService.deletarDeposito(tenantId, blingAccountId, depositoId);
        } catch (inativacaoError) {
          // Se o depósito não está na configuração, retornar erro da inativação
          if (!estaNaConfiguracao) {
            return res.status(500).json({
              success: false,
              error: 'Erro ao inativar depósito no Bling',
              message: inativacaoError.message,
              inativadoNoBling: false
            });
          }
          // Se está na configuração, continua para remover da config mesmo se não conseguir inativar
        }
      } else if (!estaNaConfiguracao) {
        // Se não está na configuração e não tem blingAccountId, não tem o que fazer
        return res.status(400).json({
          success: false,
          error: 'Depósito não encontrado na configuração',
          message: 'Este depósito não está na configuração do EstoqueUni. Para inativá-lo no Bling, selecione uma conta Bling.',
          inativadoNoBling: false
        });
      }

      // Se o depósito está na configuração, remover
      if (estaNaConfiguracao) {
        // Remover depósito do array de depósitos
        config.depositos = config.depositos.filter(d => d.id !== depositoId.toString());

        // Remover das regras de sincronização se estiver presente
        if (config.regraSincronizacao) {
          if (config.regraSincronizacao.depositosPrincipais) {
            config.regraSincronizacao.depositosPrincipais = 
              config.regraSincronizacao.depositosPrincipais.filter(id => id !== depositoId.toString());
          }
          if (config.regraSincronizacao.depositosCompartilhados) {
            config.regraSincronizacao.depositosCompartilhados = 
              config.regraSincronizacao.depositosCompartilhados.filter(id => id !== depositoId.toString());
          }
        }

        // Salvar configuração atualizada
        await config.save();
      }

      // Montar resposta baseada no resultado da inativação
      const nomeDeposito = depositoEncontrado?.nome || `Depósito ${depositoId}`;
      let mensagem = '';
      let aviso = null;

      if (resultadoInativacao?.inativado) {
        if (estaNaConfiguracao) {
          mensagem = `Depósito "${nomeDeposito}" inativado no Bling e removido da configuração do EstoqueUni`;
        } else {
          mensagem = `Depósito "${nomeDeposito}" inativado no Bling com sucesso`;
        }
      } else {
        if (estaNaConfiguracao) {
          mensagem = `Depósito "${nomeDeposito}" removido da configuração do EstoqueUni`;
          if (resultadoInativacao?.erro && blingAccountId) {
            aviso = `Não foi possível inativar o depósito no Bling via API: ${resultadoInativacao.erro}. O depósito foi removido apenas da configuração local.`;
          } else if (!blingAccountId) {
            aviso = 'Depósito removido apenas da configuração local. Para inativar no Bling, selecione uma conta Bling.';
          }
        } else {
          // Não está na configuração e não conseguiu inativar (erro já foi tratado acima)
          mensagem = `Não foi possível inativar o depósito no Bling`;
        }
      }

      return res.json({
        success: true,
        message: mensagem,
        ...(aviso && { aviso }),
        depositoId: depositoId,
        depositoNome: depositoEncontrado?.nome || `Depósito ${depositoId}`,
        inativadoNoBling: resultadoInativacao?.inativado || false,
        removidoDaConfig: estaNaConfiguracao,
        ...(resultadoInativacao?.erro && { erroInativacao: resultadoInativacao.erro })
      });
    } catch (error) {
      console.error('❌ Erro ao remover depósito da configuração:', {
        message: error.message,
        stack: error.stack
      });

      if (error.message === 'REAUTH_REQUIRED') {
        return res.status(401).json({
          success: false,
          error: 'Reautorização necessária',
          reauthUrl: error.reauthUrl,
          reason: error.reason
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro ao remover depósito da configuração',
        message: error.message
      });
    }
  }
};


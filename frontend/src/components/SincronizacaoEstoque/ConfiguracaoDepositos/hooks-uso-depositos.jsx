/**
 * Hooks personalizados para gerenciar depósitos
 */
import React from 'react';
import { useQuery, useMutation } from 'react-query';
import { blingApi } from '../../../services/blingApi';
import { sincronizacaoApi } from '../../../services/sincronizacaoApi';
import { extrairListaContas } from './utilitarios';

/**
 * Hook para buscar contas Bling
 */
export function usarContasBling(tenantId) {
  return useQuery(
    ['bling-contas', tenantId],
    () => blingApi.listarContas(tenantId),
    {
      enabled: !!tenantId,
      refetchOnWindowFocus: false,
      select: (response) => extrairListaContas(response)
    }
  );
}

/**
 * Hook para buscar depósitos do Bling
 */
export function usarDepositosBling(tenantId, contaSelecionada, setErro) {
  return useQuery(
    ['bling-depositos', tenantId, contaSelecionada],
    () => blingApi.listarDepositos(tenantId, contaSelecionada),
    {
      enabled: !!tenantId && !!contaSelecionada,
      refetchOnWindowFocus: false,
      select: (response) => response.data?.data || [],
      onError: (error) => {
        console.error('Erro ao buscar depósitos:', error);
        if (error.status === 401 && setErro) {
          setErro('Reautorização necessária para acessar depósitos do Bling.');
        }
      }
    }
  );
}

/**
 * Hook para criar depósito no Bling
 */
export function usarCriarDeposito(tenantId, setMensagem, setErro, setMostrarModalCriar, setNovoDeposito, refetchDepositos) {
  return useMutation(
    ({ blingAccountId, dadosDeposito }) => blingApi.criarDeposito(tenantId, blingAccountId, dadosDeposito),
    {
      onSuccess: () => {
        setMensagem('Depósito criado com sucesso no Bling!');
        setMostrarModalCriar(false);
        setNovoDeposito({ descricao: '', situacao: 'A' });
        refetchDepositos();
        setTimeout(() => setMensagem(null), 5000);
      },
      onError: (error) => {
        setErro(error.mensagem || error.message || 'Erro ao criar depósito no Bling');
        setTimeout(() => setErro(null), 7000);
      }
    }
  );
}

/**
 * Hook para deletar depósito da configuração
 */
export function usarDeletarDeposito(tenantId, setMensagem, setErro, refetchDepositos, onConfigUpdate) {
  return useMutation(
    ({ depositoId, nomeDeposito }) => blingApi.deletarDeposito(tenantId, null, depositoId),
    {
      onSuccess: (response, variables) => {
        const nomeDeposito = variables.nomeDeposito || variables.depositoId;
        const aviso = response.data?.aviso || '';
        
        setMensagem(
          <div>
            <strong>✅ Depósito "{nomeDeposito}" removido da configuração!</strong>
            <br />
            <small className="text-muted d-block mt-2">
              ℹ️ {aviso || 'O depósito foi removido apenas da configuração do EstoqueUni.'}
            </small>
            <small className="text-muted d-block mt-1">
              Para deletar permanentemente, acesse: <strong>Bling {'>'} Estoque {'>'} Depósitos</strong>
            </small>
          </div>
        );
        
        refetchDepositos();
        
        // Recarregar configuração também
        if (onConfigUpdate) {
          setTimeout(async () => {
            try {
              const response = await sincronizacaoApi.obterConfiguracao(tenantId);
              const novaConfig = response.data?.data || response.data;
              if (novaConfig) {
                onConfigUpdate(novaConfig);
              }
            } catch (err) {
              console.warn('Erro ao recarregar configuração:', err);
            }
          }, 500);
        }
        
        setTimeout(() => setMensagem(null), 8000);
      },
      onError: (error, variables) => {
        const nomeDeposito = variables.nomeDeposito || variables.depositoId;
        setErro(
          `❌ Erro ao remover depósito "${nomeDeposito}": ${error.mensagem || error.message || 'Erro desconhecido'}`
        );
        setTimeout(() => setErro(null), 7000);
      }
    }
  );
}


import React, { useState } from 'react';
import { Container } from 'react-bootstrap';
import { useTenant } from '../context/TenantContext';
import { useQuery } from 'react-query';
import { sincronizacaoApi } from '../services/sincronizacaoApi';
import StatusSincronizacao from '../components/SincronizacaoEstoque/StatusSincronizacao';
import ConfiguracaoDepositos from '../components/SincronizacaoEstoque/ConfiguracaoDepositos';
import ConfiguracaoWebhook from '../components/SincronizacaoEstoque/ConfiguracaoWebhook';
import ConfiguracaoCronjob from '../components/SincronizacaoEstoque/ConfiguracaoCronjob';
import SincronizacaoManual from '../components/SincronizacaoEstoque/SincronizacaoManual';
import HistoricoSincronizacoes from '../components/SincronizacaoEstoque/HistoricoSincronizacoes';
import LogsMonitoramento from '../components/SincronizacaoEstoque/LogsMonitoramento';

export default function SincronizacaoEstoque() {
  const { tenantId } = useTenant();
  const [configDepositos, setConfigDepositos] = useState(null);
  const [pollingAtivo, setPollingAtivo] = useState(true);

  // Query para obter status geral
  const { data: statusResponse, isLoading: isLoadingStatus, refetch: refetchStatus } = useQuery(
    ['sincronizacao-status', tenantId],
    () => sincronizacaoApi.obterStatus(tenantId),
    {
      enabled: !!tenantId,
      refetchInterval: pollingAtivo ? 30000 : false, // Atualiza a cada 30 segundos se ativo
      select: (response) => response.data?.data || response.data
    }
  );

  // Query para obter configuração completa (inclui depósitos)
  const { data: configResponse, isLoading: isLoadingConfig } = useQuery(
    ['config-sincronizacao', tenantId],
    () => sincronizacaoApi.obterConfiguracao(tenantId),
    {
      enabled: !!tenantId,
      select: (response) => response.data?.data || response.data,
      onSuccess: (data) => {
        if (data) {
          setConfigDepositos(data);
        }
      }
    }
  );

  const status = statusResponse || {};
  const configDepositosAtual = configDepositos || configResponse || {};
  const cronjobConfigurado = status?.cronjob || configDepositosAtual?.cronjob || {};

  const handleSincronizacaoCompleta = () => {
    refetchStatus();
  };

  const handleConfigDepositosUpdate = (novaConfig) => {
    setConfigDepositos(novaConfig);
    refetchStatus();
  };

  return (
    <Container className="mt-4">
      <div className="mb-4">
        <h1>Gerenciamento de Sincronização de Estoques</h1>
        <p className="text-muted">
          Configure e monitore a sincronização automática de estoques entre depósitos
        </p>
      </div>

      {/* Status da Sincronização */}
      <StatusSincronizacao
        status={status}
        isLoading={isLoadingStatus}
        pollingAtivo={pollingAtivo}
        onTogglePolling={() => setPollingAtivo(!pollingAtivo)}
        onRefreshManual={refetchStatus}
      />

      {/* Configuração de Depósitos */}
      <ConfiguracaoDepositos
        tenantId={tenantId}
        config={configDepositosAtual}
        onConfigUpdate={handleConfigDepositosUpdate}
      />

      {/* Configuração de Webhook */}
      <ConfiguracaoWebhook
        tenantId={tenantId}
        configuracao={configDepositosAtual}
        isLoading={isLoadingConfig}
      />

      {/* Configuração de Cronjob */}
      <ConfiguracaoCronjob
        tenantId={tenantId}
        cronjob={cronjobConfigurado}
        isLoading={isLoadingStatus}
        onConfigAtualizada={refetchStatus}
      />

      {/* Sincronização Manual */}
      <SincronizacaoManual
        tenantId={tenantId}
        onSincronizacaoCompleta={handleSincronizacaoCompleta}
      />

      {/* Histórico de Sincronizações */}
      <HistoricoSincronizacoes tenantId={tenantId} />

      {/* Logs e Monitoramento */}
      <LogsMonitoramento tenantId={tenantId} />
    </Container>
  );
}


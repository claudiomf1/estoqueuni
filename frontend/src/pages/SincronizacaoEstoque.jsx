import React, { useState, useEffect, useMemo } from 'react';
import { Container, Accordion } from 'react-bootstrap';
import { useTenant } from '../context/TenantContext';
import { useQuery, useQueryClient } from 'react-query';
import { sincronizacaoApi } from '../services/sincronizacaoApi';
import StatusSincronizacao from '../components/SincronizacaoEstoque/StatusSincronizacao';
import ConfiguracaoDepositos from '../components/SincronizacaoEstoque/ConfiguracaoDepositos/ConfiguracaoDepositos';
import ConfiguracaoWebhook from '../components/SincronizacaoEstoque/ConfiguracaoWebhook';
import ConfiguracaoCronjob from '../components/SincronizacaoEstoque/ConfiguracaoCronjob';
import SincronizacaoManual from '../components/SincronizacaoEstoque/SincronizacaoManual';
import HistoricoSincronizacoes from '../components/SincronizacaoEstoque/HistoricoSincronizacoes';
import LogsMonitoramento from '../components/SincronizacaoEstoque/LogsMonitoramento';
import StatusWebhookPorConta from '../components/SincronizacaoEstoque/StatusWebhookPorConta';
import StatusDetalhesSincronizacao from '../components/SincronizacaoEstoque/StatusDetalhesSincronizacao';

export default function SincronizacaoEstoque() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [configDepositos, setConfigDepositos] = useState(null);
  const [pollingAtivo, setPollingAtivo] = useState(true);
  const [accordionAtivo, setAccordionAtivo] = useState(null);
  const [usuarioFechouWebhook, setUsuarioFechouWebhook] = useState(false);
  const [usuarioFechouStatusWebhook, setUsuarioFechouStatusWebhook] = useState(false);

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
  
  // Processar status de webhook baseado nas contas Bling
  const webhookInfo = status?.webhook || {};
  // Webhook está ativo apenas se todas as contas Bling ativas estiverem configuradas
  // Se não houver contas Bling, considera inativo
  const webhookAtivo = webhookInfo.totalContas > 0 && webhookInfo.todasConfiguradas === true;
  
  // Processar status de cronjob
  const cronjobInfo = status?.cronjob || {};
  const cronjobAtivo = cronjobInfo.ativo === true;
  
  const statusComWebhookProcessado = {
    ...status,
    webhookAtivo,
    webhook: webhookInfo,
    cronjobAtivo,
    cronjob: cronjobInfo
  };

  const statusChecklist = useMemo(() => {
    const configuracaoCarregada =
      configDepositosAtual &&
      (configDepositosAtual.tenantId ||
        (Array.isArray(configDepositosAtual.depositos) && configDepositosAtual.depositos.length > 0) ||
        Array.isArray(configDepositosAtual.contasBling));

    if (!configuracaoCarregada || !statusComWebhookProcessado) {
      return null;
    }

    const pendencias = [];

    if (configDepositosAtual.ativo !== true) {
      pendencias.push('Ative a sincronização geral na seção "Configuração de Depósitos".');
    }

    const contasAtivas = (configDepositosAtual.contasBling || []).filter(
      (conta) => conta && conta.isActive !== false
    );
    if (contasAtivas.length === 0) {
      pendencias.push('Cadastre pelo menos uma conta Bling ativa em "Gerenciar Depósitos do Bling".');
    } else {
      const contasSemDados = contasAtivas.filter(
        (conta) => !conta.blingAccountId || !conta.accountName
      );
      if (contasSemDados.length > 0) {
        const nomesContas = contasSemDados
          .map((conta) => conta.accountName || conta.blingAccountId || 'Conta sem nome')
          .join(', ');
        pendencias.push(`Complete ID e nome das contas em "Gerenciar Depósitos do Bling" (${nomesContas}).`);
      }
    }

    const depositosConfigurados = configDepositosAtual.depositos || [];
    if (depositosConfigurados.length === 0) {
      pendencias.push('Adicione depósitos e salve em "Depósitos Cadastrados na Configuração".');
    } else {
      const depositosSemTipo = depositosConfigurados.filter((deposito) => !deposito.tipo);
      if (depositosSemTipo.length > 0) {
        const nomes = depositosSemTipo
          .map((deposito) => deposito.nome || deposito.id || 'Depósito sem nome')
          .join(', ');
        pendencias.push(`Defina o tipo (principal/compartilhado) dos depósitos em "Depósitos Cadastrados" (${nomes}).`);
      }
    }

    const regra = configDepositosAtual.regraSincronizacao || {};
    const principais = Array.isArray(regra.depositosPrincipais)
      ? regra.depositosPrincipais
      : [];
    const compartilhados = Array.isArray(regra.depositosCompartilhados)
      ? regra.depositosCompartilhados
      : [];

    if (principais.length === 0) {
      pendencias.push('Selecione ao menos um depósito principal na coluna "Depósitos Principais".');
    }

    if (compartilhados.length === 0) {
      pendencias.push('Selecione ao menos um depósito compartilhado na coluna "Depósitos Compartilhados".');
    }

    if (
      pendencias.length === 0 &&
      statusComWebhookProcessado &&
      statusComWebhookProcessado.configuracaoCompleta === false
    ) {
      pendencias.push('Revise e salve novamente em "Configuração de Depósitos": o servidor ainda não reconheceu a configuração completa.');
    }

    return {
      titulo: pendencias.length ? 'Pendências para ativar a sincronização' : 'Sincronização pronta',
      itens: pendencias
    };
  }, [configDepositosAtual, statusComWebhookProcessado]);

  // Calcular se deve abrir a seção de webhook e atualizar estado
  useEffect(() => {
    if (isLoadingConfig) return; // Aguardar carregamento
    
    const contasBlingAtivas = (configDepositosAtual?.contasBling || []).filter(c => c.isActive !== false);
    const contasConfiguradas = (configDepositosAtual?.contasBling || []).filter(
      c => c.isActive !== false && c.webhookConfigurado === true
    );
    const temContasParaConfigurar = contasBlingAtivas.length > contasConfiguradas.length;
    
    // Se não há contas para configurar, garantir que a seção esteja fechada
    if (!temContasParaConfigurar) {
      setAccordionAtivo(null);
      setUsuarioFechouWebhook(false); // Resetar flag quando não há mais contas
    }
    // Se há contas para configurar e o usuário não fechou manualmente, abrir
    else if (temContasParaConfigurar && !usuarioFechouWebhook) {
      setAccordionAtivo('webhook');
    }
  }, [configDepositosAtual, isLoadingConfig, usuarioFechouWebhook]);

  // Calcular se deve abrir a seção de status webhook por conta
  useEffect(() => {
    if (isLoadingStatus) return; // Aguardar carregamento
    
    const webhookInfo = statusComWebhookProcessado?.webhook || {};
    const contasBling = webhookInfo.contasBling || [];
    const temContasInativas = contasBling.some(conta => !conta.webhookConfigurado);
    
    // Se há contas inativas e o usuário não fechou manualmente, abrir automaticamente
    if (temContasInativas && !usuarioFechouStatusWebhook && !accordionAtivo) {
      setAccordionAtivo('status-webhook');
    }
    // Não força fechamento quando todas estão configuradas para permitir consulta manual
  }, [statusComWebhookProcessado, isLoadingStatus, usuarioFechouStatusWebhook, accordionAtivo]);

  const handleSincronizacaoCompleta = () => {
    refetchStatus();
  };

  const handleConfigDepositosUpdate = (novaConfig) => {
    setConfigDepositos(novaConfig);
    refetchStatus();
  };

  const handleCronjobAtualizado = (novaConfig) => {
    if (novaConfig) {
      setConfigDepositos(novaConfig);
    }
    refetchStatus();
    if (tenantId) {
      queryClient.invalidateQueries(['config-sincronizacao', tenantId]);
    }
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
        status={statusComWebhookProcessado}
        isLoading={isLoadingStatus}
        pollingAtivo={pollingAtivo}
        onTogglePolling={() => setPollingAtivo(!pollingAtivo)}
        onRefreshManual={refetchStatus}
        statusChecklist={statusChecklist}
      />

      {/* Configuração de Depósitos */}
      <ConfiguracaoDepositos
        tenantId={tenantId}
        config={configDepositosAtual}
        onConfigUpdate={handleConfigDepositosUpdate}
      />

      {/* Seções Avançadas - Colapsáveis */}
      <Accordion 
        className="mb-4" 
        activeKey={accordionAtivo || undefined} 
        onSelect={(key) => {
          setAccordionAtivo(key);
          // Se o usuário fechou a seção de webhook manualmente, marcar flag
          if (key !== 'webhook' && accordionAtivo === 'webhook') {
            setUsuarioFechouWebhook(true);
          }
          // Se o usuário abriu a seção de webhook manualmente, resetar flag
          else if (key === 'webhook') {
            setUsuarioFechouWebhook(false);
          }
          // Se o usuário fechou a seção de status webhook manualmente, marcar flag
          if (key !== 'status-webhook' && accordionAtivo === 'status-webhook') {
            setUsuarioFechouStatusWebhook(true);
          }
          // Se o usuário abriu a seção de status webhook manualmente, resetar flag
          else if (key === 'status-webhook') {
            setUsuarioFechouStatusWebhook(false);
          }
        }}
      >
        {/* Detalhes de Sincronização */}
        <Accordion.Item eventKey="detalhes-sincronizacao">
          <Accordion.Header>
            <strong>Detalhes de Sincronização</strong>
          </Accordion.Header>
          <Accordion.Body>
            <StatusDetalhesSincronizacao status={statusComWebhookProcessado} />
          </Accordion.Body>
        </Accordion.Item>

        {/* Status de Webhook por Conta */}
        <Accordion.Item eventKey="status-webhook">
          <Accordion.Header>
            <strong>Status de Notificações Automáticas (Webhook) por Conta Bling</strong>
          </Accordion.Header>
          <Accordion.Body>
            <StatusWebhookPorConta webhookInfo={statusComWebhookProcessado?.webhook} />
          </Accordion.Body>
        </Accordion.Item>

        {/* Configuração de Webhook */}
        <Accordion.Item eventKey="webhook">
          <Accordion.Header>
            <strong>Configuração de Notificações Automáticas (Webhook)</strong>
          </Accordion.Header>
          <Accordion.Body>
            <ConfiguracaoWebhook
              tenantId={tenantId}
              configuracao={configDepositosAtual}
              isLoading={isLoadingConfig}
            />
          </Accordion.Body>
        </Accordion.Item>

        {/* Configuração de Cronjob */}
        <Accordion.Item eventKey="cronjob">
          <Accordion.Header>
            <strong>Configuração de Sincronização Automática</strong>
          </Accordion.Header>
          <Accordion.Body>
            <ConfiguracaoCronjob
              tenantId={tenantId}
              cronjob={cronjobConfigurado}
              isLoading={isLoadingStatus}
              onConfigAtualizada={handleCronjobAtualizado}
            />
          </Accordion.Body>
        </Accordion.Item>

        {/* Sincronização Manual */}
        <Accordion.Item eventKey="manual">
          <Accordion.Header>
            <strong>Sincronização Manual</strong>
          </Accordion.Header>
          <Accordion.Body>
            <SincronizacaoManual
              tenantId={tenantId}
              onSincronizacaoCompleta={handleSincronizacaoCompleta}
            />
          </Accordion.Body>
        </Accordion.Item>

        {/* Histórico de Sincronizações */}
        <Accordion.Item eventKey="historico">
          <Accordion.Header>
            <strong>Histórico de Sincronizações</strong>
          </Accordion.Header>
          <Accordion.Body>
            <HistoricoSincronizacoes tenantId={tenantId} />
          </Accordion.Body>
        </Accordion.Item>

        {/* Logs e Monitoramento */}
        <Accordion.Item eventKey="logs">
          <Accordion.Header>
            <strong>Logs e Monitoramento</strong>
          </Accordion.Header>
          <Accordion.Body>
            <LogsMonitoramento tenantId={tenantId} />
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </Container>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { Container, Accordion, Button, Form, Badge, Spinner, Alert, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useTenant } from '../context/TenantContext';
import { useQuery, useQueryClient } from 'react-query';
import { sincronizacaoApi } from '../services/sincronizacaoApi';
import StatusSincronizacao from '../components/SincronizacaoEstoque/StatusSincronizacao';
import ConfiguracaoDepositos from '../components/SincronizacaoEstoque/ConfiguracaoDepositos/ConfiguracaoDepositos';
import HistoricoSincronizacoes from '../components/SincronizacaoEstoque/HistoricoSincronizacoes';
import LogsMonitoramento from '../components/SincronizacaoEstoque/LogsMonitoramento';
import StatusWebhookPorConta from '../components/SincronizacaoEstoque/StatusWebhookPorConta';
import StatusDetalhesSincronizacao from '../components/SincronizacaoEstoque/StatusDetalhesSincronizacao';
import { QuestionCircle } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';

export default function SincronizacaoEstoque() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [configDepositos, setConfigDepositos] = useState(null);
  const [pollingAtivo, setPollingAtivo] = useState(true);
  const [accordionAtivo, setAccordionAtivo] = useState(null);
  const [usuarioFechouStatusWebhook, setUsuarioFechouStatusWebhook] = useState(false);
  const [reconciliando, setReconciliando] = useState(false);
  const [suspeitos, setSuspeitos] = useState([]);
  const [carregandoSuspeitos, setCarregandoSuspeitos] = useState(false);
  const [horasRecentes, setHorasRecentes] = useState(24);
  const [limiteRecentes, setLimiteRecentes] = useState(20);
  const [listaSkusManual, setListaSkusManual] = useState('');

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
  // Processar status de webhook baseado nas contas Bling
  const webhookInfo = status?.webhook || {};
  // Webhook está ativo apenas se todas as contas Bling ativas estiverem configuradas
  // Se não houver contas Bling, considera inativo
  const webhookAtivo = webhookInfo.totalContas > 0 && webhookInfo.todasConfiguradas === true;
  
  // Processar status de cronjob
  const statusComWebhookProcessado = {
    ...status,
    webhookAtivo,
    webhook: webhookInfo,
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

  const carregarSuspeitos = async () => {
    if (!tenantId) return;
    setCarregandoSuspeitos(true);
    try {
      const res = await sincronizacaoApi.listarSuspeitos(tenantId, 100);
      setSuspeitos(res.data?.data || res.data || []);
    } catch (error) {
      console.error('Erro ao carregar suspeitos', error);
      toast.error(error?.mensagem || 'Erro ao carregar suspeitos');
    } finally {
      setCarregandoSuspeitos(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      carregarSuspeitos();
    }
  }, [tenantId]);

  const reconciliarWrapper = async (fn, mensagemSucesso) => {
    if (!tenantId) return;
    setReconciliando(true);
    try {
      const res = await fn();
      const data = res?.data?.data || res?.data;
      toast.success(mensagemSucesso || 'Reconciliação concluída');
      carregarSuspeitos();
      queryClient.invalidateQueries(['sincronizacao-status', tenantId]);
      return data;
    } catch (error) {
      console.error('Erro na reconciliação', error);
      toast.error(error?.mensagem || 'Erro na reconciliação');
      return null;
    } finally {
      setReconciliando(false);
    }
  };

  const InfoTooltip = ({ message }) => (
    <OverlayTrigger placement="top" overlay={<Tooltip>{message}</Tooltip>}>
      <QuestionCircle className="text-muted" size={16} role="img" aria-label="Ajuda" />
    </OverlayTrigger>
  );

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

        {/* Histórico de Sincronizações */}
        <Accordion.Item eventKey="historico">
          <Accordion.Header>
            <strong>Histórico de Sincronizações</strong>
          </Accordion.Header>
          <Accordion.Body>
            <HistoricoSincronizacoes tenantId={tenantId} />
          </Accordion.Body>
        </Accordion.Item>

        {/* Reconciliação On-Demand */}
        <Accordion.Item eventKey="reconciliar">
          <Accordion.Header>
            <strong>Reconciliar Estoques (on-demand)</strong>
          </Accordion.Header>
          <Accordion.Body>
            <div className="mb-3">
              <div className="d-flex align-items-center mb-2">
                <strong className="me-2">Suspeitos (últimos 100)</strong>
                <InfoTooltip message="Reconcilia apenas SKUs marcados automaticamente como suspeitos (erros ou divergências recentes). Limite de 100 últimos registros." />
                {carregandoSuspeitos && <Spinner animation="border" size="sm" />}
                <Button
                  size="sm"
                  variant="outline-secondary"
                  className="ms-2"
                  onClick={carregarSuspeitos}
                  disabled={carregandoSuspeitos}
                >
                  Recarregar
                </Button>
              </div>
              {suspeitos.length === 0 ? (
                <Alert variant="light" className="py-2 mb-2">
                  Nenhum SKU suspeito no momento.
                </Alert>
              ) : (
                <div className="d-flex align-items-center mb-2 flex-wrap">
                  {suspeitos.map((item) => (
                    <Badge key={item.sku} bg="secondary" className="me-2 mb-2">
                      {item.sku}
                    </Badge>
                  ))}
                </div>
              )}
              <Button
                variant="primary"
                disabled={reconciliando || suspeitos.length === 0}
                onClick={() =>
                  reconciliarWrapper(
                    () => sincronizacaoApi.reconciliarSuspeitos(tenantId, 100),
                    'Suspeitos reconciliados'
                  )
                }
              >
                {reconciliando ? 'Reconcilia...' : 'Reconciliar suspeitos'}
              </Button>
            </div>

            <hr />

            <div className="mb-3">
              <div className="fw-bold mb-2 d-flex align-items-center gap-2">
                <span>Reconciliar recentes</span>
                <InfoTooltip message="Reconciliam os últimos SKUs processados em até X horas (padrão 24h), limitado à quantidade informada." />
              </div>
              <Form className="d-flex align-items-center flex-wrap gap-2">
                <Form.Group className="me-3 mb-2">
                  <Form.Label className="mb-1 small">Horas (até)</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    max="72"
                    value={horasRecentes}
                    onChange={(e) => setHorasRecentes(parseInt(e.target.value) || 24)}
                    style={{ width: 120 }}
                  />
                </Form.Group>
                <Form.Group className="me-3 mb-2">
                  <Form.Label className="mb-1 small">Limite</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    max="200"
                    value={limiteRecentes}
                    onChange={(e) => setLimiteRecentes(parseInt(e.target.value) || 20)}
                    style={{ width: 120 }}
                  />
                </Form.Group>
                <Button
                  variant="primary"
                  disabled={reconciliando}
                  onClick={() =>
                    reconciliarWrapper(
                      () => sincronizacaoApi.reconciliarRecentes(tenantId, horasRecentes, limiteRecentes),
                      'Recentes reconciliados'
                    )
                  }
                >
                  {reconciliando ? 'Reconcilia...' : 'Reconciliar recentes'}
                </Button>
              </Form>
            </div>

            <hr />

            <div className="mb-3">
              <div className="fw-bold mb-2 d-flex align-items-center gap-2">
                <span>Reconciliar lista de SKUs</span>
                <InfoTooltip message="Reconciliam apenas os SKUs informados manualmente, usando a mesma lógica de atualização de depósitos compartilhados." />
              </div>
              <Form.Group className="mb-2">
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Informe SKUs separados por linha ou vírgula"
                  value={listaSkusManual}
                  onChange={(e) => setListaSkusManual(e.target.value)}
                />
                <Form.Text className="text-muted">
                  Ex.: SKU1,SKU2,SKU3 ou uma por linha.
                </Form.Text>
              </Form.Group>
              <Button
                variant="primary"
                disabled={reconciliando || !listaSkusManual.trim()}
                onClick={() => {
                  const skus = listaSkusManual
                    .split(/[,\\n]/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  if (!skus.length) {
                    toast.warn('Informe ao menos um SKU.');
                    return;
                  }
                  reconciliarWrapper(
                    () => sincronizacaoApi.reconciliarLista(tenantId, skus),
                    'Lista reconciliada'
                  );
                }}
              >
                {reconciliando ? 'Reconcilia...' : 'Reconciliar lista'}
              </Button>
            </div>
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

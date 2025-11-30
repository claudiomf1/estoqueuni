import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Spinner, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Link45deg, CheckCircle, XCircle, Magic } from 'react-bootstrap-icons';
import WizardAssistenteWebhook from './WizardAssistenteWebhook/WizardAssistenteWebhook';
import { usarContasBling } from './ConfiguracaoDepositos/hooks-uso-depositos.jsx';
import { useQuery } from 'react-query';
import { sincronizacaoApi } from '../../services/sincronizacaoApi';

export default function ConfiguracaoWebhook({ tenantId, configuracao, isLoading }) {
  const webhook = configuracao?.webhook || null;
  const [mostrarWizard, setMostrarWizard] = useState(false);
  const { data: contasBling = [] } = usarContasBling(tenantId);
  
  // Buscar configuração atualizada para verificar status das contas
  const { data: configAtualizada, refetch: refetchConfig } = useQuery(
    ['config-sincronizacao-webhook', tenantId],
    () => sincronizacaoApi.obterConfiguracao(tenantId),
    {
      enabled: !!tenantId,
      select: (response) => response.data?.data || response.data
    }
  );
  
  // Verificar se webhook está funcionando (última requisição há menos de 1 hora = funcionando)
  const verificarWebhookFuncionando = () => {
    if (!webhook?.ultimaRequisicao) return false;
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
    const ultimaReq = new Date(webhook.ultimaRequisicao);
    return ultimaReq > umaHoraAtras;
  };

  const webhookFuncionando = verificarWebhookFuncionando();
  
  // Verificar quais contas estão configuradas
  const contasBlingAtivas = contasBling.filter(conta => conta.isActive !== false);
  const contasConfiguradas = (configAtualizada?.contasBling || configuracao?.contasBling || [])
    .filter(conta => conta.isActive !== false && conta.webhookConfigurado === true);
  const contasNaoConfiguradas = contasBlingAtivas.filter(conta => {
    const contaId = conta.blingAccountId || conta._id || conta.id;
    return !contasConfiguradas.some(c => (c.blingAccountId || c._id || c.id) === contaId);
  });
  
  const temContasParaConfigurar = contasNaoConfiguradas.length > 0;
  const nomesContasPendentes = contasNaoConfiguradas.map(c => c.accountName || c.store_name || 'Conta sem nome').join(', ');

  const formatarData = (data) => {
    if (!data) return '-';
    try {
      return new Date(data).toLocaleString('pt-BR');
    } catch {
      return '-';
    }
  };

  // Gerar URL do webhook (sempre usar produção)
  const gerarUrlWebhook = () => {
    // Se já tem URL configurada, usar ela
    if (webhook?.url) {
      return webhook.url;
    }

    // URL de produção - sempre usar esta URL para webhooks
    // Pode ser configurada via variável de ambiente VITE_WEBHOOK_BASE_URL
    const urlProducao = import.meta.env.VITE_WEBHOOK_BASE_URL || 
                       import.meta.env.VITE_PUBLIC_URL ||
                       'https://estoqueuni.com.br';

    // Sempre usar URL de produção (mesmo em desenvolvimento)
    // O Bling precisa de uma URL pública e acessível
    return `${urlProducao}/api/webhooks/bling?tenantId=${tenantId}`;
  };

  const urlWebhook = gerarUrlWebhook();

  return (
    <Card className="mb-4">
      <Card.Header>
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <Link45deg className="me-2" />
            <h5 className="mb-0">Configuração de Notificações Automáticas (Webhook)</h5>
          </div>
          {webhook && (
            <>
              {temContasParaConfigurar ? (
                <OverlayTrigger
                  placement="bottom"
                  overlay={
                    <Tooltip id="tooltip-configurar-notificacoes">
                      <strong>⚠️ Ação Necessária!</strong>
                      <br />
                      <br />
                      Ainda há <strong>{contasNaoConfiguradas.length} conta(s) Bling</strong> que precisam ter as notificações automáticas configuradas:
                      <br />
                      <strong>{nomesContasPendentes}</strong>
                      <br />
                      <br />
                      <strong>Clique aqui</strong> para receber instruções passo a passo e configurar agora mesmo.
                      <br />
                      <br />
                      Sem essa configuração, o EstoqueUni não receberá avisos automáticos quando houver vendas ou mudanças de estoque.
                    </Tooltip>
                  }
                >
                  <Button
                    variant="warning"
                    size="lg"
                    onClick={() => setMostrarWizard(true)}
                    className="pulsing-button"
                  >
                    <Magic className="me-2" />
                    ⚠️ Configurar Notificações ({contasNaoConfiguradas.length} conta{contasNaoConfiguradas.length > 1 ? 's' : ''} pendente{contasNaoConfiguradas.length > 1 ? 's' : ''})
                  </Button>
                </OverlayTrigger>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setMostrarWizard(true)}
                >
                  <Magic className="me-2" />
                  Assistente de Configuração
                </Button>
              )}
            </>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        {isLoading ? (
          <div className="text-center">
            <Spinner animation="border" className="me-2" />
            <span>Carregando configuração...</span>
          </div>
        ) : !webhook ? (
          <Alert variant="info" className="mb-0">
            Nenhuma configuração de notificações automáticas encontrada para este tenant. Configure os depósitos e salve para habilitar esta seção.
          </Alert>
        ) : (
          <>
            <div className="mb-3">
              <label className="fw-bold">URL para Receber Notificações</label>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  value={urlWebhook}
                  readOnly
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(urlWebhook);
                    alert('URL copiada para a área de transferência!');
                  }}
                >
                  Copiar
                </Button>
              </div>
              <small className="text-muted d-block mt-1">
                Configure esta URL no Bling para receber notificações de vendas e mudanças de estoque.
                Quando uma venda for realizada, o EstoqueUni será notificado e atualizará automaticamente os depósitos compartilhados.
              </small>
            </div>

            <div className="mb-3">
              <div className="d-flex align-items-center mb-2">
                <span className="fw-bold me-2">Status da Conexão:</span>
                {webhook?.ativo ? (
                  <>
                    <CheckCircle className="text-success me-2" />
                    <Badge bg="success">Ativo</Badge>
                  </>
                ) : (
                  <>
                    <XCircle className="text-warning me-2" />
                    <Badge bg="warning">Inativo</Badge>
                  </>
                )}
              </div>
              <small className="text-muted">
                Última requisição registrada: {formatarData(webhook?.ultimaRequisicao)}
              </small>
              
              {!webhookFuncionando && webhook?.ultimaRequisicao && (
                <Alert variant="warning" className="mt-2 mb-0">
                  <strong>⚠️ As notificações automáticas não estão sendo recebidas recentemente.</strong>
                  <br />
                  <small>
                    Se você acabou de configurar, aguarde alguns minutos. Se já passou algum tempo,
                    verifique se as notificações automáticas (webhooks) estão ativadas no Bling para todas as contas conectadas.
                  </small>
                </Alert>
              )}
              
              {!webhook?.ultimaRequisicao && (
                <Alert variant="warning" className="mt-2 mb-0">
                  <strong>⚠️ Nenhuma notificação recebida ainda.</strong>
                  <br />
                  <small>
                    Configure as notificações automáticas (webhooks) no Bling usando o botão "Assistente de Configuração" acima.
                    Após configurar, faça uma venda ou altere um estoque no Bling para testar.
                  </small>
                </Alert>
              )}
            </div>

            <hr />

            <div className="mb-2">
              <h6>Histórico de Requisições</h6>
            </div>

            <Alert variant="secondary" className="mb-0">
              O monitoramento detalhado das notificações automáticas (webhooks) estará disponível em breve. Por enquanto, utilize os logs gerais para acompanhar os eventos recebidos.
            </Alert>
          </>
        )}
      </Card.Body>

      {/* Wizard Assistente */}
      <WizardAssistenteWebhook
        mostrar={mostrarWizard}
        onFechar={() => {
          setMostrarWizard(false);
          refetchConfig();
        }}
        urlWebhook={urlWebhook}
        tenantId={tenantId}
        ultimaRequisicao={webhook?.ultimaRequisicao}
        contasBling={contasBling}
        webhookFuncionando={webhookFuncionando}
        onContaConfigurada={() => {
          refetchConfig();
        }}
      />
    </Card>
  );
}



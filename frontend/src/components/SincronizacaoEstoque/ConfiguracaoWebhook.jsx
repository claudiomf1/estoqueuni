import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Spinner, Badge, Table } from 'react-bootstrap';
import { Link45deg, CheckCircle, XCircle, ArrowRepeat } from 'react-bootstrap-icons';
import { sincronizacaoApi } from '../../services/sincronizacaoApi';
import { useQuery } from 'react-query';

export default function ConfiguracaoWebhook({ tenantId }) {
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState(null);

  const { data: configWebhook, isLoading: isLoadingConfig, refetch: refetchConfig } = useQuery(
    ['webhook-config', tenantId],
    () => sincronizacaoApi.obterConfiguracaoWebhook(tenantId),
    {
      enabled: !!tenantId,
      select: (response) => response.data?.data || response.data
    }
  );

  const { data: historicoResponse, isLoading: isLoadingHistorico, refetch: refetchHistorico } = useQuery(
    ['webhook-historico', tenantId],
    () => sincronizacaoApi.obterHistoricoWebhook(tenantId, { limit: 10 }),
    {
      enabled: !!tenantId,
      select: (response) => response.data?.data || response.data || []
    }
  );

  const historico = historicoResponse || [];

  const handleTestarWebhook = async () => {
    setTestando(true);
    setResultadoTeste(null);

    try {
      const response = await sincronizacaoApi.testarWebhook(tenantId);
      if (response.data?.success !== false) {
        setResultadoTeste({
          sucesso: true,
          mensagem: response.data?.message || 'Webhook testado com sucesso!'
        });
      } else {
        throw new Error(response.data?.message || 'Erro ao testar webhook');
      }
    } catch (err) {
      setResultadoTeste({
        sucesso: false,
        mensagem: err.mensagem || err.message || 'Erro ao testar webhook'
      });
    } finally {
      setTestando(false);
      refetchHistorico();
      setTimeout(() => setResultadoTeste(null), 7000);
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    try {
      return new Date(data).toLocaleString('pt-BR');
    } catch {
      return '-';
    }
  };

  const urlWebhook = configWebhook?.url || `https://seu-dominio.com/api/sincronizacao/webhook/${tenantId}`;

  return (
    <Card className="mb-4">
      <Card.Header>
        <div className="d-flex align-items-center">
          <Link45deg className="me-2" />
          <h5 className="mb-0">Configuração de Webhook</h5>
        </div>
      </Card.Header>
      <Card.Body>
        {isLoadingConfig ? (
          <div className="text-center">
            <Spinner animation="border" className="me-2" />
            <span>Carregando configuração...</span>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <label className="fw-bold">URL do Webhook</label>
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
                Configure esta URL no Bling para receber notificações de mudanças de estoque
              </small>
            </div>

            <div className="mb-3">
              <div className="d-flex align-items-center mb-2">
                <span className="fw-bold me-2">Status da Conexão:</span>
                {configWebhook?.ativo ? (
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
            </div>

            <div className="mb-3">
              <Button
                variant="primary"
                onClick={handleTestarWebhook}
                disabled={testando}
              >
                {testando ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" className="me-2" />
                    Testando...
                  </>
                ) : (
                  <>
                    <ArrowRepeat className="me-2" />
                    Testar Webhook
                  </>
                )}
              </Button>
            </div>

            {resultadoTeste && (
              <Alert
                variant={resultadoTeste.sucesso ? 'success' : 'danger'}
                className="mb-3"
                dismissible
                onClose={() => setResultadoTeste(null)}
              >
                {resultadoTeste.mensagem}
              </Alert>
            )}

            <hr />

            <div className="mb-2">
              <h6>Histórico de Requisições (Últimas 10)</h6>
            </div>

            {isLoadingHistorico ? (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" className="me-2" />
                <span>Carregando histórico...</span>
              </div>
            ) : historico.length === 0 ? (
              <Alert variant="info" className="mb-0">
                Nenhuma requisição recebida ainda.
              </Alert>
            ) : (
              <Table striped bordered hover size="sm">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Status</th>
                    <th>Método</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((req, index) => (
                    <tr key={index}>
                      <td>{formatarData(req.dataHora)}</td>
                      <td>
                        <Badge bg={req.status === 200 ? 'success' : 'danger'}>
                          {req.status || 'N/A'}
                        </Badge>
                      </td>
                      <td>{req.metodo || 'N/A'}</td>
                      <td>{req.ip || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}



import React from 'react';
import { Card, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import { Link45deg, CheckCircle, XCircle } from 'react-bootstrap-icons';

export default function ConfiguracaoWebhook({ tenantId, configuracao, isLoading }) {
  const webhook = configuracao?.webhook || null;

  const formatarData = (data) => {
    if (!data) return '-';
    try {
      return new Date(data).toLocaleString('pt-BR');
    } catch {
      return '-';
    }
  };

  const urlWebhook = webhook?.url || `https://seu-dominio.com/api/sincronizacao/webhook/${tenantId}`;

  return (
    <Card className="mb-4">
      <Card.Header>
        <div className="d-flex align-items-center">
          <Link45deg className="me-2" />
          <h5 className="mb-0">Configuração de Webhook</h5>
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
            Nenhuma configuração de webhook encontrada para este tenant. Configure os depósitos e salve para habilitar esta seção.
          </Alert>
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
            </div>

            <hr />

            <div className="mb-2">
              <h6>Histórico de Requisições</h6>
            </div>

            <Alert variant="secondary" className="mb-0">
              O monitoramento detalhado das requisições do webhook estará disponível em breve. Por enquanto, utilize os logs gerais para acompanhar os eventos recebidos.
            </Alert>
          </>
        )}
      </Card.Body>
    </Card>
  );
}



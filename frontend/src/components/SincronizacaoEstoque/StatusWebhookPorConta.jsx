import React from 'react';
import { Row, Col, Badge } from 'react-bootstrap';
import { CheckCircle, XCircle } from 'react-bootstrap-icons';

/**
 * Componente que exibe o status de webhook por conta Bling
 */
function StatusWebhookPorConta({ webhookInfo }) {
  const formatarData = (data) => {
    if (!data) return '-';
    try {
      return new Date(data).toLocaleString('pt-BR');
    } catch {
      return '-';
    }
  };

  if (!webhookInfo?.contasBling || webhookInfo.contasBling.length === 0) {
    return (
      <div className="text-muted">Nenhuma conta Bling configurada</div>
    );
  }

  return (
    <div>
      <div className="fw-bold mb-3">Notificações Automáticas (Webhook) por Conta Bling</div>
      <div className="d-flex flex-wrap gap-3">
        {webhookInfo.contasBling.map((conta, index) => (
          <div key={conta.blingAccountId || index} className="d-flex align-items-center border rounded p-3 bg-light" style={{ minWidth: '250px' }}>
            <div className="me-3">
              {conta.webhookConfigurado ? (
                <CheckCircle size={24} className="text-success" />
              ) : (
                <XCircle size={24} className="text-warning" />
              )}
            </div>
            <div>
              <div className="fw-semibold">{conta.accountName || conta.blingAccountId}</div>
              <Badge bg={conta.webhookConfigurado ? 'success' : 'warning'} className="mt-1">
                {conta.webhookConfigurado ? 'Webhook Ativo' : 'Webhook Inativo'}
              </Badge>
              {conta.webhookConfiguradoEm && (
                <small className="text-muted d-block mt-1">
                  Configurado em: {formatarData(conta.webhookConfiguradoEm)}
                </small>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StatusWebhookPorConta;









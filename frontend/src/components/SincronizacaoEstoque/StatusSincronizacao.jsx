import React from 'react';
import { Card, Badge, Spinner, Row, Col } from 'react-bootstrap';
import { CheckCircle, XCircle, Clock, Activity } from 'react-bootstrap-icons';

export default function StatusSincronizacao({ status, isLoading }) {
  if (isLoading) {
    return (
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Status da Sincronização</h5>
        </Card.Header>
        <Card.Body className="text-center">
          <Spinner animation="border" className="me-2" />
          <span>Carregando status...</span>
        </Card.Body>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Status da Sincronização</h5>
        </Card.Header>
        <Card.Body>
          <div className="alert alert-warning mb-0">
            Nenhum status disponível. Configure a sincronização para começar.
          </div>
        </Card.Body>
      </Card>
    );
  }

  const formatarData = (data) => {
    if (!data) return 'Nunca';
    try {
      return new Date(data).toLocaleString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header>
        <h5 className="mb-0">Status da Sincronização</h5>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={3} className="mb-3">
            <div className="d-flex align-items-center">
              <div className="me-3">
                {status.ativo ? (
                  <CheckCircle size={32} className="text-success" />
                ) : (
                  <XCircle size={32} className="text-danger" />
                )}
              </div>
              <div>
                <div className="fw-bold">Status Geral</div>
                <Badge bg={status.ativo ? 'success' : 'secondary'}>
                  {status.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          </Col>

          <Col md={3} className="mb-3">
            <div className="d-flex align-items-center">
              <div className="me-3">
                {status.webhookAtivo ? (
                  <CheckCircle size={32} className="text-success" />
                ) : (
                  <XCircle size={32} className="text-warning" />
                )}
              </div>
              <div>
                <div className="fw-bold">Webhook</div>
                <Badge bg={status.webhookAtivo ? 'success' : 'warning'}>
                  {status.webhookAtivo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          </Col>

          <Col md={3} className="mb-3">
            <div className="d-flex align-items-center">
              <div className="me-3">
                {status.cronjobAtivo ? (
                  <CheckCircle size={32} className="text-success" />
                ) : (
                  <XCircle size={32} className="text-warning" />
                )}
              </div>
              <div>
                <div className="fw-bold">Cronjob</div>
                <Badge bg={status.cronjobAtivo ? 'success' : 'warning'}>
                  {status.cronjobAtivo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          </Col>

          <Col md={3} className="mb-3">
            <div className="d-flex align-items-center">
              <div className="me-3">
                <Clock size={32} className="text-info" />
              </div>
              <div>
                <div className="fw-bold">Última Sincronização</div>
                <small className="text-muted d-block">
                  {formatarData(status.ultimaSincronizacao)}
                </small>
              </div>
            </div>
          </Col>
        </Row>

        <hr />

        <Row>
          <Col md={3} className="mb-2">
            <div className="d-flex align-items-center">
              <Activity className="me-2 text-primary" />
              <div>
                <div className="fw-bold">Total Sincronizado</div>
                <div className="h4 mb-0">{status.totalSincronizado || 0}</div>
                <small className="text-muted">produtos</small>
              </div>
            </div>
          </Col>

          <Col md={3} className="mb-2">
            <div className="d-flex align-items-center">
              <CheckCircle className="me-2 text-success" />
              <div>
                <div className="fw-bold">Sucessos</div>
                <div className="h4 mb-0">{status.totalSucesso || 0}</div>
                <small className="text-muted">operações</small>
              </div>
            </div>
          </Col>

          <Col md={3} className="mb-2">
            <div className="d-flex align-items-center">
              <XCircle className="me-2 text-danger" />
              <div>
                <div className="fw-bold">Erros</div>
                <div className="h4 mb-0">{status.totalErros || 0}</div>
                <small className="text-muted">operações</small>
              </div>
            </div>
          </Col>

          <Col md={3} className="mb-2">
            <div className="d-flex align-items-center">
              <Clock className="me-2 text-warning" />
              <div>
                <div className="fw-bold">Pendentes</div>
                <div className="h4 mb-0">{status.totalPendentes || 0}</div>
                <small className="text-muted">operações</small>
              </div>
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}



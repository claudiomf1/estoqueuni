import React from 'react';
import { Card, Form, Alert, Row, Col, Badge, Button } from 'react-bootstrap';
import { Trash } from 'react-bootstrap-icons';

export default function RegraSincronizacao({
  depositos,
  regraSincronizacao,
  salvando,
  handleToggleDepositoPrincipal,
  handleToggleDepositoCompartilhado,
  handleRemoverDeposito
}) {
  if (depositos.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <h6 className="mb-3">Regra de Sincronização</h6>
      <Alert variant="info" className="mb-3">
        Selecione quais depósitos são usados para calcular o estoque (principais) 
        e quais recebem o resultado da sincronização (compartilhados).
      </Alert>

      <Row>
        <Col md={6}>
          <Card>
            <Card.Header>
              <strong>Depósitos Principais</strong>
              <Badge bg="primary" className="ms-2">
                {regraSincronizacao.depositosPrincipais.length} selecionado(s)
              </Badge>
            </Card.Header>
            <Card.Body>
              <Form.Text className="text-muted d-block mb-2">
                Estoque desses depósitos será somado
              </Form.Text>
              {depositos.map((deposito, idx) => {
                const index = depositos.findIndex(d => d.id === deposito.id);
                return (
                  <div key={deposito.id || `temp-${idx}`} className="d-flex align-items-center justify-content-between mb-2">
                    <Form.Check
                      type="checkbox"
                      id={`principal-${deposito.id || idx}`}
                      label={deposito.nome || `Depósito ${deposito.id || 'sem nome'}`}
                      checked={deposito.id && regraSincronizacao.depositosPrincipais.includes(deposito.id)}
                      onChange={() => deposito.id && handleToggleDepositoPrincipal(deposito.id)}
                      disabled={salvando || !deposito.id}
                      className="flex-grow-1"
                    />
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleRemoverDeposito(index)}
                      disabled={salvando || index === -1}
                      title="Remover depósito da configuração"
                      className="ms-2"
                    >
                      <Trash size={14} />
                    </Button>
                  </div>
                );
              })}
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card>
            <Card.Header>
              <strong>Depósitos Compartilhados</strong>
              <Badge bg="success" className="ms-2">
                {regraSincronizacao.depositosCompartilhados.length} selecionado(s)
              </Badge>
            </Card.Header>
            <Card.Body>
              <Form.Text className="text-muted d-block mb-2">
                Estoque será atualizado nesses depósitos
              </Form.Text>
              {depositos.map((deposito, idx) => {
                const index = depositos.findIndex(d => d.id === deposito.id);
                return (
                  <div key={deposito.id || `temp-${idx}`} className="d-flex align-items-center justify-content-between mb-2">
                    <Form.Check
                      type="checkbox"
                      id={`compartilhado-${deposito.id || idx}`}
                      label={deposito.nome || `Depósito ${deposito.id || 'sem nome'}`}
                      checked={deposito.id && regraSincronizacao.depositosCompartilhados.includes(deposito.id)}
                      onChange={() => deposito.id && handleToggleDepositoCompartilhado(deposito.id)}
                      disabled={salvando || !deposito.id}
                      className="flex-grow-1"
                    />
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleRemoverDeposito(index)}
                      disabled={salvando || index === -1}
                      title="Remover depósito da configuração"
                      className="ms-2"
                    >
                      <Trash size={14} />
                    </Button>
                  </div>
                );
              })}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}


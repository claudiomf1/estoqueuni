import React from 'react';
import { Card, Form, Button, Alert, Row, Col } from 'react-bootstrap';
import { Trash } from 'react-bootstrap-icons';

export default function ListaDepositos({
  depositos,
  contasBling,
  salvando,
  handleDepositoChange,
  handleRemoverDeposito
}) {
  if (depositos.length === 0) {
    return (
      <div className="mb-4">
        <h6 className="mb-3">Depósitos Cadastrados na Configuração</h6>
        <Alert variant="info">
          Nenhum depósito cadastrado. Clique em "Adicionar Depósito" para começar.
        </Alert>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <h6 className="mb-3">Depósitos Cadastrados na Configuração</h6>
      {depositos.map((deposito, index) => (
        <Card key={index} className="mb-3">
          <Card.Body>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-2">
                  <Form.Label>Nome do Depósito</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ex: Depósito Principal SP"
                    value={deposito.nome}
                    onChange={(e) => handleDepositoChange(index, 'nome', e.target.value)}
                    disabled={salvando}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-2">
                  <Form.Label>ID do Depósito (Bling)</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder={deposito.tipo === 'compartilhado' ? 'Ex: 14886873196 (opcional para marketplaces)' : 'Ex: 14886873196'}
                    value={deposito.id}
                    onChange={(e) => handleDepositoChange(index, 'id', e.target.value)}
                    disabled={salvando}
                  />
                  <Form.Text className="text-muted">
                    {deposito.tipo === 'compartilhado' 
                      ? 'ID único do depósito no Bling (opcional para marketplaces externos)' 
                      : 'ID único do depósito no Bling'}
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-2">
                  <Form.Label>Tipo</Form.Label>
                  <Form.Select
                    value={deposito.tipo}
                    onChange={(e) => handleDepositoChange(index, 'tipo', e.target.value)}
                    disabled={salvando}
                  >
                    <option value="principal">Principal</option>
                    <option value="compartilhado">Compartilhado</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group className="mb-2">
                  <Form.Label>Ações</Form.Label>
                  <div>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleRemoverDeposito(index)}
                      disabled={salvando}
                      title="Remover depósito"
                    >
                      <Trash />
                    </Button>
                  </div>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Conta Bling (Opcional)</Form.Label>
                  <Form.Select
                    value={deposito.contaBlingId || ''}
                    onChange={(e) => handleDepositoChange(index, 'contaBlingId', e.target.value)}
                    disabled={salvando}
                  >
                    <option value="">Nenhuma conta associada</option>
                    {contasBling.map((conta) => (
                      <option key={conta._id || conta.id} value={conta.blingAccountId || conta._id || conta.id}>
                        {conta.accountName || conta.store_name || 'Conta sem nome'}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Associe este depósito a uma conta Bling específica
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
}


import React from 'react';
import { Modal, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { Plus } from 'react-bootstrap-icons';

export default function ModalCriarDeposito({
  mostrar,
  fechar,
  novoDeposito,
  setNovoDeposito,
  criarDeposito,
  isLoading,
  erro
}) {
  const handleCriar = () => {
    if (!novoDeposito.descricao || !novoDeposito.descricao.trim()) {
      return;
    }
    criarDeposito();
  };

  return (
    <Modal show={mostrar} onHide={fechar} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <Plus className="me-2" />
          Criar Novo Depósito no Bling
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Nome do Depósito *</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ex: Depósito Principal SP"
              value={novoDeposito.descricao}
              onChange={(e) => setNovoDeposito({ ...novoDeposito, descricao: e.target.value })}
              disabled={isLoading}
            />
            <Form.Text className="text-muted">
              Nome que aparecerá no Bling
            </Form.Text>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Situação</Form.Label>
            <Form.Select
              value={novoDeposito.situacao}
              onChange={(e) => setNovoDeposito({ ...novoDeposito, situacao: e.target.value })}
              disabled={isLoading}
            >
              <option value="A">Ativo</option>
              <option value="I">Inativo</option>
              </Form.Select>
            </Form.Group>
            {erro && (
              <Alert variant="danger" className="mt-3">
                {erro}
              </Alert>
            )}
          </Form>
        </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={fechar}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleCriar}
          disabled={isLoading || !novoDeposito.descricao.trim()}
        >
          {isLoading ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-2" />
              Criando...
            </>
          ) : (
            <>
              <Plus className="me-1" />
              Criar Depósito
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}


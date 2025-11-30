import React from 'react';
import { Modal, Form, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import { Plus, Building } from 'react-bootstrap-icons';

export default function ModalCriarDeposito({
  mostrar,
  fechar,
  novoDeposito,
  setNovoDeposito,
  criarDeposito,
  isLoading,
  erro,
  contaSelecionada,
  contasBling
}) {
  // Encontrar o nome da conta selecionada
  const contaAtual = contasBling?.find(
    conta => (conta.blingAccountId || conta._id || conta.id) === contaSelecionada
  );
  const nomeConta = contaAtual?.accountName || contaAtual?.store_name || 'Conta sem nome';
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
        {contaSelecionada && (
          <Alert variant="info" className="mb-3">
            <Building className="me-2" />
            <strong>Conta Bling:</strong>{' '}
            <Badge bg="primary">{nomeConta}</Badge>
            <br />
            <small className="text-muted">
              O depósito será criado nesta conta Bling
            </small>
          </Alert>
        )}
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


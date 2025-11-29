import React from 'react';
import { Form, Button, Alert, Spinner, Badge, Row, Col } from 'react-bootstrap';
import { CloudArrowDown, Plus, X, Trash } from 'react-bootstrap-icons';

export default function SecaoGerenciarBling({
  contaSelecionada,
  setContaSelecionada,
  contasBling,
  depositosBling,
  carregandoDepositos,
  depositos,
  salvando,
  setMostrarModalCriar,
  handleAdicionarDepositoDaLista,
  handleDeletarDeposito,
  deletarDepositoMutation
}) {
  return (
    <div className="mb-4 p-3 border rounded bg-light">
      <h6 className="mb-3">
        <CloudArrowDown className="me-2" />
        Gerenciar Depósitos do Bling
      </h6>
      <Row>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>Selecione uma Conta Bling</Form.Label>
            <Form.Select
              value={contaSelecionada}
              onChange={(e) => {
                setContaSelecionada(e.target.value);
              }}
              disabled={salvando}
            >
              <option value="">-- Selecione uma conta --</option>
              {contasBling
                .filter(conta => conta.isActive !== false && conta.is_active !== false)
                .map((conta) => (
                  <option key={conta._id || conta.id} value={conta.blingAccountId || conta._id || conta.id}>
                    {conta.accountName || conta.store_name || 'Conta sem nome'}
                  </option>
                ))}
            </Form.Select>
            <Form.Text className="text-muted">
              Selecione uma conta para listar e gerenciar seus depósitos
            </Form.Text>
          </Form.Group>
        </Col>
        <Col md={6} className="d-flex align-items-end">
          <Button
            variant="outline-success"
            onClick={() => setMostrarModalCriar(true)}
            disabled={!contaSelecionada || salvando}
          >
            <Plus className="me-1" />
            Criar Novo Depósito no Bling
          </Button>
        </Col>
      </Row>

      {contaSelecionada && (
        <div className="mt-3">
          {carregandoDepositos ? (
            <div className="text-center py-3">
              <Spinner animation="border" size="sm" className="me-2" />
              <span>Carregando depósitos do Bling...</span>
            </div>
          ) : depositosBling && depositosBling.length > 0 ? (
            <div>
              <Form.Label className="mb-2">
                <strong>Depósitos Disponíveis no Bling:</strong>
              </Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {depositosBling.map((deposito) => {
                  const jaAdicionado = depositos.some(d => d.id === deposito.id.toString());
                  const deletando = deletarDepositoMutation.isLoading;
                  return (
                    <div key={deposito.id} className="position-relative">
                      <Badge
                        bg={jaAdicionado ? 'secondary' : 'info'}
                        className="p-2 d-flex align-items-center gap-2"
                        style={{ cursor: jaAdicionado ? 'not-allowed' : 'pointer' }}
                        onClick={() => !jaAdicionado && !deletando && handleAdicionarDepositoDaLista(deposito)}
                        title={jaAdicionado ? 'Já adicionado' : 'Clique para adicionar'}
                      >
                        <span>{deposito.descricao || `Depósito ${deposito.id}`}</span>
                        {!jaAdicionado && <Plus size={16} />}
                        {jaAdicionado && <X size={16} />}
                      </Badge>
                      {!jaAdicionado && (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          className="ms-1"
                          style={{ padding: '2px 6px', fontSize: '12px' }}
                          title={`Remover depósito "${deposito.descricao || deposito.id}" (ID: ${deposito.id}) da configuração do EstoqueUni`}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const idDeposito = deposito.id;
                            const nomeDeposito = deposito.descricao || `Depósito ${deposito.id}`;
                            handleDeletarDeposito(idDeposito, nomeDeposito);
                          }}
                          disabled={deletando}
                        >
                          {deletando ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            <Trash size={14} />
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <Form.Text className="text-muted d-block mt-2">
                Clique em um depósito para adicioná-lo à configuração
              </Form.Text>
            </div>
          ) : (
            <Alert variant="info" className="mb-0">
              Nenhum depósito encontrado nesta conta Bling.
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}


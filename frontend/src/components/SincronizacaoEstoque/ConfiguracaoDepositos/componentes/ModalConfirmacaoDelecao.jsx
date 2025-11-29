import React from 'react';
import { Modal, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import { ExclamationTriangle, InfoCircle, Trash, ArrowRight, ThreeDotsVertical } from 'react-bootstrap-icons';

export default function ModalConfirmacaoDelecao({
  mostrar,
  fechar,
  depositoParaDeletar,
  confirmarDelecao,
  isLoading
}) {
  return (
    <Modal
      show={mostrar}
      onHide={fechar}
      centered
      backdrop="static"
      keyboard={false}
      size="lg"
    >
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title className="d-flex align-items-center gap-2">
          <div className="bg-danger bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center">
            <ExclamationTriangle className="text-danger" size={24} />
          </div>
          <span>Remover Depósito da Configuração</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="pt-3">
        {depositoParaDeletar && (
          <>
            <div className="mb-4">
              <p className="text-muted mb-3">
                Você está prestes a remover o seguinte depósito da configuração do EstoqueUni:
              </p>
              <div className="bg-light rounded p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold">Nome do Depósito:</span>
                  <span className="text-primary">{depositoParaDeletar.nome}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="fw-bold">ID:</span>
                  <span className="text-muted font-monospace">{depositoParaDeletar.id}</span>
                </div>
              </div>
            </div>

            <Alert variant="warning" className="d-flex align-items-start gap-3 mb-4">
              <InfoCircle size={24} className="flex-shrink-0 mt-1" />
              <div>
                <strong className="d-block mb-2">⚠️ Importante:</strong>
                <ul className="mb-0 ps-3">
                  <li className="mb-1">
                    Este depósito será removido apenas da <strong>configuração do EstoqueUni</strong>
                  </li>
                  <li className="mb-1">
                    O depósito <strong>continuará existindo no Bling</strong> e não será afetado
                  </li>
                  <li className="mt-2">
                    <div className="mb-2">
                      <span className="text-muted">Para inativar manualmente no Bling, siga os passos:</span>
                    </div>
                    <div className="d-flex flex-column gap-2">
                      <div className="d-flex align-items-center gap-2">
                        <Badge bg="primary" className="px-2 py-1">
                          <strong>1. Navegue:</strong>
                        </Badge>
                        <span className="text-primary fw-bold d-flex align-items-center gap-1">
                          Estoque 
                          <ArrowRight size={16} />
                          Depósitos
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <Badge bg="secondary" className="px-2 py-1">
                          <strong>2. Ação:</strong>
                        </Badge>
                        <span className="d-flex align-items-center gap-1">
                          Clique nos 
                          <ThreeDotsVertical size={16} className="text-muted" />
                          <strong>três pontinhos</strong> do depósito e selecione 
                          <Badge bg="warning" text="dark" className="ms-1">Inativar</Badge>
                        </span>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </Alert>

            <div className="bg-info bg-opacity-10 rounded p-3">
              <div className="d-flex align-items-start gap-2">
                <InfoCircle className="text-info flex-shrink-0 mt-1" />
                <small className="text-muted">
                  Esta ação também removerá automaticamente o depósito das regras de sincronização 
                  (depósitos principais e compartilhados), caso esteja configurado.
                </small>
              </div>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer className="border-0 pt-0">
        <Button variant="secondary" onClick={fechar}>
          Cancelar
        </Button>
        <Button 
          variant="danger" 
          onClick={confirmarDelecao}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Removendo...
            </>
          ) : (
            <>
              <Trash className="me-2" />
              Remover da Configuração
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}


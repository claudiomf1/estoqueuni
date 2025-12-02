import React from 'react';
import { Modal, Button, Alert, Spinner } from 'react-bootstrap';
import { ExclamationTriangle, InfoCircle, Trash } from 'react-bootstrap-icons';

export default function ModalConfirmacaoRemoverDeposito({
  mostrar,
  fechar,
  deposito,
  confirmarRemocao,
  isLoading
}) {
  if (!deposito) return null;

  return (
    <Modal
      show={mostrar}
      onHide={fechar}
      centered
      backdrop="static"
      keyboard={false}
    >
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title className="d-flex align-items-center gap-2">
          <div className="bg-danger bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center">
            <ExclamationTriangle className="text-danger" size={24} />
          </div>
          <span>Remover Depósito</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="pt-3">
        <div className="mb-4">
          <p className="text-muted mb-3">
            Você está prestes a remover o depósito da configuração:
          </p>
          <div className="bg-light rounded p-3 mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-bold">Nome do Depósito:</span>
              <span className="text-primary">{deposito.nome || 'Sem nome'}</span>
            </div>
            {deposito.id && (
              <div className="d-flex justify-content-between align-items-center">
                <span className="fw-bold">ID:</span>
                <span className="text-muted font-monospace">{deposito.id}</span>
              </div>
            )}
          </div>
        </div>

        <Alert variant="warning" className="d-flex align-items-start gap-3 mb-3">
          <InfoCircle size={24} className="flex-shrink-0 mt-1" />
          <div>
            <strong className="d-block mb-2">⚠️ Atenção:</strong>
            <ul className="mb-0 ps-3">
              <li className="mb-1">
                Este depósito será removido da <strong>configuração do EstoqueUni</strong>
              </li>
              <li className="mb-1">
                A alteração será <strong>salva automaticamente</strong> no banco de dados
              </li>
              <li>
                O depósito também será removido das <strong>regras de sincronização</strong> (principais e compartilhados)
              </li>
            </ul>
          </div>
        </Alert>

        <div className="bg-info bg-opacity-10 rounded p-3">
          <div className="d-flex align-items-start gap-2">
            <InfoCircle className="text-info flex-shrink-0 mt-1" />
            <small className="text-muted">
              O depósito <strong>continuará existindo no Bling</strong> e não será afetado. 
              Esta ação remove apenas da configuração local do EstoqueUni.
            </small>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer className="border-0 pt-0">
        <Button variant="secondary" onClick={fechar} disabled={isLoading}>
          Cancelar
        </Button>
        <Button 
          variant="danger" 
          onClick={confirmarRemocao}
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
              Remover Depósito
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}







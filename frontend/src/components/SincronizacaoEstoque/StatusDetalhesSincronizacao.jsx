import React from 'react';
import { Row, Col } from 'react-bootstrap';
import { Clock } from 'react-bootstrap-icons';

/**
 * Componente que exibe detalhes adicionais de sincronização
 * (Sincronização Automática e Última Sincronização)
 */
function StatusDetalhesSincronizacao({ status }) {
  const formatarData = (data) => {
    if (!data) return 'Nunca';
    try {
      return new Date(data).toLocaleString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  return (
    <Row>
      <Col md={12} className="mb-3">
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
  );
}

export default StatusDetalhesSincronizacao;








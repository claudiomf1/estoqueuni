import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { useTenant } from '../context/TenantContext';

export default function Produtos() {
  const { tenantId } = useTenant();

  return (
    <Container>
      <Row className="mb-4">
        <Col>
          <h1>Listagem de Produtos</h1>
          <p className="text-muted">Visualize e gerencie seus produtos</p>
        </Col>
      </Row>

      <Row>
        <Col>
          <div className="alert alert-info">
            <h5>Página em desenvolvimento</h5>
            <p>
              Esta página será implementada para listar produtos com estoque unificado.
            </p>
            <p>
              <strong>Tenant ID:</strong> {tenantId}
            </p>
          </div>
        </Col>
      </Row>
    </Container>
  );
}















import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTenant } from '../context/TenantContext';

export default function Home() {
  const { tenantId } = useTenant();

  return (
    <Container>
      <Row className="mb-4">
        <Col>
          <h1>Dashboard - EstoqueUni</h1>
          <p className="text-muted">Bem-vindo ao sistema de controle de estoque unificado</p>
        </Col>
      </Row>

      <Row>
        <Col md={4} className="mb-3">
          <Card>
            <Card.Body>
              <Card.Title>Contas Bling</Card.Title>
              <Card.Text>
                Gerencie suas contas Bling conectadas
              </Card.Text>
              <Link to="/contas-bling" className="btn btn-primary">
                Ver contas
              </Link>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4} className="mb-3">
          <Card>
            <Card.Body>
              <Card.Title>Sincronização de Estoque</Card.Title>
              <Card.Text>
                Sincronize e visualize o estoque unificado
              </Card.Text>
              <Link to="/estoque" className="btn btn-primary">
                Ver estoque
              </Link>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4} className="mb-3">
          <Card>
            <Card.Body>
              <Card.Title>Produtos</Card.Title>
              <Card.Text>
                Visualize e gerencie seus produtos
              </Card.Text>
              <Link to="/produtos" className="btn btn-primary">
                Ver produtos
              </Link>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mt-4">
        <Col>
          <Card>
            <Card.Body>
              <Card.Title>Informações do Sistema</Card.Title>
              <Card.Text>
                <strong>Tenant ID:</strong> {tenantId}
              </Card.Text>
              <Card.Text className="text-muted">
                Este sistema permite gerenciar estoque de múltiplas contas Bling de forma unificada.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}


import React from 'react';
import { Container } from 'react-bootstrap';
import { useTenant } from '../context/TenantContext';
import SincronizacaoEstoque from '../components/SincronizacaoEstoque';

export default function Estoque() {
  const { tenantId } = useTenant();

  return (
    <Container className="mt-4">
      <h1>Sincronização de Estoque</h1>
      <p className="text-muted mb-4">Sincronize e visualize o estoque unificado de todas as contas Bling</p>
      <SincronizacaoEstoque tenantId={tenantId} />
    </Container>
  );
}


import React from 'react';
import { Container } from 'react-bootstrap';
import { useTenant } from '../context/TenantContext';
import BlingMultiAccountManager from '../components/BlingMultiAccountManager';

export default function ContasBling() {
  const { tenantId } = useTenant();

  return (
    <Container className="mt-4">
      <h1>Gerenciamento de Contas Bling</h1>
      <p className="text-muted mb-4">Gerencie suas contas Bling conectadas</p>
      <BlingMultiAccountManager tenantId={tenantId} />
    </Container>
  );
}


import React, { useState } from 'react';
import { Button, Container, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useTenant } from '../context/TenantContext';
import BlingMultiAccountManager from '../components/BlingMultiAccountManager';
import WizardAssistenteAplicativo from '../components/Bling/WizardAssistenteAplicativo';

export default function ContasBling() {
  const { tenantId } = useTenant();
  const [mostrarWizard, setMostrarWizard] = useState(false);
  const [wizardConcluido, setWizardConcluido] = useState(false);

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div>
          <h1>Gerenciamento de Contas Bling</h1>
          <p className="text-muted mb-0">Gerencie suas contas Bling conectadas</p>
        </div>
        <OverlayTrigger
          placement="bottom"
          overlay={
            <Tooltip id="tooltip-assistente-app">
              Configure o aplicativo, escopos e webhooks no Bling passo a passo.
            </Tooltip>
          }
        >
          <Button
            variant={wizardConcluido ? 'primary' : 'warning'}
            onClick={() => setMostrarWizard(true)}
            className={wizardConcluido ? '' : 'pulsing-button'}
          >
            📘 Assistente: criar aplicativo Bling
          </Button>
        </OverlayTrigger>
      </div>
      <p className="text-muted mb-4">
        Use o assistente para conferir os passos de criação do aplicativo e dos escopos antes de conectar contas.
      </p>
      <WizardAssistenteAplicativo
        mostrar={mostrarWizard}
        onFechar={() => setMostrarWizard(false)}
        onConcluir={() => setWizardConcluido(true)}
        tenantId={tenantId}
      />
      <BlingMultiAccountManager tenantId={tenantId} />
    </Container>
  );
}

import React from 'react';
import { Alert, Card, Button } from 'react-bootstrap';
import { CheckCircle, Clipboard } from 'react-bootstrap-icons';

/**
 * Passo 2: Copiar URL do webhook
 */
function Passo2CopiarUrl({ urlWebhook, urlCopiada, onCopiarUrl }) {
  return (
    <div>
      <h5 className="mb-3">🔗 Passo 1: Copiar a URL para Receber Notificações</h5>
      <Alert variant="warning" className="mb-3">
        <strong>Você vai precisar desta URL no próximo passo!</strong>
        <br />
        Clique no botão "Copiar URL" abaixo e guarde-a.
      </Alert>
      <Card className="mb-3">
        <Card.Body>
          <div className="d-flex align-items-center justify-content-between">
            <div className="flex-grow-1 me-3">
              <small className="text-muted d-block mb-1">URL para Receber Notificações:</small>
              <code className="text-break">{urlWebhook}</code>
            </div>
            <Button
              variant={urlCopiada ? "success" : "primary"}
              onClick={onCopiarUrl}
              size="sm"
            >
              {urlCopiada ? (
                <>
                  <CheckCircle className="me-1" />
                  Copiado!
                </>
              ) : (
                <>
                  <Clipboard className="me-1" />
                  Copiar URL
                </>
              )}
            </Button>
          </div>
        </Card.Body>
      </Card>
      {urlCopiada && (
        <Alert variant="success" className="mb-0">
          ✅ URL copiada! Agora você pode colar no Bling no próximo passo.
        </Alert>
      )}
    </div>
  );
}

export default Passo2CopiarUrl;

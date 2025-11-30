import React from 'react';
import { Alert, Card, Button, ListGroup } from 'react-bootstrap';
import { CheckCircle } from 'react-bootstrap-icons';

/**
 * Passo 4: Configurar servidor no Bling
 */
function Passo4ConfigurarServidor({ 
  urlWebhook, 
  servidorConfigurado, 
  onServidorConfigurado,
  contaAtual
}) {
  return (
    <div>
      <h5 className="mb-3">⚙️ Passo 3: Configurar Servidor no Bling</h5>
      <Alert variant="info" className="mb-3">
        Na aba do Bling que você abriu, encontre a seção <strong>"Configuração de servidores"</strong>
      </Alert>
      <Card className="mb-3">
        <Card.Body>
          <h6>Faça o seguinte:</h6>
          <ListGroup variant="flush">
            <ListGroup.Item>
              1️⃣ No campo <strong>"Alias *"</strong>, digite: <code>EstoqueUni</code>
            </ListGroup.Item>
            <ListGroup.Item>
              2️⃣ No campo <strong>"URL *"</strong>, cole a URL que você copiou:
              <br />
              <code className="small">{urlWebhook}</code>
            </ListGroup.Item>
            <ListGroup.Item>
              3️⃣ Clique no botão verde <strong>"+ Adicionar servidor"</strong>
            </ListGroup.Item>
            <ListGroup.Item>
              4️⃣ Aguarde a confirmação de que o servidor foi adicionado
            </ListGroup.Item>
          </ListGroup>
        </Card.Body>
      </Card>
      <div className="d-flex justify-content-center">
        <Button
          variant="outline-success"
          onClick={onServidorConfigurado}
        >
          <CheckCircle className="me-2" />
          Já configurei o servidor
        </Button>
      </div>
      {servidorConfigurado && (
        <Alert variant="success" className="mt-3 mb-0">
          ✅ Ótimo! Servidor configurado. Vamos para o próximo passo!
        </Alert>
      )}
    </div>
  );
}

export default Passo4ConfigurarServidor;

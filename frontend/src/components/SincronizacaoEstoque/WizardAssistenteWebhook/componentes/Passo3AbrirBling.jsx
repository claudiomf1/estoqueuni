import React from 'react';
import { Alert, Card, Button, ListGroup } from 'react-bootstrap';
import { Link45deg } from 'react-bootstrap-icons';

/**
 * Passo 3: Abrir página do Bling
 */
function Passo3AbrirBling({ 
  urlBlingWebhooks, 
  urlBlingAberta, 
  onAbrirBling,
  contasBlingAtivas,
  contaAtual
}) {
  return (
    <div>
      <h5 className="mb-3">🌐 Passo 2: Abrir a Tela de Notificações do Bling</h5>
      <Alert variant="info" className="mb-3">
        Vamos abrir a página de cadastro de aplicativos do Bling em uma nova aba.
        <br />
        <strong>Não feche esta janela!</strong> Vamos continuar juntos depois.
        <br />
        <br />
        <strong>💡 Importante:</strong> Se você não estiver logado no Bling, será redirecionado para a página de login.
        Faça login e depois continue com os próximos passos.
      </Alert>
      
      <Alert variant="warning" className="mb-3">
        <strong>⚠️ ATENÇÃO - Passo Adicional Necessário:</strong>
        <br />
        Após abrir o Bling, você precisará:
        <ol className="mb-0 mt-2">
          <li>Na página que abrir, procure o <strong>menu lateral esquerdo</strong></li>
          <li>Clique na opção <strong>"Webhooks"</strong> (terceira opção no menu)</li>
          <li>Você verá as seções: "Configuração de servidores" e "Configuração de webhooks"</li>
        </ol>
      </Alert>
      
      {contasBlingAtivas.length > 1 && (
        <Alert variant="warning" className="mb-3">
          <strong>⚠️ ATENÇÃO - Múltiplas Contas Bling:</strong>
          <br />
          Você tem <strong>{contasBlingAtivas.length} contas Bling</strong> conectadas ao EstoqueUni:
          <ul className="mb-0 mt-2">
            {contasBlingAtivas.map((conta, idx) => (
              <li key={idx}><strong>{conta.accountName}</strong></li>
            ))}
          </ul>
          <br />
          <strong>Você precisa configurar as notificações automáticas (webhooks) em CADA uma dessas contas!</strong>
          <br />
          Repita este processo para cada conta Bling após concluir esta configuração.
        </Alert>
      )}
      <Card className="mb-3">
        <Card.Body>
          <div className="text-center">
            <Button
              variant="primary"
              size="lg"
              onClick={onAbrirBling}
              className="mb-3"
            >
              <Link45deg className="me-2" />
              Abrir Bling em Nova Aba
            </Button>
            <div>
              <small className="text-muted">
                URL: <code>{urlBlingWebhooks}</code>
              </small>
            </div>
          </div>
        </Card.Body>
      </Card>
      
      <Card className="mb-3">
        <Card.Body>
          <h6 className="mb-3">📋 Passos após abrir o Bling:</h6>
          <ListGroup variant="flush">
            <ListGroup.Item>
              <strong>1.</strong> A página do Bling abrirá mostrando "Dados básicos"
            </ListGroup.Item>
            <ListGroup.Item>
              <strong>2.</strong> No <strong>menu lateral esquerdo</strong>, procure a opção <strong>"Webhooks"</strong>
            </ListGroup.Item>
            <ListGroup.Item>
              <strong>3.</strong> Clique em <strong>"Webhooks"</strong> para acessar a configuração
            </ListGroup.Item>
            <ListGroup.Item>
              <strong>4.</strong> Você verá duas seções: "Configuração de servidores" e "Configuração de webhooks"
            </ListGroup.Item>
            <ListGroup.Item>
              <strong>5.</strong> Continue com o próximo passo do wizard para configurar o servidor
            </ListGroup.Item>
          </ListGroup>
        </Card.Body>
      </Card>
      
      {urlBlingAberta && (
        <Alert variant="success" className="mb-0">
          ✅ Página do Bling aberta! 
          <br />
          <strong>Lembre-se:</strong> Clique em "Webhooks" no menu lateral esquerdo para acessar a configuração.
          Depois continue com o próximo passo do wizard.
        </Alert>
      )}
    </div>
  );
}

export default Passo3AbrirBling;

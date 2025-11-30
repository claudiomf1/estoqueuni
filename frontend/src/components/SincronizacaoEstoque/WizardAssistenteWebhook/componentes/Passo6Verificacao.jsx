import React from 'react';
import { Alert, Card, ListGroup } from 'react-bootstrap';
import { CheckCircle, InfoCircle } from 'react-bootstrap-icons';

/**
 * Passo 6: Verificação final
 */
function Passo6Verificacao({
  webhookFuncionandoFinal,
  ultimaRequisicao,
  contasBlingAtivas,
  contaAtual
}) {
  return (
    <div>
      <h5 className="mb-3">✅ Passo 5: Verificar se Está Funcionando</h5>
      
      {webhookFuncionandoFinal ? (
        <Alert variant="success" className="mb-3">
          <CheckCircle className="me-2" size={24} />
          <strong>Notificações automáticas funcionando perfeitamente! 🎉</strong>
          <br />
          Última requisição recebida: {new Date(ultimaRequisicao).toLocaleString('pt-BR')}
        </Alert>
      ) : (
        <Alert variant="warning" className="mb-3">
          <InfoCircle className="me-2" />
          <strong>Aguardando primeira requisição...</strong>
          <br />
          <small>
            Para testar, crie um pedido de venda, altere um produto ou modifique um estoque no Bling.
            As notificações serão enviadas automaticamente quando houver qualquer um desses eventos.
          </small>
        </Alert>
      )}

      <Card>
        <Card.Body>
          <h6>O que acontece agora?</h6>
          <ListGroup variant="flush">
            <ListGroup.Item>
              ✅ O EstoqueUni está configurado para receber notificações
            </ListGroup.Item>
            <ListGroup.Item>
              ✅ Quando uma venda for realizada no Bling, você será notificado automaticamente
            </ListGroup.Item>
            <ListGroup.Item>
              ✅ Quando houver mudanças de estoque ou produtos, você será notificado
            </ListGroup.Item>
            <ListGroup.Item>
              ✅ Os depósitos compartilhados serão atualizados automaticamente
            </ListGroup.Item>
          </ListGroup>
        </Card.Body>
      </Card>

      {contasBlingAtivas.length > 1 && (
        <Alert variant="warning" className="mt-3 mb-3">
          <strong>⚠️ IMPORTANTE - Configuração para Múltiplas Contas:</strong>
          <br />
          Você configurou as notificações automáticas (webhooks) para <strong>1 conta</strong>, mas tem <strong>{contasBlingAtivas.length} contas Bling</strong> conectadas.
          <br />
          <br />
          <strong>Você precisa:</strong>
          <ol className="mb-0 mt-2">
            <li>Repetir este processo para cada conta Bling restante</li>
            <li>Acessar cada conta no Bling separadamente</li>
            <li>Configurar os mesmos 3 tipos de notificações automáticas (webhooks) em cada conta</li>
          </ol>
          <br />
          <strong>Contas que ainda precisam ser configuradas:</strong>
          <ul className="mb-0 mt-2">
            {contasBlingAtivas.slice(1).map((conta, idx) => (
              <li key={idx}><strong>{conta.accountName}</strong></li>
            ))}
          </ul>
        </Alert>
      )}

      {!webhookFuncionandoFinal && (
        <Alert variant="info" className="mt-3 mb-0">
          <strong>💡 Dica:</strong> Você pode verificar o status das notificações automáticas na seção
          "Configuração de Notificações Automáticas (Webhook)" do EstoqueUni. A "Última requisição registrada" será
          atualizada quando receber a primeira notificação.
          <br />
          <br />
          Se não receber notificações após alguns minutos, verifique se:
          <ul className="mb-0 mt-2">
            <li>As notificações automáticas (webhooks) estão realmente ativadas no Bling</li>
            {contasBlingAtivas.length > 1 && (
              <li>Você configurou para todas as {contasBlingAtivas.length} contas Bling</li>
            )}
            <li>Há produtos/estoques sendo modificados no Bling para disparar as notificações</li>
          </ul>
        </Alert>
      )}
    </div>
  );
}

export default Passo6Verificacao;

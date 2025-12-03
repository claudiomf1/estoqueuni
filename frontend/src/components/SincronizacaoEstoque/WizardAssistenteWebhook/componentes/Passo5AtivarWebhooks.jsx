import React from 'react';
import { Alert, Card, Button, ListGroup } from 'react-bootstrap';
import { CheckCircle } from 'react-bootstrap-icons';

/**
 * Passo 5: Ativar webhooks no Bling
 */
function Passo5AtivarWebhooks({
  contasBlingAtivas,
  pedidosVendasAtivado,
  produtosAtivado,
  estoquesAtivado,
  onPedidosVendasAtivado,
  onProdutosAtivado,
  onEstoquesAtivado,
  contaAtual
}) {
  return (
    <div>
      <h5 className="mb-3">🔔 Passo 4: Ativar Notificações Automáticas Necessárias</h5>
      
      {contasBlingAtivas.length > 1 && (
        <Alert variant="warning" className="mb-3">
          <strong>⚠️ LEMBRE-SE:</strong> Você tem <strong>{contasBlingAtivas.length} contas Bling</strong> conectadas.
          <br />
          Você precisa fazer esta configuração para <strong>TODAS as contas</strong>:
          <ul className="mb-0 mt-2">
            {contasBlingAtivas.map((conta, idx) => (
              <li key={idx}><strong>{conta.accountName}</strong></li>
            ))}
          </ul>
          <br />
          Configure para a conta atual primeiro, depois repita para as outras contas.
        </Alert>
      )}
      
      <Alert variant="info" className="mb-3">
        Ainda na aba do Bling, encontre a seção <strong>"Configuração de webhooks"</strong>
        <br />
        Você precisa ativar <strong>3 tipos de notificações automáticas</strong> para o EstoqueUni funcionar completamente.
      </Alert>
      <Alert variant="light" className="mb-3 border">
        <strong>✅ Permissões necessárias em "Pedidos de Venda":</strong>
        <ul className="mb-0 mt-2">
          <li>Gerenciar Pedidos de Venda (inserir/editar)</li>
          <li>Exclusão de Pedidos de Venda</li>
          <li>Gerenciar situações dos Pedidos de Venda</li>
          <li>Lançar contas em Pedidos de Venda</li>
          <li>Lançar estoque em Pedidos de Venda</li>
        </ul>
        <small className="text-muted">
          Marque estes escopos na tela de permissões do Bling para que os webhooks de venda funcionem corretamente.
        </small>
      </Alert>
      <Card className="mb-3">
        <Card.Body>
          <h6>Ative os seguintes tipos de notificações automáticas (webhooks) na ordem que preferir:</h6>
          
          <div className="mb-3">
            <Alert variant="primary" className="mb-2">
              <strong>1. Pedidos de Vendas</strong> - Notifica quando há uma venda
            </Alert>
            <ListGroup variant="flush" className="ms-3 mb-3">
              <ListGroup.Item>
                • Procure pelo card <strong>"Pedidos de Vendas"</strong>
              </ListGroup.Item>
              <ListGroup.Item>
                • Clique no <strong>toggle</strong> para ativar
              </ListGroup.Item>
              <ListGroup.Item>
                • Selecione o servidor <code>EstoqueUni</code> se aparecer um modal
              </ListGroup.Item>
            </ListGroup>
            <div className="text-center">
              <Button
                variant={pedidosVendasAtivado ? "success" : "outline-success"}
                size="sm"
                onClick={onPedidosVendasAtivado}
                className="w-100"
              >
                {pedidosVendasAtivado ? (
                  <>
                    <CheckCircle className="me-2" />
                    Pedidos de Vendas Ativado ✓
                  </>
                ) : (
                  <>
                    <CheckCircle className="me-2" />
                    Marcar como Ativado
                  </>
                )}
              </Button>
            </div>
          </div>

          <hr />

          <div className="mb-3">
            <Alert variant="primary" className="mb-2">
              <strong>2. Produtos</strong> - Notifica quando produtos são criados/atualizados
            </Alert>
            <ListGroup variant="flush" className="ms-3 mb-3">
              <ListGroup.Item>
                • Procure pelo card <strong>"Produtos"</strong>
              </ListGroup.Item>
              <ListGroup.Item>
                • Clique no <strong>toggle</strong> para ativar
              </ListGroup.Item>
              <ListGroup.Item>
                • Selecione o servidor <code>EstoqueUni</code> se aparecer um modal
              </ListGroup.Item>
            </ListGroup>
            <div className="text-center">
              <Button
                variant={produtosAtivado ? "success" : "outline-success"}
                size="sm"
                onClick={onProdutosAtivado}
                className="w-100"
              >
                {produtosAtivado ? (
                  <>
                    <CheckCircle className="me-2" />
                    Produtos Ativado ✓
                  </>
                ) : (
                  <>
                    <CheckCircle className="me-2" />
                    Marcar como Ativado
                  </>
                )}
              </Button>
            </div>
          </div>

          <hr />

          <div className="mb-3">
            <Alert variant="primary" className="mb-2">
              <strong>3. Estoques</strong> - Notifica quando há mudanças de estoque
            </Alert>
            <ListGroup variant="flush" className="ms-3 mb-3">
              <ListGroup.Item>
                • Procure pelo card <strong>"Estoques"</strong>
              </ListGroup.Item>
              <ListGroup.Item>
                • Clique no <strong>toggle</strong> para ativar
              </ListGroup.Item>
              <ListGroup.Item>
                • Selecione o servidor <code>EstoqueUni</code> se aparecer um modal
              </ListGroup.Item>
            </ListGroup>
            <div className="text-center">
              <Button
                variant={estoquesAtivado ? "success" : "outline-success"}
                size="sm"
                onClick={onEstoquesAtivado}
                className="w-100"
              >
                {estoquesAtivado ? (
                  <>
                    <CheckCircle className="me-2" />
                    Estoques Ativado ✓
                  </>
                ) : (
                  <>
                    <CheckCircle className="me-2" />
                    Marcar como Ativado
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {(pedidosVendasAtivado && produtosAtivado && estoquesAtivado) && (
        <Alert variant="success" className="mb-0">
          ✅ Perfeito! Todas as notificações automáticas foram marcadas como ativadas. Vamos verificar se está funcionando!
        </Alert>
      )}

      {!(pedidosVendasAtivado && produtosAtivado && estoquesAtivado) && (
        <Alert variant="warning" className="mb-0">
          ⚠️ <strong>Lembre-se:</strong> Você precisa ativar todos os 3 tipos de notificações automáticas (webhooks) no Bling para o EstoqueUni funcionar completamente.
          Marque cada um como concluído após ativá-lo no Bling.
        </Alert>
      )}
    </div>
  );
}

export default Passo5AtivarWebhooks;

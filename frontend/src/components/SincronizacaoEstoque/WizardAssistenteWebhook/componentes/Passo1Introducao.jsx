import React from 'react';
import { Alert, ListGroup } from 'react-bootstrap';
import { CheckCircle, InfoCircle } from 'react-bootstrap-icons';

/**
 * Passo 1: Introdução ao wizard
 */
function Passo1Introducao({ contasBlingAtivas, contaSelecionada, contaAtual }) {
  return (
    <div>
      <h5 className="mb-3">📋 O que este assistente faz?</h5>
      <Alert variant="info">
        <InfoCircle className="me-2" />
        Este assistente vai guiá-lo passo a passo para configurar as notificações automáticas (webhooks) do Bling.
        <br />
        <strong>Importante:</strong> O Bling não permite automatizar isso via API,
        então você precisará fazer alguns passos manualmente, mas estaremos juntos! 😊
      </Alert>
      
      {contaAtual && (
        <Alert variant="primary" className="mt-3">
          <strong>📌 Conta Bling Selecionada:</strong> {contaAtual.accountName || contaAtual.store_name || 'Conta sem nome'}
          {contaAtual.webhookConfigurado && (
            <span className="ms-2 text-success">(✓ Já configurada anteriormente)</span>
          )}
        </Alert>
      )}
      
      {contasBlingAtivas.length > 1 && (
        <Alert variant="warning" className="mt-3">
          <strong>⚠️ ATENÇÃO - Múltiplas Contas Bling:</strong>
          <br />
          Você tem <strong>{contasBlingAtivas.length} contas Bling</strong> conectadas ao EstoqueUni.
          <br />
          Você precisará configurar as notificações automáticas (webhooks) <strong>para cada uma dessas contas separadamente</strong>.
          <br />
          <br />
          Este assistente vai guiá-lo para configurar uma conta por vez.
          Após concluir, você poderá repetir o processo para as outras contas.
        </Alert>
      )}
      <ListGroup className="mb-3">
        <ListGroup.Item>
          <CheckCircle className="text-success me-2" />
          Você vai configurar um servidor no Bling
        </ListGroup.Item>
        <ListGroup.Item>
          <CheckCircle className="text-success me-2" />
          Vai ativar 3 tipos de notificações automáticas: <strong>Pedidos de Vendas</strong>, <strong>Produtos</strong> e <strong>Estoques</strong>
        </ListGroup.Item>
        <ListGroup.Item>
          <CheckCircle className="text-success me-2" />
          O EstoqueUni será notificado automaticamente quando houver vendas ou mudanças de estoque
        </ListGroup.Item>
      </ListGroup>
    </div>
  );
}

export default Passo1Introducao;

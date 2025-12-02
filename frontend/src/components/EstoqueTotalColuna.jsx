// frontend/src/components/EstoqueTotalColuna.jsx
import { Badge } from 'react-bootstrap';
import './EstoqueTotalColuna.css';

/**
 * Componente para renderizar a coluna "Estoque Total"
 * Mostra o estoque por conta e o total em verde abaixo
 */
function EstoqueTotalColuna({ produto, mapaNomesContas }) {
  // Extrair estoque por conta
  const estoquePorConta = produto.estoquePorConta instanceof Map
    ? Object.fromEntries(produto.estoquePorConta)
    : produto.estoquePorConta || {};

  // Calcular total
  const estoqueTotal = produto.estoque !== undefined && produto.estoque !== null
    ? produto.estoque
    : Object.values(estoquePorConta).reduce((sum, val) => sum + (Number(val) || 0), 0);

  // Obter entradas de estoque por conta
  const entradasEstoque = Object.entries(estoquePorConta);

  return (
    <div className="estoque-total-coluna">
      {/* Estoque por conta */}
      {entradasEstoque.length > 0 ? (
        <div className="estoque-por-conta-lista">
          {entradasEstoque.map(([blingAccountId, quantidade]) => {
            const nomeConta = mapaNomesContas[blingAccountId] || blingAccountId;
            const valorEstoque = Number(quantidade) || 0;
            
            return (
              <div key={blingAccountId} className="conta-estoque-linha">
                <span className="nome-conta">{nomeConta}</span>
                <span className="valor-estoque">{valorEstoque}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-muted small">Sem estoque</div>
      )}

      {/* Total em verde */}
      <div className="estoque-total-badge">
        <Badge bg={estoqueTotal > 0 ? "success" : "secondary"}>
          {estoqueTotal}
        </Badge>
      </div>
    </div>
  );
}

export default EstoqueTotalColuna;








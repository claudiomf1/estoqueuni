import React, { useState } from 'react';
import { Card, Form, Button, Alert, Spinner, ProgressBar } from 'react-bootstrap';
import { ArrowRepeat, Search } from 'react-bootstrap-icons';
import { sincronizacaoApi } from '../../services/sincronizacaoApi';

export default function SincronizacaoManual({ tenantId, onSincronizacaoCompleta }) {
  const [sku, setSku] = useState('');
  const [sincronizandoTodos, setSincronizandoTodos] = useState(false);
  const [sincronizandoProduto, setSincronizandoProduto] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [mensagem, setMensagem] = useState(null);
  const [erro, setErro] = useState(null);

  const handleSincronizarTodos = async () => {
    setErro(null);
    setMensagem(null);
    setProgresso(0);
    setSincronizandoTodos(true);

    try {
      // Por enquanto, sincronização de todos os produtos será implementada depois
      // Por enquanto mostra mensagem informativa
      setMensagem('Sincronização de todos os produtos será implementada em breve. Use a sincronização por produto específico.');
      setProgresso(100);
      if (onSincronizacaoCompleta) {
        onSincronizacaoCompleta();
      }
    } catch (err) {
      setErro(err.mensagem || err.message || 'Erro ao sincronizar todos os produtos');
    } finally {
      setSincronizandoTodos(false);
      setTimeout(() => {
        setMensagem(null);
        setErro(null);
        setProgresso(0);
      }, 7000);
    }
  };

  const handleSincronizarProduto = async () => {
    if (!sku || !sku.trim()) {
      setErro('Por favor, informe o SKU ou ID do produto.');
      return;
    }

    setErro(null);
    setMensagem(null);
    setProgresso(0);
    setSincronizandoProduto(true);

    try {
      const response = await sincronizacaoApi.sincronizarManual(tenantId, sku.trim());
      
      if (response.data?.success !== false) {
        setProgresso(100);
        const resultado = response.data?.data || {};
        const saldos = resultado.saldosArray || [];
        const soma = resultado.soma || 0;
        const compartilhadosAtualizados = resultado.compartilhadosAtualizados || {};
        
        let detalhes = `Soma: ${soma} unidades. `;
        if (saldos.length > 0) {
          detalhes += `Depósitos principais: ${saldos.map(s => `${s.nomeDeposito || s.depositoId}: ${s.valor}`).join(', ')}. `;
        }
        if (Object.keys(compartilhadosAtualizados).length > 0) {
          const sucessos = Object.values(compartilhadosAtualizados).filter(c => c.sucesso).length;
          detalhes += `Atualizados ${sucessos} depósito(s) compartilhado(s).`;
        }
        
        setMensagem(`Produto ${sku} sincronizado com sucesso! ${detalhes}`);
        setSku('');
        if (onSincronizacaoCompleta) {
          onSincronizacaoCompleta();
        }
      } else {
        throw new Error(response.data?.message || 'Erro ao sincronizar produto');
      }
    } catch (err) {
      setErro(err.mensagem || err.message || `Erro ao sincronizar produto ${sku}`);
    } finally {
      setSincronizandoProduto(false);
      setTimeout(() => {
        setMensagem(null);
        setErro(null);
        setProgresso(0);
      }, 8000);
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header>
        <div className="d-flex align-items-center">
          <ArrowRepeat className="me-2" />
          <h5 className="mb-0">Sincronização Manual</h5>
        </div>
      </Card.Header>
      <Card.Body>
        <div className="row">
          <div className="col-md-6 mb-3">
            <h6>Sincronizar Todos os Produtos</h6>
            <p className="text-muted small">
              Sincroniza o estoque de todos os produtos de uma vez.
            </p>
            <Button
              variant="primary"
              onClick={handleSincronizarTodos}
              disabled={sincronizandoTodos || sincronizandoProduto}
              className="w-100"
            >
              {sincronizandoTodos ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-2" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <ArrowRepeat className="me-2" />
                  Sincronizar Todos
                </>
              )}
            </Button>
          </div>

          <div className="col-md-6 mb-3">
            <h6>Sincronizar Produto Específico</h6>
            <p className="text-muted small">
              Sincroniza o estoque de um produto específico pelo SKU.
            </p>
            <Form.Group className="mb-2">
              <div className="input-group">
                <Form.Control
                  type="text"
                  placeholder="Digite o SKU do produto"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  disabled={sincronizandoTodos || sincronizandoProduto}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !sincronizandoProduto) {
                      handleSincronizarProduto();
                    }
                  }}
                />
                <Button
                  variant="success"
                  onClick={handleSincronizarProduto}
                  disabled={sincronizandoTodos || sincronizandoProduto || !sku.trim()}
                >
                  {sincronizandoProduto ? (
                    <Spinner as="span" animation="border" size="sm" />
                  ) : (
                    <Search />
                  )}
                </Button>
              </div>
            </Form.Group>
          </div>
        </div>

        {(sincronizandoTodos || sincronizandoProduto) && (
          <div className="mt-3">
            <ProgressBar
              now={progresso}
              label={`${progresso}%`}
              animated
              striped
            />
          </div>
        )}

        {erro && (
          <Alert variant="danger" className="mt-3" dismissible onClose={() => setErro(null)}>
            {erro}
          </Alert>
        )}

        {mensagem && (
          <Alert variant="success" className="mt-3" dismissible onClose={() => setMensagem(null)}>
            {mensagem}
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
}



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
        
        // Verificar se houve falhas na sincronização
        const compartilhadosArray = Object.values(compartilhadosAtualizados);
        const sucessos = compartilhadosArray.filter(c => c.sucesso);
        const falhas = compartilhadosArray.filter(c => !c.sucesso);
        
        let detalhes = `Soma calculada: ${soma} unidades. `;
        if (saldos.length > 0) {
          detalhes += `Depósitos principais: ${saldos.map(s => `${s.nomeDeposito || s.depositoId}: ${s.valor}`).join(', ')}. `;
        }
        
        if (compartilhadosArray.length > 0) {
          if (sucessos.length > 0) {
            detalhes += `✅ ${sucessos.length} depósito(s) compartilhado(s) atualizado(s) com sucesso: ${sucessos.map(s => s.nomeDeposito || s.depositoId).join(', ')}. `;
          }
          
          if (falhas.length > 0) {
            detalhes += `❌ ${falhas.length} depósito(s) falharam: ${falhas.map(f => `${f.nomeDeposito || f.depositoId} (${f.erro || 'Erro desconhecido'})`).join(', ')}.`;
            setErro(
              <div>
                <strong>⚠️ Alguns depósitos falharam ao atualizar</strong>
                <ul className="mb-0 mt-2">
                  {falhas.map((f, idx) => (
                    <li key={idx}>
                      <strong>{f.nomeDeposito || f.depositoId}:</strong> {f.erro || 'Erro desconhecido'}
                    </li>
                  ))}
                </ul>
                <small className="text-muted">Verifique os logs do servidor para mais detalhes.</small>
              </div>
            );
          }
        }
        
        if (falhas.length === 0) {
          setMensagem(
            <div>
              <strong>✅ Produto {sku} sincronizado com sucesso!</strong>
              <br />
              <small>{detalhes}</small>
            </div>
          );
        } else {
          setMensagem(
            <div>
              <strong>⚠️ Sincronização parcial do produto {sku}</strong>
              <br />
              <small>{detalhes}</small>
            </div>
          );
        }
        
        setSku('');
        if (onSincronizacaoCompleta) {
          onSincronizacaoCompleta();
        }
      } else {
        // Verificar se é erro de produto composto
        if (response.data?.codigoErro === 'PRODUTO_COMPOSTO_NAO_SUPORTADO' || 
            response.data?.error === 'PRODUTO_COMPOSTO') {
          setErro(
            <div>
              <strong>⚠️ Produto Composto Detectado</strong>
              <br />
              {response.data?.message || 'Este produto é um produto composto (com composição).'}
              <br />
              <small className="text-muted">
                Produtos compostos não suportam sincronização de estoque via API do Bling. 
                Use apenas produtos simples para sincronização.
              </small>
            </div>
          );
        } else {
          throw new Error(response.data?.message || 'Erro ao sincronizar produto');
        }
      }
    } catch (err) {
      // Tratamento específico para produtos compostos
      const errorData = err.response?.data;
      if (errorData?.codigoErro === 'PRODUTO_COMPOSTO_NAO_SUPORTADO' || 
          errorData?.error === 'PRODUTO_COMPOSTO' ||
          (err.message && err.message.includes('produto composto'))) {
        setErro(
          <div>
            <strong>⚠️ Produto Composto Detectado</strong>
            <br />
            {errorData?.message || err.message || 'Este produto é um produto composto (com composição).'}
            <br />
            <small className="text-muted">
              Produtos compostos não suportam sincronização de estoque via API do Bling. 
              Use apenas produtos simples para sincronização.
            </small>
          </div>
        );
      } else {
        setErro(err.response?.data?.message || err.mensagem || err.message || `Erro ao sincronizar produto ${sku}`);
      }
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
              Sincroniza o estoque de um produto específico pelo SKU ou ID.
            </p>
            <Alert variant="info" className="small mb-2">
              <strong>ℹ️ Importante:</strong> Apenas produtos simples podem ser sincronizados. 
              Produtos compostos (kits, combos) não são suportados.
            </Alert>
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
          <Alert 
            variant={
              (typeof mensagem === 'string' && (mensagem.includes('❌') || mensagem.includes('⚠️'))) ||
              (typeof mensagem === 'object' && mensagem?.props?.children?.toString().includes('⚠️'))
                ? 'warning' 
                : 'success'
            } 
            className="mt-3" 
            dismissible 
            onClose={() => setMensagem(null)}
          >
            {mensagem}
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
}



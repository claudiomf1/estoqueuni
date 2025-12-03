import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ProgressBar, Alert, ListGroup, Button, Form, Row, Col, Badge, Card, InputGroup } from 'react-bootstrap';
import { CheckCircle } from 'react-bootstrap-icons';
import PropTypes from 'prop-types';

const TOTAL_PASSOS = 6;
// URL correta do painel de aplicativos do Bling
const URL_PORTAL_APPS = 'https://www.bling.com.br/cadastro.aplicativos.php#/list';

const construirRedirectPadrao = () => {
  if (typeof window === 'undefined' || !window.location) {
    return 'https://estoqueuni.com.br/bling/callback';
  }

  try {
    const url = new URL(window.location.origin);
    if (url.hostname === 'www.estoqueuni.com.br') {
      url.hostname = 'estoqueuni.com.br';
    }
    if (url.hostname === 'estoqueuni.com.br') {
      url.protocol = 'https:';
    }
    url.pathname = '/bling/callback';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch (erro) {
    console.warn('Não foi possível normalizar o redirect padrão do Bling:', erro);
    return `${window.location.origin}/bling/callback`;
  }
};

export default function WizardAssistenteAplicativo({ mostrar, onFechar, onConcluir, tenantId }) {
  const [passoAtual, setPassoAtual] = useState(1);
  const [portalAberto, setPortalAberto] = useState(false);
  const [dadosPreenchidos, setDadosPreenchidos] = useState(false);
  const [escoposMarcados, setEscoposMarcados] = useState(false);
  const [credenciaisGuardadas, setCredenciaisGuardadas] = useState(false);
  const [redirectCopiado, setRedirectCopiado] = useState(false);
  const [urlCopiada, setUrlCopiada] = useState(false);
  const [pedidosAtivado, setPedidosAtivado] = useState(false);
  const [produtosAtivado, setProdutosAtivado] = useState(false);
  const [estoquesAtivado, setEstoquesAtivado] = useState(false);

  const redirectPadrao = useMemo(() => construirRedirectPadrao(), []);
  const urlWebhook = useMemo(() => {
    const base =
      import.meta.env.VITE_WEBHOOK_BASE_URL ||
      import.meta.env.VITE_PUBLIC_URL ||
      'https://estoqueuni.com.br';
    const tid = tenantId || 'SEU_TENANT_ID';
    return `${base.replace(/\/$/, '')}/api/webhooks/bling?tenantId=${tid}`;
  }, [tenantId]);

  const progresso = (passoAtual / TOTAL_PASSOS) * 100;

  const copiarRedirect = async () => {
    try {
      await navigator.clipboard.writeText(redirectPadrao);
      setRedirectCopiado(true);
      setTimeout(() => setRedirectCopiado(false), 3000);
    } catch (erro) {
      console.error('Erro ao copiar redirect URI:', erro);
    }
  };

  const copiarUrlWebhook = async () => {
    try {
      await navigator.clipboard.writeText(urlWebhook);
      setUrlCopiada(true);
      setTimeout(() => setUrlCopiada(false), 3000);
    } catch (erro) {
      console.error('Erro ao copiar URL do webhook:', erro);
    }
  };

  const podeAvancar = () => {
    if (passoAtual === 1) return true;
    if (passoAtual === 2) return portalAberto;
    if (passoAtual === 3) return dadosPreenchidos;
    if (passoAtual === 4) return escoposMarcados;
    if (passoAtual === 5) return credenciaisGuardadas;
    if (passoAtual === 6) return pedidosAtivado && produtosAtivado && estoquesAtivado;
    return true;
  };

  const avancar = () => {
    if (!podeAvancar()) return;
    setPassoAtual((atual) => Math.min(atual + 1, TOTAL_PASSOS));
  };

  const voltar = () => {
    setPassoAtual((atual) => Math.max(atual - 1, 1));
  };

  useEffect(() => {
    if (mostrar) {
      setPassoAtual(1);
      setPortalAberto(false);
      setDadosPreenchidos(false);
      setEscoposMarcados(false);
      setCredenciaisGuardadas(false);
      setRedirectCopiado(false);
      setPedidosAtivado(false);
      setProdutosAtivado(false);
      setEstoquesAtivado(false);
    }
  }, [mostrar]);

  const abrirPortalApps = () => {
    // Já libera o próximo passo para evitar bloqueio caso o popup seja barrado
    setPortalAberto(true);
    const janela = window.open(URL_PORTAL_APPS, '_blank', 'noopener,noreferrer');
    if (janela) {
      janela.focus?.();
    } else {
      // fallback mantém a aba atual e abre em nova aba/guia via target _blank
      const novaJanela = window.open(URL_PORTAL_APPS, '_blank');
      novaJanela?.focus?.();
    }
  };

  return (
    <Modal show={mostrar} onHide={onFechar} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Assistente para Criar o Aplicativo no Bling</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-4">
          <div className="d-flex justify-content-between mb-2">
            <small className="text-muted">Passo {passoAtual} de {TOTAL_PASSOS}</small>
            <small className="text-muted">{Math.round(progresso)}% concluído</small>
          </div>
          <ProgressBar now={progresso} variant="info" />
        </div>

        {passoAtual === 1 && (
          <div>
            <h5 className="mb-3">Visão geral</h5>
            <Alert variant="light" className="border">
              Este assistente reúne tudo: criação do aplicativo no Bling, seleção de escopos
              e ativação dos webhooks obrigatórios para o EstoqueUni.
            </Alert>
            <ListGroup className="mb-3">
              <ListGroup.Item>• Abrir o painel de aplicativos do Bling</ListGroup.Item>
              <ListGroup.Item>• Clicar em <strong>Criar Aplicativo</strong> &gt; <strong>Tenha acesso à API v3 do Bling!</strong> &gt; Próximo</ListGroup.Item>
              <ListGroup.Item>• Preencher dados básicos e copiar o Redirect URI</ListGroup.Item>
              <ListGroup.Item>• Selecionar os escopos obrigatórios</ListGroup.Item>
              <ListGroup.Item>• Salvar credenciais</ListGroup.Item>
              <ListGroup.Item>• Ativar os webhooks (Pedidos de Venda, Produtos, Estoques)</ListGroup.Item>
            </ListGroup>
          </div>
        )}

        {passoAtual === 2 && (
          <div>
            <h5 className="mb-3">Abrir painel e iniciar criação</h5>
            <Alert variant="info">
              1) Clique em <strong>Abrir painel</strong> (abrirá em nova aba).<br />
              2) No topo direito, clique no botão verde <strong>“Criar aplicativo”</strong>.<br />
              3) Escolha a opção <strong>“Tenha acesso à API v3 do Bling!”</strong>.<br />
              4) Clique no botão verde <strong>“Próximo”</strong> no canto inferior direito para ir ao formulário.
            </Alert>
            <Button variant="primary" onClick={abrirPortalApps} className="w-100 mb-3">
              Abrir painel de aplicativos do Bling (nova aba)
            </Button>
            {portalAberto && (
              <Alert variant="success" className="mb-0">Painel aberto em nova aba ✓</Alert>
            )}
            <Card className="mt-3">
              <Card.Body>
                <h6 className="mb-2">URL para receber notificações (webhook)</h6>
                <small className="text-muted d-block mb-2">
                  Configure esta URL no Bling para que o EstoqueUni receba avisos de vendas e estoque.
                </small>
                <InputGroup>
                  <Form.Control value={urlWebhook} readOnly />
                  <Button variant={urlCopiada ? 'success' : 'outline-secondary'} onClick={copiarUrlWebhook}>
                    {urlCopiada ? 'Copiado!' : 'Copiar'}
                  </Button>
                </InputGroup>
              </Card.Body>
            </Card>
          </div>
        )}

        {passoAtual === 3 && (
          <div>
            <h5 className="mb-3">Preencher dados básicos</h5>
            <Alert variant="light" className="border">
              Após clicar em “Próximo”, preencha o formulário:
              <ListGroup variant="flush" className="mt-2">
                <ListGroup.Item><strong>Nome:</strong> EstoqueUni</ListGroup.Item>
                <ListGroup.Item><strong>Categoria:</strong> Gestão de estoques</ListGroup.Item>
                <ListGroup.Item>
                  <strong>Descrição curta:</strong> Gestão de estoque entre contas Bling
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>Redirect URI:</strong> {redirectPadrao}{' '}
                  <Button size="sm" variant={redirectCopiado ? 'success' : 'outline-secondary'} className="ms-2" onClick={copiarRedirect}>
                    {redirectCopiado ? 'Copiado!' : 'Copiar'}
                  </Button>
                </ListGroup.Item>
              </ListGroup>
            </Alert>
            <Form.Check
              type="checkbox"
              id="dados-preenchidos"
              label="Já preenchi os dados básicos"
              checked={dadosPreenchidos}
              onChange={(e) => setDadosPreenchidos(e.target.checked)}
            />
          </div>
        )}

        {passoAtual === 4 && (
          <div>
            <h5 className="mb-3">Selecionar escopos obrigatórios</h5>
            <Alert variant="warning">
              Marque os escopos abaixo no Bling para que o EstoqueUni funcione plenamente.
              Priorize <strong>Pedidos de Venda</strong> e <strong>Controle de Estoque</strong>.
            </Alert>
            <Row>
              <Col md={6}>
                <CardEscopo
                  titulo="Controle de Estoque"
                  itens={[
                    'Leitura de estoque',
                    'Atualização de estoque',
                    'Webhooks de estoque'
                  ]}
                />
              </Col>
              <Col md={6}>
                <CardEscopo
                  titulo="Pedidos de Venda (selecione as 5 permissões)"
                  badgeTexto="5 selecionados"
                  itens={[
                    'Gerenciar Pedidos de Venda (inserir/editar)',
                    'Exclusão de Pedidos de Venda',
                    'Gerenciar situações dos Pedidos de Venda',
                    'Lançar contas em Pedidos de Venda',
                    'Lançar estoque em Pedidos de Venda'
                  ]}
                />
              </Col>
            </Row>
            <Form.Check
              className="mt-3"
              type="checkbox"
              id="escopos-selecionados"
              label="Já marquei os escopos necessários"
              checked={escoposMarcados}
              onChange={(e) => setEscoposMarcados(e.target.checked)}
            />
          </div>
        )}

        {passoAtual === 5 && (
          <div>
            <h5 className="mb-3">Salvar e trazer as credenciais para o EstoqueUni</h5>
            <Alert variant="success">
              Após salvar o aplicativo no Bling, copie e guarde:
              <ListGroup variant="flush" className="mt-2">
                <ListGroup.Item>Client ID</ListGroup.Item>
                <ListGroup.Item>Client Secret</ListGroup.Item>
                <ListGroup.Item>Redirect URI (igual ao preenchido)</ListGroup.Item>
              </ListGroup>
              <small className="d-block mt-2 text-muted">
                Você usará esses dados ao adicionar ou editar uma conta Bling no EstoqueUni.
              </small>
            </Alert>
            <Form.Check
              type="checkbox"
              id="credenciais-guardadas"
              label="Já salvei as credenciais"
              checked={credenciaisGuardadas}
              onChange={(e) => setCredenciaisGuardadas(e.target.checked)}
            />
          </div>
        )}

        {passoAtual === 6 && (
          <div>
            <h5 className="mb-3">Ativar notificações automáticas (webhooks)</h5>
            <Alert variant="light" className="border">
              No Bling, abra a seção <strong>Configuração de webhooks</strong> e ative:
              <ListGroup variant="flush" className="mt-2">
                <ListGroup.Item>• Pedidos de Vendas</ListGroup.Item>
                <ListGroup.Item>• Produtos</ListGroup.Item>
                <ListGroup.Item>• Estoques</ListGroup.Item>
              </ListGroup>
              Se aparecer um modal, selecione o servidor <code>EstoqueUni</code>.
            </Alert>
            <Card className="mb-3">
              <Card.Body>
                <h6>Marque quando cada webhook estiver ativado no Bling:</h6>
                <div className="d-grid gap-2">
                  <Button
                    variant={pedidosAtivado ? 'success' : 'outline-success'}
                    onClick={() => setPedidosAtivado(true)}
                  >
                    <CheckCircle className="me-2" />
                    Pedidos de Vendas ativado
                  </Button>
                  <Button
                    variant={produtosAtivado ? 'success' : 'outline-success'}
                    onClick={() => setProdutosAtivado(true)}
                  >
                    <CheckCircle className="me-2" />
                    Produtos ativado
                  </Button>
                  <Button
                    variant={estoquesAtivado ? 'success' : 'outline-success'}
                    onClick={() => setEstoquesAtivado(true)}
                  >
                    <CheckCircle className="me-2" />
                    Estoques ativado
                  </Button>
                </div>
              </Card.Body>
            </Card>
            <Alert variant={pedidosAtivado && produtosAtivado && estoquesAtivado ? 'success' : 'warning'}>
              {pedidosAtivado && produtosAtivado && estoquesAtivado
                ? '✅ Tudo ativado! Pode concluir.'
                : '⚠️ Marque os três webhooks como ativados para concluir.'}
            </Alert>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer className="d-flex justify-content-between">
        <div>
          <Button variant="outline-secondary" onClick={voltar} disabled={passoAtual === 1}>
            Voltar
          </Button>
        </div>
        <div className="d-flex gap-2">
          <Button variant="secondary" onClick={onFechar}>
            Fechar
          </Button>
          {passoAtual < TOTAL_PASSOS && (
            <Button variant="primary" onClick={avancar} disabled={!podeAvancar()}>
              Próximo
            </Button>
          )}
          {passoAtual === TOTAL_PASSOS && (
            <Button
              variant="success"
              onClick={() => {
                if (onConcluir) {
                  onConcluir();
                }
                onFechar();
              }}
              disabled={!podeAvancar()}
            >
              Concluir
            </Button>
          )}
        </div>
      </Modal.Footer>
    </Modal>
  );
}

function CardEscopo({ titulo, itens, badgeTexto }) {
  return (
    <div className="mb-3 border rounded p-3 h-100">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <strong>{titulo}</strong>
        {badgeTexto && <Badge bg="light" text="dark">{badgeTexto}</Badge>}
      </div>
      <ListGroup variant="flush">
        {itens.map((item, idx) => (
          <ListGroup.Item key={idx} className="px-0">
            • {item}
          </ListGroup.Item>
        ))}
      </ListGroup>
    </div>
  );
}

WizardAssistenteAplicativo.propTypes = {
  mostrar: PropTypes.bool,
  onFechar: PropTypes.func,
  onConcluir: PropTypes.func,
  tenantId: PropTypes.string,
};

CardEscopo.propTypes = {
  titulo: PropTypes.string,
  itens: PropTypes.arrayOf(PropTypes.string),
  badgeTexto: PropTypes.string,
};

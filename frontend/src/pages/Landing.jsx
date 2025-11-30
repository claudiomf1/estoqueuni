import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Form, Alert, Modal } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import claudioiaLogo from './claudioia-logo.png';
import './Landing.css';

export default function Landing() {
  const [showLogin, setShowLogin] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [cadastroData, setCadastroData] = useState({
    nome: '',
    email: '',
    usuario: '',
    senha: '',
    confirmarSenha: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, setTenantId, setNivelAcesso } = useContext(AuthContext);
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState(null);
  const [mostrarSenhaLogin, setMostrarSenhaLogin] = useState(false);
  const [mostrarSenhaCadastro, setMostrarSenhaCadastro] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  useEffect(() => {
    carregarLogo();
  }, []);

  const carregarLogo = async () => {
    try {
      console.log('[Landing] Carregando logo...');
      // Não passa tenantId - a rota pública busca qualquer logo configurado
      const response = await fetch('/api/public/landing-config/logo');
      const data = await response.json();
      console.log('[Landing] Resposta da API:', data);
      if (data.success && data.data?.logoUrl) {
        console.log('[Landing] Logo carregado:', data.data.logoUrl);
        setLogoUrl(data.data.logoUrl);
      } else {
        console.log('[Landing] Logo não encontrado ou não configurado');
      }
    } catch (error) {
      console.error('[Landing] Erro ao carregar logo:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: loginData.username.trim(),
          password: loginData.password,
          rota_base: 'estoqueuni',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTenantId(data.user.tenantId);
        const nivelAcesso = data.nivel_acesso || data.user?.nivel_acesso || '';
        if (setNivelAcesso) {
          setNivelAcesso(nivelAcesso);
        }
        login();
        setShowLogin(false);
        
        // Sempre redireciona para o dashboard quando logar pela landing page
        navigate('/');
      } else {
        setErrorMessage(data.message || 'Usuário ou senha inválidos.');
      }
    } catch (error) {
      setErrorMessage('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCadastro = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (cadastroData.senha !== cadastroData.confirmarSenha) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    if (cadastroData.senha.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      // TODO: Implementar endpoint de cadastro
      const response = await fetch('/api/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nome: cadastroData.nome,
          email: cadastroData.email,
          usuario: cadastroData.usuario,
          senha: cadastroData.senha,
          rota_base: 'estoqueuni',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowCadastro(false);
        setShowLogin(true);
        setLoginData({ username: cadastroData.usuario, password: '' });
        setErrorMessage('');
        alert('Cadastro realizado com sucesso! Faça login para continuar.');
      } else {
        setErrorMessage(data.message || 'Erro ao realizar cadastro.');
      }
    } catch (error) {
      setErrorMessage('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <Container>
          <Row className="align-items-center">
            <Col lg={6}>
              <div className="hero-content">
                {logoUrl && (
                  <div className="hero-logo mb-4">
                    <img src={logoUrl} alt="EstoqueUni Logo" className="landing-logo" />
                  </div>
                )}
                <div className="hero-badge">
                  <span>✨ Sincronização Inteligente de Estoques</span>
                </div>
                <h1 className="hero-title">
                  Gerencie seus <span className="gradient-text">estoques compartilhados</span> de forma automática
                </h1>
                <p className="hero-subtitle">
                  EstoqueUni é a solução completa para sincronizar automaticamente estoques entre múltiplas contas Bling,
                  substituindo serviços externos e oferecendo controle total sobre sua operação.
                </p>
                <div className="hero-buttons">
                  <Button
                    variant="primary"
                    size="lg"
                    className="btn-hero-primary"
                    onClick={() => setShowCadastro(true)}
                  >
                    Começar Agora
                  </Button>
                  <Button
                    variant="outline-light"
                    size="lg"
                    className="btn-hero-secondary"
                    onClick={() => setShowLogin(true)}
                  >
                    Fazer Login
                  </Button>
                </div>
                <div className="hero-features">
                  <div className="hero-feature-item">
                    <span className="feature-icon">⚡</span>
                    <span>Sincronização em Tempo Real</span>
                  </div>
                  <div className="hero-feature-item">
                    <span className="feature-icon">🔒</span>
                    <span>100% Seguro e Confiável</span>
                  </div>
                  <div className="hero-feature-item">
                    <span className="feature-icon">💰</span>
                    <span>Sem Custos Adicionais</span>
                  </div>
                </div>
              </div>
            </Col>
            <Col lg={6}>
              <div className="hero-image">
                <div className="hero-image-placeholder">
                  <div className="floating-card card-1">
                    <div className="card-icon">📦</div>
                    <div className="card-text">Estoque W2I</div>
                  </div>
                  <div className="floating-card card-2">
                    <div className="card-icon">📦</div>
                    <div className="card-text">Estoque TechYou</div>
                  </div>
                  <div className="floating-card card-3">
                    <div className="card-icon">🔄</div>
                    <div className="card-text">Sincronização Automática</div>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <Container>
          <div className="section-header">
            <h2 className="section-title">Por que escolher o EstoqueUni?</h2>
            <p className="section-subtitle">
              Solução completa para gerenciamento inteligente de estoques compartilhados
            </p>
          </div>
          <Row>
            <Col md={4} className="mb-4">
              <Card className="feature-card">
                <Card.Body>
                  <div className="feature-icon-large">⚡</div>
                  <h3>Sincronização em Tempo Real</h3>
                  <p>
                    Webhooks garantem atualização instantânea dos estoques compartilhados sempre que houver
                    movimentação nos depósitos principais.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4} className="mb-4">
              <Card className="feature-card">
                <Card.Body>
                  <div className="feature-icon-large">🛡️</div>
                  <h3>Backup Automático</h3>
                  <p>
                    Cronjob de verificação periódica garante que nenhum evento seja perdido, funcionando como
                    rede de segurança.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4} className="mb-4">
              <Card className="feature-card">
                <Card.Body>
                  <div className="feature-icon-large">📊</div>
                  <h3>Monitoramento Completo</h3>
                  <p>
                    Dashboard com logs detalhados, histórico de sincronizações e identificação da origem de cada
                    atualização.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4} className="mb-4">
              <Card className="feature-card">
                <Card.Body>
                  <div className="feature-icon-large">🔗</div>
                  <h3>Múltiplas Contas Bling</h3>
                  <p>
                    Gerencie várias contas Bling simultaneamente, ideal para empresas com múltiplas operações
                    (W2ISHOP, TECHYOU, etc.).
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4} className="mb-4">
              <Card className="feature-card">
                <Card.Body>
                  <div className="feature-icon-large">🚫</div>
                  <h3>Anti-Duplicação</h3>
                  <p>
                    Sistema inteligente evita processar o mesmo evento duas vezes, garantindo eficiência e
                    precisão.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4} className="mb-4">
              <Card className="feature-card">
                <Card.Body>
                  <div className="feature-icon-large">💼</div>
                  <h3>Controle Total</h3>
                  <p>
                    Interface própria para configuração, monitoramento e sincronização manual quando necessário.
                    Sem dependência de serviços externos.
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <Container>
          <div className="section-header">
            <h2 className="section-title">Como Funciona</h2>
            <p className="section-subtitle">
              Processo simples e automatizado para sincronização de estoques
            </p>
          </div>
          <Row>
            <Col md={4} className="mb-4">
              <div className="step-card">
                <div className="step-number">1</div>
                <h3>Conecte suas Contas Bling</h3>
                <p>
                  Configure suas contas Bling (W2ISHOP, TECHYOU) e defina quais depósitos são principais e
                  quais são compartilhados.
                </p>
              </div>
            </Col>
            <Col md={4} className="mb-4">
              <div className="step-card">
                <div className="step-number">2</div>
                <h3>Sincronização Automática</h3>
                <p>
                  O sistema monitora automaticamente os depósitos principais e atualiza os compartilhados em
                  tempo real via webhooks.
                </p>
              </div>
            </Col>
            <Col md={4} className="mb-4">
              <div className="step-card">
                <div className="step-number">3</div>
                <h3>Monitoramento e Controle</h3>
                <p>
                  Acompanhe todas as sincronizações, visualize logs detalhados e tenha controle total sobre
                  sua operação.
                </p>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <Container>
          <div className="cta-content">
            <h2>Pronto para simplificar seu gerenciamento de estoques?</h2>
            <p>Comece agora e tenha controle total sobre seus estoques compartilhados</p>
            <div className="cta-buttons">
              <Button
                variant="light"
                size="lg"
                className="btn-cta-primary"
                onClick={() => setShowCadastro(true)}
              >
                Criar Conta Grátis
              </Button>
              <Button
                variant="outline-light"
                size="lg"
                className="btn-cta-secondary"
                onClick={() => setShowLogin(true)}
              >
                Já tenho conta
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <p className="footer-copyright">
            © {new Date().getFullYear()} EstoqueUni - Todos os direitos reservados
          </p>
          <div className="powered-by">
            <span>Sistema desenvolvido pela</span>
            <a
              href="https://claudioia.com.br"
              target="_blank"
              rel="noopener"
              className="claudioia-link"
              title="ClaudioIA - Plataforma de IA tipo ChatGPT e também desenvolve lojas virtuais e sistemas para e-commerce"
            >
              <img
                src={claudioiaLogo}
                alt="ClaudioIA - Inteligência Artificial Conversacional"
                className="claudioia-logo"
                loading="lazy"
                decoding="async"
              />
              <span>ClaudioIA</span>
            </a>
          </div>
          <p className="claudioia-description">
            A{' '}
            <a
              href="https://claudioia.com.br"
              target="_blank"
              rel="noopener"
              className="claudioia-text-link"
            >
              ClaudioIA
            </a>{' '}
            é uma plataforma de Inteligência Artificial conversacional similar ao ChatGPT, com
            especialistas em diversas áreas. Também desenvolve lojas virtuais e sistemas
            personalizados para e-commerce.
          </p>
        </div>
      </footer>

      {/* Login Modal */}
      <Modal show={showLogin} onHide={() => { setShowLogin(false); setMostrarSenhaLogin(false); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>Fazer Login</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-3">
              <Form.Label>Usuário ou E-mail</Form.Label>
              <Form.Control
                type="text"
                placeholder="Digite seu usuário ou e-mail"
                value={loginData.username}
                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Senha</Form.Label>
              <div className="input-group">
                <Form.Control
                  type={mostrarSenhaLogin ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                />
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => setMostrarSenhaLogin(!mostrarSenhaLogin)}
                >
                  {mostrarSenhaLogin ? '🙈' : '👁️'}
                </Button>
              </div>
            </Form.Group>
            {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
            <Button variant="primary" type="submit" className="w-100" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Cadastro Modal */}
      <Modal show={showCadastro} onHide={() => { setShowCadastro(false); setMostrarSenhaCadastro(false); setMostrarConfirmarSenha(false); }} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Criar Conta</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCadastro}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome Completo</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Seu nome completo"
                    value={cadastroData.nome}
                    onChange={(e) => setCadastroData({ ...cadastroData, nome: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>E-mail</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="seu@email.com"
                    value={cadastroData.email}
                    onChange={(e) => setCadastroData({ ...cadastroData, email: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Nome de Usuário</Form.Label>
              <Form.Control
                type="text"
                placeholder="Escolha um nome de usuário"
                value={cadastroData.usuario}
                onChange={(e) => setCadastroData({ ...cadastroData, usuario: e.target.value })}
                required
              />
            </Form.Group>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Senha</Form.Label>
                  <div className="input-group">
                    <Form.Control
                      type={mostrarSenhaCadastro ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={cadastroData.senha}
                      onChange={(e) => setCadastroData({ ...cadastroData, senha: e.target.value })}
                      required
                      minLength={6}
                    />
                    <Button
                      variant="outline-secondary"
                      type="button"
                      onClick={() => setMostrarSenhaCadastro(!mostrarSenhaCadastro)}
                    >
                      {mostrarSenhaCadastro ? '🙈' : '👁️'}
                    </Button>
                  </div>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Confirmar Senha</Form.Label>
                  <div className="input-group">
                    <Form.Control
                      type={mostrarConfirmarSenha ? 'text' : 'password'}
                      placeholder="Confirme sua senha"
                      value={cadastroData.confirmarSenha}
                      onChange={(e) => setCadastroData({ ...cadastroData, confirmarSenha: e.target.value })}
                      required
                      minLength={6}
                    />
                    <Button
                      variant="outline-secondary"
                      type="button"
                      onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                    >
                      {mostrarConfirmarSenha ? '🙈' : '👁️'}
                    </Button>
                  </div>
                </Form.Group>
              </Col>
            </Row>
            {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
            <Button variant="primary" type="submit" className="w-100" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}


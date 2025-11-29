import { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { PersonFill, LockFill, EyeFill, EyeSlashFill, CheckCircleFill, ShieldFill, LightningChargeFill, BarChartFill } from 'react-bootstrap-icons';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [bannerUrl, setBannerUrl] = useState(null);
  const { login, setTenantId, setNivelAcesso } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    carregarBanner();
  }, []);


  const carregarBanner = async () => {
    try {
      const response = await fetch('/api/public/landing-config');
      
      if (!response.ok) {
        console.error('[Login] Erro na resposta da API:', response.status, response.statusText);
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        if (data.data?.bannerUrl) {
          const rawUrl = data.data.bannerUrl.trim();
          
          // Cache busting - igual ao Preço Fácil Market
          const isDataUri = String(rawUrl).startsWith('data:');
          const finalUrl = isDataUri 
            ? rawUrl 
            : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
          
          setBannerUrl(finalUrl);
        } else {
          setBannerUrl(null);
        }
      }
    } catch (error) {
      console.error('[Login] Erro ao carregar banner:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          password,
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
        navigate('/');
      } else {
        setErrorMessage(data.message || 'Usuário ou senha inválidos.');
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      setErrorMessage('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Header */}
      <header className="login-header">
        <div className="header-container">
          <Link to="/" className="logo-link">
            <div className="logo-box">
              <span className="logo-letter">E</span>
            </div>
            <span className="logo-text">EstoqueUni</span>
          </Link>
          <nav className="header-nav">
            <Link to="/" className="nav-link">Home</Link>
            <Link to="/login" className="nav-link active">Login</Link>
          </nav>
          <div className="header-actions">
            <Link to="/landing" className="btn-experimente">Experimente</Link>
            <a href="#contato" className="link-contato">Fale conosco</a>
          </div>
        </div>
      </header>

      {/* Background decorativo */}
      <div className="login-background">
        <div className="login-background-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
          <div className="shape shape-4"></div>
          <div className="shape shape-5"></div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <main className="login-main">
        <div className="login-container">
          {/* Seção de Marketing - Esquerda (sem banner de fundo) */}
          <div className="marketing-section">
            <div className="marketing-content">
              <p className="marketing-badge">PARA SEUS ESTOQUES COMPARTILHADOS</p>
              <h1 className="marketing-title">
                Sincronize automaticamente seus estoques e otimize sua operação com EstoqueUni
              </h1>
              <p className="marketing-description">
                Conecte múltiplas contas Bling e mantenha seus estoques sempre sincronizados com sincronização em tempo real, 
                backup automático e controle total da sua operação.
              </p>
            </div>
          </div>

          {/* Seção Central - Formulário de Login */}
          <div className="form-section">
            <div className="login-card">
              <p className="login-instruction">
                Utilize seu usuário e senha para acessar o sistema.
              </p>

              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label htmlFor="username" className="form-label">
                    Usuário ou e-mail
                  </label>
                  <div className="input-wrapper">
                    <PersonFill className="input-icon" />
                    <input
                      id="username"
                      type="text"
                      className="form-input"
                      placeholder="Digite seu usuário ou e-mail"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="form-label">
                    Senha
                  </label>
                  <div className="input-wrapper">
                    <LockFill className="input-icon" />
                    <input
                      id="password"
                      type={mostrarSenha ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="toggle-password-btn"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                      disabled={loading}
                      aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {mostrarSenha ? (
                        <EyeSlashFill className="eye-icon" />
                      ) : (
                        <EyeFill className="eye-icon" />
                      )}
                    </button>
                  </div>
                </div>

                {errorMessage && (
                  <div className="error-message" role="alert">
                    <span className="error-icon">⚠️</span>
                    {errorMessage}
                  </div>
                )}

                <div className="form-links">
                  <Link to="/recuperar-senha" className="link-esqueceu-senha">
                    Esqueceu sua senha?
                  </Link>
                </div>

                <button
                  type="submit"
                  className="login-button"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="button-spinner"></span>
                      ENTRANDO...
                    </>
                  ) : (
                    'ENTRAR'
                  )}
                </button>

                <div className="cadastro-section">
                  <p className="cadastro-text">
                    Ainda não tem cadastro?{' '}
                    <Link to="/landing" className="link-cadastro">
                      Inscreva-se agora!
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </div>

          {/* Card de Features - Direita */}
          <div className="features-card">
            <div className="features-image">
              {bannerUrl ? (
                <img
                  src={bannerUrl}
                  alt="Banner EstoqueUni"
                  className="features-banner-image"
                />
              ) : (
                <div className="features-image-placeholder">
                  <BarChartFill className="features-icon" />
                </div>
              )}
            </div>
            <div className="features-content">
              <p className="features-subtitle">Sistema EstoqueUni</p>
              
              <div className="features-list">
                <div className="feature-item">
                  <CheckCircleFill className="feature-check-icon" />
                  <span>Gerencie sua empresa de qualquer lugar</span>
                </div>
                <div className="feature-item">
                  <CheckCircleFill className="feature-check-icon" />
                  <span>Sincronização em tempo real via webhooks</span>
                </div>
                <div className="feature-item">
                  <CheckCircleFill className="feature-check-icon" />
                  <span>Backup automático com verificação periódica</span>
                </div>
                <div className="feature-item">
                  <CheckCircleFill className="feature-check-icon" />
                  <span>Suporte dedicado e monitoramento inteligente</span>
                </div>
                <div className="feature-item">
                  <CheckCircleFill className="feature-check-icon" />
                  <span>Controle total sobre múltiplas contas Bling</span>
                </div>
              </div>

              <div className="features-highlights">
                <div className="highlight-item">
                  <LightningChargeFill className="highlight-icon" />
                  <span>Tempo Real</span>
                </div>
                <div className="highlight-item">
                  <ShieldFill className="highlight-icon" />
                  <span>100% Seguro</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import { useState, useEffect, useContext } from 'react';
import { Container, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import useIsOwner from '../hooks/useIsOwner';
import './PainelPresidente.css';

const API_BASE = '/api/painelpresidente';

export default function PainelPresidente() {
  const { isAuthenticated, isLoading: authLoading, tenantId, nivelAcesso, login, setTenantId, setNivelAcesso, checkAuth } = useContext(AuthContext);
  const isOwner = useIsOwner();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  
  // Estados para banner
  const [bannerUrl, setBannerUrl] = useState(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [selectedBannerFile, setSelectedBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  
  // Estados para o formulário de login
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  useEffect(() => {
    console.log('[PainelPresidente] useEffect - isAuthenticated:', isAuthenticated, 'isOwner:', isOwner, 'nivelAcesso:', nivelAcesso);
    if (isAuthenticated && isOwner) {
      console.log('[PainelPresidente] Carregando logo...');
      carregarLogo();
    }
  }, [isAuthenticated, isOwner, nivelAcesso]);

  const carregarLogo = async () => {
    try {
      setLoading(true);
      setError(null);

      // Sempre usa 'estoqueuni' para o logo da landing page (página pública)
      const response = await fetch(`${API_BASE}/landing-config?tenantId=estoqueuni`, {
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        if (data.data?.logoUrl) {
          setLogoUrl(data.data.logoUrl);
          setPreview(data.data.logoUrl);
        }
        if (data.data?.bannerUrl) {
          setBannerUrl(data.data.bannerUrl);
          setBannerPreview(data.data.bannerUrl);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar logo:', err);
      setError('Erro ao carregar configuração do logo');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setSuccess(null);

      // Criar preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setError('Selecione um arquivo para upload');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('logo', selectedFile);
      // Sempre usa 'estoqueuni' para o logo da landing page (página pública)
      formData.append('tenantId', 'estoqueuni');

      const response = await fetch(`${API_BASE}/landing-config/logo`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setLogoUrl(data.data.logoUrl);
        setPreview(data.data.logoUrl);
        setSuccess('Logo enviado com sucesso!');
        setSelectedFile(null);
      } else {
        setError(data.message || 'Erro ao fazer upload do logo');
      }
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      setError('Erro ao fazer upload do logo. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja remover o logo?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Sempre usa 'estoqueuni' para o logo da landing page (página pública)
      const response = await fetch(
        `${API_BASE}/landing-config/logo?tenantId=estoqueuni`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (data.success) {
        setLogoUrl(null);
        setPreview(null);
        setSelectedFile(null);
        setSuccess('Logo removido com sucesso!');
      } else {
        setError(data.message || 'Erro ao remover logo');
      }
    } catch (err) {
      console.error('Erro ao remover logo:', err);
      setError('Erro ao remover logo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleBannerFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedBannerFile(file);
      setError(null);
      setSuccess(null);

      // Criar preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerUpload = async (e) => {
    e.preventDefault();

    if (!selectedBannerFile) {
      setError('Selecione um arquivo para upload');
      return;
    }

    try {
      setBannerUploading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('banner', selectedBannerFile);
      formData.append('tenantId', 'estoqueuni');

      const response = await fetch(`${API_BASE}/landing-config/banner`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setBannerUrl(data.data.bannerUrl);
        setBannerPreview(data.data.bannerUrl);
        setSuccess('Banner enviado com sucesso!');
        setSelectedBannerFile(null);
      } else {
        setError(data.message || 'Erro ao fazer upload do banner');
      }
    } catch (err) {
      console.error('Erro ao fazer upload do banner:', err);
      setError('Erro ao fazer upload do banner. Tente novamente.');
    } finally {
      setBannerUploading(false);
    }
  };

  const handleBannerDelete = async () => {
    if (!window.confirm('Tem certeza que deseja remover o banner?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE}/landing-config/banner?tenantId=estoqueuni`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (data.success) {
        setBannerUrl(null);
        setBannerPreview(null);
        setSelectedBannerFile(null);
        setSuccess('Banner removido com sucesso!');
      } else {
        setError(data.message || 'Erro ao remover banner');
      }
    } catch (err) {
      console.error('Erro ao remover banner:', err);
      setError('Erro ao remover banner. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

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
        const nivelAcessoRecebido = data.nivel_acesso || data.user?.nivel_acesso || '';
        console.log('[PainelPresidente] Login bem-sucedido. nivel_acesso recebido:', nivelAcessoRecebido);
        console.log('[PainelPresidente] data completa:', data);
        
        // Atualizar todos os estados primeiro
        setTenantId(data.user.tenantId);
        if (setNivelAcesso) {
          setNivelAcesso(nivelAcessoRecebido);
          console.log('[PainelPresidente] nivelAcesso atualizado no contexto:', nivelAcessoRecebido);
        }
        
        // Atualizar autenticação
        login();
        
        // Verificar autenticação novamente para garantir que tudo está atualizado
        setTimeout(async () => {
          await checkAuth();
          console.log('[PainelPresidente] checkAuth concluído após login');
        }, 200);
      } else {
        setLoginError(data.message || 'Usuário ou senha inválidos.');
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      setLoginError('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Mostrar formulário de login se não estiver autenticado
  if (!isAuthenticated && !authLoading) {
    return (
      <div className="painel-presidente-login-page">
        <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
          <Card style={{ width: '100%', maxWidth: '450px' }}>
            <Card.Body>
              <div className="text-center mb-4">
                <h2>Painel do Presidente</h2>
                <p className="text-muted">Acesso exclusivo para administradores</p>
              </div>

              <Form onSubmit={handleLogin}>
                <Form.Group className="mb-3">
                  <Form.Label>Usuário ou E-mail</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Digite seu usuário ou e-mail"
                    value={loginData.username}
                    onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                    required
                    autoComplete="username"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Senha</Form.Label>
                  <div className="input-group">
                    <Form.Control
                      type={mostrarSenha ? 'text' : 'password'}
                      placeholder="Digite sua senha"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                      autoComplete="current-password"
                    />
                    <Button
                      variant="outline-secondary"
                      type="button"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                    >
                      {mostrarSenha ? '🙈' : '👁️'}
                    </Button>
                  </div>
                </Form.Group>

                {loginError && (
                  <Alert variant="danger" className="mb-3">
                    {loginError}
                  </Alert>
                )}

                <Button
                  variant="primary"
                  type="submit"
                  className="w-100"
                  disabled={loginLoading}
                >
                  {loginLoading ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                        className="me-2"
                      />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Container>
      </div>
    );
  }

  // Aguardar carregamento da autenticação
  if (authLoading || loginLoading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" role="status" />
        <p className="mt-3">Verificando permissões...</p>
      </Container>
    );
  }

  // Se estiver autenticado mas não for owner, mostrar mensagem
  if (isAuthenticated && !isOwner) {
    console.log('[PainelPresidente] Usuário autenticado mas não é owner. nivelAcesso:', nivelAcesso);
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          <Alert.Heading>Acesso Negado</Alert.Heading>
          <p>Você não tem permissão para acessar esta página. Apenas o owner do sistema pode acessar o Painel do Presidente.</p>
          <p className="mt-2">
            <small>Seu nível de acesso atual: <strong>{nivelAcesso || 'Não definido'}</strong></small>
          </p>
          <p className="mt-2">
            <small>Para ter acesso, o campo <code>nivel_acesso</code> no banco de dados deve ser alterado para <code>owner</code>.</small>
          </p>
        </Alert>
      </Container>
    );
  }

  // Se estiver autenticado e for owner, mostrar o painel
  if (!isAuthenticated || !isOwner) {
    // Isso não deve acontecer, mas por segurança retorna null
    return null;
  }

  return (
    <Container className="mt-4">
      <div className="mb-4">
        <h1>Painel do Presidente</h1>
        <p className="text-muted">Gerenciamento administrativo do EstoqueUni</p>
      </div>

      <Card className="mb-4">
        <Card.Header>
          <Card.Title className="mb-0">Configuração da Landing Page</Card.Title>
        </Card.Header>
        <Card.Body>
          <h5 className="mb-3">Logo da Página Inicial</h5>
          <p className="text-muted mb-4">
            Faça upload do logo que será exibido na página inicial do EstoqueUni. Formatos aceitos: JPEG, PNG, WebP, SVG.
            Tamanho máximo: 10MB (será otimizado automaticamente).
          </p>

          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" role="status" />
            </div>
          ) : (
            <>
              {preview && (
                <div className="mb-4">
                  <h6>Preview do Logo:</h6>
                  <div className="logo-preview-container">
                    <img
                      src={preview}
                      alt="Preview do logo"
                      className="logo-preview"
                    />
                  </div>
                </div>
              )}

              <Form onSubmit={handleUpload}>
                <Form.Group className="mb-3">
                  <Form.Label>Selecionar Logo</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                  <Form.Text className="text-muted">
                    Formatos aceitos: JPEG, PNG, WebP, SVG. Tamanho máximo: 10MB.
                  </Form.Text>
                </Form.Group>

                <div className="d-flex gap-2">
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={!selectedFile || uploading}
                  >
                    {uploading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Enviando...
                      </>
                    ) : (
                      logoUrl ? 'Atualizar Logo' : 'Enviar Logo'
                    )}
                  </Button>

                  {logoUrl && (
                    <Button
                      variant="danger"
                      type="button"
                      onClick={handleDelete}
                      disabled={uploading || loading}
                    >
                      Remover Logo
                    </Button>
                  )}
                </div>
              </Form>
            </>
          )}
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header>
          <Card.Title className="mb-0">Banner da Página de Login</Card.Title>
        </Card.Header>
        <Card.Body>
          <h5 className="mb-3">Banner Decorativo</h5>
          <p className="text-muted mb-4">
            Faça upload de um banner decorativo que será exibido na página de login do EstoqueUni. 
            O banner aparecerá como background na seção de marketing (lado esquerdo).
            <br />
            <strong>Formatos aceitos:</strong> JPEG, PNG, WebP
            <br />
            <strong>Tamanho recomendado:</strong> 1920x1080px ou maior (proporção 16:9)
            <br />
            <strong>Tamanho máximo:</strong> 2MB (será otimizado automaticamente)
          </p>

          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" role="status" />
            </div>
          ) : (
            <>
              {bannerPreview && (
                <div className="mb-4">
                  <h6>Preview do Banner:</h6>
                  <div className="banner-preview-container">
                    <img
                      src={bannerPreview}
                      alt="Preview do banner"
                      className="banner-preview"
                    />
                  </div>
                </div>
              )}

              <Form onSubmit={handleBannerUpload}>
                <Form.Group className="mb-3">
                  <Form.Label>Selecionar Banner</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleBannerFileChange}
                    disabled={bannerUploading}
                  />
                  <Form.Text className="text-muted">
                    Formatos aceitos: JPEG, PNG, WebP. Tamanho máximo: 2MB. 
                    Recomendado: 1920x1080px ou superior (16:9).
                  </Form.Text>
                </Form.Group>

                <div className="d-flex gap-2">
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={!selectedBannerFile || bannerUploading}
                  >
                    {bannerUploading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Enviando...
                      </>
                    ) : (
                      bannerUrl ? 'Atualizar Banner' : 'Enviar Banner'
                    )}
                  </Button>

                  {bannerUrl && (
                    <Button
                      variant="danger"
                      type="button"
                      onClick={handleBannerDelete}
                      disabled={bannerUploading || loading}
                    >
                      Remover Banner
                    </Button>
                  )}
                </div>
              </Form>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}


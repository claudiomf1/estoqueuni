import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Modal, Table, Badge, Spinner, Form, Alert, InputGroup } from 'react-bootstrap';
import PropTypes from 'prop-types';

const API_BASE = '/api/bling';

/**
 * Gerenciador de múltiplas contas Bling para o EstoqueUni.
 *
 * Regras principais:
 * - Permite múltiplas contas por tenant (mas o cenário alvo é 2 contas principais).
 * - Cada conta é criada via fluxo OAuth (endpoint /contas + /auth/callback).
 * - O frontend conversa apenas com o backend do EstoqueUni; o backend já fala com o Bling.
 */
export default function BlingMultiAccountManager({ tenantId }) {
  // Não usar fallback 'default-tenant' - exige tenantId real
  const identificadorTenant = tenantId;

  const [contas, definirContas] = useState([]);
  const [carregando, definirCarregando] = useState(false);
  const [erro, definirErro] = useState(null);

  const [mostrarModal, definirMostrarModal] = useState(false);
  const [nomeConta, definirNomeConta] = useState('');
  const [clientId, definirClientId] = useState('');
  const [clientSecret, definirClientSecret] = useState('');
  const [redirectUri, definirRedirectUri] = useState(
    `${window.location.origin}/bling/callback`
  );
  const [contaSelecionada, definirContaSelecionada] = useState(null);
  const [acaoEmProgressoId, definirAcaoEmProgressoId] = useState(null);
  const [mostrarClientSecret, definirMostrarClientSecret] = useState(false);
  const [mostrarClientSecretAdicionar, definirMostrarClientSecretAdicionar] = useState(false);
  const [dadosEdicao, definirDadosEdicao] = useState({
    accountName: '',
    bling_client_id: '',
    bling_client_secret: '',
    bling_redirect_uri: '',
  });

  const temDuasContasOuMais = useMemo(() => contas.length >= 2, [contas]);

  const carregarContas = async () => {
    if (!identificadorTenant) {
      definirErro('TenantId não fornecido. Por favor, verifique sua autenticação.');
      return;
    }
    try {
      definirCarregando(true);
      definirErro(null);

      const resposta = await fetch(
        `${API_BASE}/contas?tenantId=${encodeURIComponent(identificadorTenant)}`
      );

      const textoBruto = await resposta.text();
      let dados = {};

      if (textoBruto) {
        try {
          dados = JSON.parse(textoBruto);
        } catch (parseError) {
          console.error('❌ Erro ao parsear JSON ao carregar contas Bling:', parseError, textoBruto);
          throw new Error('Resposta inválida do servidor ao carregar contas Bling');
        }
      }

      if (!resposta.ok || !dados.success) {
        throw new Error(dados.error || 'Erro ao carregar contas Bling');
      }

      definirContas(dados.contas || []);
    } catch (erroCarregar) {
      console.error('❌ Erro ao carregar contas Bling:', erroCarregar);
      definirErro(erroCarregar.message || 'Erro ao carregar contas Bling');
    } finally {
      definirCarregando(false);
    }
  };

  useEffect(() => {
    carregarContas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identificadorTenant]);

  const iniciarCriacaoConta = async (evento) => {
    evento.preventDefault();
    try {
      definirAcaoEmProgressoId('nova');
      definirErro(null);

      if (!identificadorTenant) {
        definirErro('TenantId não fornecido. Por favor, verifique sua autenticação.');
        definirAcaoEmProgressoId(null);
        return;
      }

      if (!nomeConta.trim()) {
        definirErro('Nome da conta é obrigatório');
        definirAcaoEmProgressoId(null);
        return;
      }

      const resposta = await fetch(`${API_BASE}/contas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: identificadorTenant,
          accountName: nomeConta.trim() || 'Conta Bling',
          bling_client_id: clientId.trim() || undefined,
          bling_client_secret: clientSecret.trim() || undefined,
          bling_redirect_uri: redirectUri.trim() || undefined,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.success) {
        throw new Error(dados.error || 'Erro ao criar conta Bling');
      }

      const urlAutorizacao = dados.authUrl || dados.data?.authUrl;
      if (urlAutorizacao) {
        window.open(urlAutorizacao, '_blank', 'width=800,height=700');
      }

      definirNomeConta('');
      definirClientId('');
      definirClientSecret('');
      definirRedirectUri(`${window.location.origin}/bling/callback`);
      definirMostrarClientSecretAdicionar(false);
      definirMostrarModal(false);
      await carregarContas();
    } catch (erroCriar) {
      console.error('❌ Erro ao criar conta Bling:', erroCriar);
      definirErro(erroCriar.message || 'Erro ao criar conta Bling');
    } finally {
      definirAcaoEmProgressoId(null);
    }
  };

  const removerConta = async (conta) => {
    if (!window.confirm(`Tem certeza que deseja remover a conta "${conta.accountName}"?`)) {
      return;
    }

    try {
      definirAcaoEmProgressoId(conta.blingAccountId);
      definirErro(null);

      const url = `${API_BASE}/contas/${encodeURIComponent(
        conta.blingAccountId
      )}?tenantId=${encodeURIComponent(identificadorTenant)}`;

      const resposta = await fetch(url, {
        method: 'DELETE',
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.success) {
        throw new Error(dados.error || 'Erro ao remover conta Bling');
      }

      await carregarContas();
    } catch (erroRemover) {
      console.error('❌ Erro ao remover conta Bling:', erroRemover);
      definirErro(erroRemover.message || 'Erro ao remover conta Bling');
    } finally {
      definirAcaoEmProgressoId(null);
    }
  };

  const alternarAtivacao = async (conta) => {
    try {
      definirAcaoEmProgressoId(conta.blingAccountId);
      definirErro(null);

      const url = `${API_BASE}/contas/${encodeURIComponent(
        conta.blingAccountId
      )}/toggle?tenantId=${encodeURIComponent(identificadorTenant)}`;

      const resposta = await fetch(url, {
        method: 'PATCH',
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.success) {
        throw new Error(dados.error || 'Erro ao alterar status da conta');
      }

      await carregarContas();
    } catch (erroToggle) {
      console.error('❌ Erro ao alterar status da conta Bling:', erroToggle);
      definirErro(erroToggle.message || 'Erro ao alterar status da conta');
    } finally {
      definirAcaoEmProgressoId(null);
    }
  };

  const reiniciarAutorizacao = async (conta) => {
    try {
      definirAcaoEmProgressoId(conta.blingAccountId);
      definirErro(null);

      const url = `${API_BASE}/auth/start?tenantId=${encodeURIComponent(
        identificadorTenant
      )}&blingAccountId=${encodeURIComponent(conta.blingAccountId)}`;

      const resposta = await fetch(url);
      const dados = await resposta.json();

      if (!resposta.ok || !dados.success) {
        throw new Error(dados.error || 'Erro ao iniciar re-autorização');
      }

      const urlAutorizacao = dados.authUrl || dados.data?.authUrl;
      if (urlAutorizacao) {
        window.open(urlAutorizacao, '_blank', 'width=800,height=700');
      }
    } catch (erroReauth) {
      console.error('❌ Erro ao reautorizar conta Bling:', erroReauth);
      definirErro(erroReauth.message || 'Erro ao reautorizar conta Bling');
    } finally {
      definirAcaoEmProgressoId(null);
    }
  };

  const carregarDetalhesConta = async (blingAccountId) => {
    try {
      const resposta = await fetch(
        `${API_BASE}/contas/${encodeURIComponent(blingAccountId)}?tenantId=${encodeURIComponent(identificadorTenant)}`
      );
      const dados = await resposta.json();

      if (resposta.ok && dados.success) {
        definirDadosEdicao({
          accountName: dados.data.accountName || '',
          bling_client_id: dados.data.bling_client_id || '',
          bling_client_secret: dados.data.bling_client_secret || '',
          bling_redirect_uri: dados.data.bling_redirect_uri || `${window.location.origin}/bling/callback`,
        });
      } else {
        throw new Error(dados.error || 'Erro ao carregar detalhes da conta');
      }
    } catch (erro) {
      console.error('❌ Erro ao carregar detalhes da conta:', erro);
      // Se não conseguir carregar, usa os dados da lista
      const conta = contas.find((c) => c.blingAccountId === blingAccountId);
      if (conta) {
        definirDadosEdicao({
          accountName: conta.accountName || '',
          bling_client_id: '',
          bling_client_secret: '',
          bling_redirect_uri: `${window.location.origin}/bling/callback`,
        });
      }
    }
  };

  const editarConta = async (evento) => {
    evento.preventDefault();
    if (!contaSelecionada) return;

    try {
      definirAcaoEmProgressoId(contaSelecionada.blingAccountId);
      definirErro(null);

      const url = `${API_BASE}/contas/${encodeURIComponent(
        contaSelecionada.blingAccountId
      )}?tenantId=${encodeURIComponent(identificadorTenant)}`;

      const resposta = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountName: dadosEdicao.accountName.trim() || undefined,
          bling_client_id: dadosEdicao.bling_client_id.trim() || undefined,
          bling_client_secret: dadosEdicao.bling_client_secret.trim() || undefined,
          bling_redirect_uri: dadosEdicao.bling_redirect_uri.trim() || undefined,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.success) {
        throw new Error(dados.error || 'Erro ao atualizar conta Bling');
      }

      definirContaSelecionada(null);
      definirDadosEdicao({
        accountName: '',
        bling_client_id: '',
        bling_client_secret: '',
        bling_redirect_uri: '',
      });
      await carregarContas();
    } catch (erroEditar) {
      console.error('❌ Erro ao atualizar conta Bling:', erroEditar);
      definirErro(erroEditar.message || 'Erro ao atualizar conta Bling');
    } finally {
      definirAcaoEmProgressoId(null);
    }
  };

  const estaEmAcao = (conta) =>
    acaoEmProgressoId && conta && acaoEmProgressoId === conta.blingAccountId;

  return (
    <>
      <Card>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <Card.Title>Gerenciar Contas Bling</Card.Title>
              <Card.Subtitle className="text-muted" style={{ fontSize: '0.9rem' }}>
                {identificadorTenant ? (
                  <>
                    Tenant atual: <strong>{identificadorTenant}</strong> — suporte a até 2 contas
                    principais (por exemplo, W2ISHOP e TECHYOU).
                  </>
                ) : (
                  <span className="text-danger">
                    ⚠️ TenantId não configurado. Por favor, configure o tenantId na URL ou no localStorage.
                  </span>
                )}
              </Card.Subtitle>
            </div>
            <div>
              <Button variant="primary" onClick={() => definirMostrarModal(true)} disabled={carregando}>
                ➕ Adicionar Conta
              </Button>
            </div>
          </div>

          {erro && (
            <Alert variant="danger" className="mb-3">
              ❌ {erro}
            </Alert>
          )}

          {carregando && contas.length === 0 && (
            <div className="text-center py-4">
              <Spinner animation="border" role="status" />
            </div>
          )}

          {!carregando && contas.length === 0 && (
            <Alert variant="info">
              Nenhuma conta Bling cadastrada ainda. Clique em <strong>“Adicionar Conta”</strong> para
              iniciar a conexão com a primeira conta (ex.: W2ISHOP). Depois você poderá repetir o
              processo para a segunda conta (ex.: TECHYOU).
            </Alert>
          )}

          {contas.length > 0 && (
            <div className="table-responsive">
              <Table hover>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Status</th>
                    <th>Token</th>
                    <th>Última Sincronização</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contas.map((conta) => {
                    const tokenExpirado = conta.tokenExpired;
                    const configuracaoCompleta = conta.isConfigurationComplete;

                    return (
                      <tr key={conta.blingAccountId}>
                        <td>
                          <strong>{conta.accountName}</strong>
                          <br />
                          <small className="text-muted">{conta.blingAccountId}</small>
                          {conta.storeId && (
                            <>
                              <br />
                              <small className="text-muted">Loja ID: {conta.storeId}</small>
                            </>
                          )}
                        </td>
                        <td>
                          <Badge bg={conta.isActive ? 'success' : 'secondary'}>
                            {conta.isActive ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </td>
                        <td>
                          {configuracaoCompleta && !tokenExpirado && (
                            <Badge bg="success">Token válido</Badge>
                          )}
                          {tokenExpirado && <Badge bg="warning">Token expirado</Badge>}
                          {!configuracaoCompleta && !tokenExpirado && (
                            <Badge bg="secondary">Configuração incompleta</Badge>
                          )}
                        </td>
                        <td>
                          {conta.lastSync
                            ? new Date(conta.lastSync).toLocaleString('pt-BR')
                            : 'Nunca'}
                        </td>
                        <td>
                          <div className="d-flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              disabled={estaEmAcao(conta)}
                              onClick={async () => {
                                definirContaSelecionada({
                                  blingAccountId: conta.blingAccountId,
                                  accountName: conta.accountName,
                                });
                                await carregarDetalhesConta(conta.blingAccountId);
                              }}
                              title="Editar conta"
                            >
                              ✏️
                            </Button>
                            <Button
                              size="sm"
                              variant={conta.isActive ? 'outline-warning' : 'outline-success'}
                              disabled={estaEmAcao(conta)}
                              onClick={() => alternarAtivacao(conta)}
                              title={conta.isActive ? 'Desativar conta' : 'Ativar conta'}
                            >
                              {conta.isActive ? '⏸️' : '▶️'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              disabled={estaEmAcao(conta)}
                              onClick={() => reiniciarAutorizacao(conta)}
                              title="Reautorizar / atualizar permissão no Bling"
                            >
                              🔄 OAuth
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              disabled={estaEmAcao(conta)}
                              onClick={() => removerConta(conta)}
                              title="Remover conta"
                            >
                              🗑️
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}

          {temDuasContasOuMais && (
            <Alert variant="success" className="mt-3">
              ✅ Este tenant já possui pelo menos <strong>duas contas Bling</strong> configuradas.
              A camada de sincronização poderá tratar estoques compartilhados entre essas contas.
            </Alert>
          )}
        </Card.Body>
      </Card>

      <Modal
        show={mostrarModal}
        onHide={() => {
          definirMostrarModal(false);
          definirMostrarClientSecretAdicionar(false);
        }}
        centered
      >
        <Form onSubmit={iniciarCriacaoConta}>
          <Modal.Header closeButton>
            <Modal.Title>Adicionar Conta Bling</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>
              Será criada uma nova conta Bling para o tenant <strong>{identificadorTenant}</strong>.
              Em seguida você será redirecionado para a tela de autorização do Bling (OAuth).
            </p>
            <Form.Group className="mb-3" controlId="nomeConta">
              <Form.Label>
                Nome da conta <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="Ex.: Conta Principal, W2ISHOP, TECHYOU..."
                value={nomeConta}
                onChange={(evento) => definirNomeConta(evento.target.value)}
                required
              />
              <Form.Text className="text-muted">
                Apenas um rótulo interno para você identificar a conta; pode ser alterado depois.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3" controlId="clientId">
              <Form.Label>
                Client ID <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="ID do cliente da aplicação Bling"
                value={clientId}
                onChange={(evento) => definirClientId(evento.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="clientSecret">
              <Form.Label>
                Client Secret <span className="text-danger">*</span>
              </Form.Label>
              <InputGroup>
                <Form.Control
                  type={mostrarClientSecretAdicionar ? 'text' : 'password'}
                  placeholder="Secret do cliente da aplicação Bling"
                  value={clientSecret}
                  onChange={(evento) => definirClientSecret(evento.target.value)}
                  required
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => definirMostrarClientSecretAdicionar(!mostrarClientSecretAdicionar)}
                  type="button"
                >
                  {mostrarClientSecretAdicionar ? '🙈' : '👁️'}
                </Button>
              </InputGroup>
            </Form.Group>

            <Form.Group className="mb-3" controlId="redirectUri">
              <Form.Label>
                Redirect URI <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                placeholder={`${window.location.origin}/bling/callback`}
                value={redirectUri}
                onChange={(evento) => definirRedirectUri(evento.target.value)}
                required
              />
              <Form.Text className="text-muted">
                <strong>IMPORTANTE:</strong> este valor deve ser exatamente igual ao "Redirect URI"
                configurado no aplicativo Bling. Padrão de desenvolvimento:{' '}
                {`${window.location.origin}/bling/callback`}
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => {
                definirMostrarModal(false);
                definirMostrarClientSecretAdicionar(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={
                !!acaoEmProgressoId ||
                !nomeConta.trim() ||
                !clientId.trim() ||
                !clientSecret.trim() ||
                !redirectUri.trim()
              }
            >
              {acaoEmProgressoId === 'nova' ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                  Criando...
                </>
              ) : (
                'Criar e Autorizar'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={!!contaSelecionada}
        onHide={() => {
          definirContaSelecionada(null);
          definirMostrarClientSecret(false);
          definirDadosEdicao({
            accountName: '',
            bling_client_id: '',
            bling_client_secret: '',
            bling_redirect_uri: '',
          });
        }}
        centered
        size="lg"
      >
        <Form onSubmit={editarConta}>
          <Modal.Header closeButton>
            <Modal.Title>Editar Conta Bling</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3" controlId="editarNomeConta">
              <Form.Label>Nome da conta</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ex.: W2ISHOP, TECHYOU, Loja Principal..."
                value={dadosEdicao.accountName}
                onChange={(evento) =>
                  definirDadosEdicao({ ...dadosEdicao, accountName: evento.target.value })
                }
              />
              <Form.Text className="text-muted">
                Nome amigável para identificar esta conta Bling.
              </Form.Text>
            </Form.Group>

            <hr />

            <h6 className="mb-3">Credenciais OAuth (Opcional)</h6>
            <Form.Text className="text-muted mb-3 d-block">
              Se não preenchidas, o sistema usará as credenciais globais configuradas no ambiente.
            </Form.Text>

            <Form.Group className="mb-3" controlId="editarClientId">
              <Form.Label>Client ID</Form.Label>
              <Form.Control
                type="text"
                placeholder="ID do cliente da aplicação Bling"
                value={dadosEdicao.bling_client_id}
                onChange={(evento) =>
                  definirDadosEdicao({ ...dadosEdicao, bling_client_id: evento.target.value })
                }
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="editarClientSecret">
              <Form.Label>Client Secret</Form.Label>
              <InputGroup>
                <Form.Control
                  type={mostrarClientSecret ? 'text' : 'password'}
                  placeholder="Secret do cliente da aplicação Bling"
                  value={dadosEdicao.bling_client_secret}
                  onChange={(evento) =>
                    definirDadosEdicao({ ...dadosEdicao, bling_client_secret: evento.target.value })
                  }
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => definirMostrarClientSecret(!mostrarClientSecret)}
                  type="button"
                >
                  {mostrarClientSecret ? '🙈' : '👁️'}
                </Button>
              </InputGroup>
            </Form.Group>

            <Form.Group className="mb-3" controlId="editarRedirectUri">
              <Form.Label>Redirect URI</Form.Label>
              <Form.Control
                type="text"
                placeholder={`${window.location.origin}/bling/callback`}
                value={dadosEdicao.bling_redirect_uri}
                onChange={(evento) =>
                  definirDadosEdicao({ ...dadosEdicao, bling_redirect_uri: evento.target.value })
                }
              />
              <Form.Text className="text-muted">
                <strong>IMPORTANTE:</strong> este valor deve ser exatamente igual ao "Redirect URI"
                configurado no aplicativo Bling. Padrão: {`${window.location.origin}/bling/callback`}
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => {
                definirContaSelecionada(null);
                definirMostrarClientSecret(false);
                definirDadosEdicao({
                  accountName: '',
                  bling_client_id: '',
                  bling_client_secret: '',
                  bling_redirect_uri: '',
                });
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={!!acaoEmProgressoId}>
              Salvar
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

BlingMultiAccountManager.propTypes = {
  tenantId: PropTypes.string,
};



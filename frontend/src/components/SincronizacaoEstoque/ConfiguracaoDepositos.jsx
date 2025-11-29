import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner, Badge, Row, Col, Modal } from 'react-bootstrap';
import { Save, Building, Plus, Trash, CloudArrowDown, X } from 'react-bootstrap-icons';
import { useQuery, useMutation } from 'react-query';
import { sincronizacaoApi } from '../../services/sincronizacaoApi';
import { blingApi } from '../../services/blingApi';

const extrairListaContas = (response) => {
  if (!response || !response.data) {
    return [];
  }

  const candidatos = [
    response.data.contas,
    response.data.data?.contas,
    response.data.data,
  ];

  for (const candidato of candidatos) {
    if (Array.isArray(candidato)) {
      return candidato;
    }
  }

  return [];
};

/**
 * Componente genérico para configuração de depósitos
 * Permite adicionar/remover depósitos e configurar regra de sincronização
 */
export default function ConfiguracaoDepositos({ tenantId, config: configInicial, onConfigUpdate }) {
  const [depositos, setDepositos] = useState(
    configInicial?.depositos || []
  );
  const [regraSincronizacao, setRegraSincronizacao] = useState(
    configInicial?.regraSincronizacao || {
      tipo: 'soma',
      depositosPrincipais: [],
      depositosCompartilhados: []
    }
  );
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [erro, setErro] = useState(null);
  const [contaSelecionada, setContaSelecionada] = useState('');
  const [mostrarModalCriar, setMostrarModalCriar] = useState(false);
  const [novoDeposito, setNovoDeposito] = useState({ descricao: '', situacao: 'A' });

  // Buscar contas Bling para associar aos depósitos
  const { data: contasResponse } = useQuery(
    ['bling-contas', tenantId],
    () => blingApi.listarContas(tenantId),
    {
      enabled: !!tenantId,
      refetchOnWindowFocus: false,
      select: (response) => extrairListaContas(response)
    }
  );

  const contasBling = contasResponse || [];

  // Buscar depósitos do Bling quando uma conta for selecionada
  const { data: depositosBling, isLoading: carregandoDepositos, refetch: refetchDepositos } = useQuery(
    ['bling-depositos', tenantId, contaSelecionada],
    () => blingApi.listarDepositos(tenantId, contaSelecionada),
    {
      enabled: !!tenantId && !!contaSelecionada,
      refetchOnWindowFocus: false,
      select: (response) => response.data?.data || [],
      onError: (error) => {
        console.error('Erro ao buscar depósitos:', error);
        if (error.status === 401) {
          setErro('Reautorização necessária para acessar depósitos do Bling.');
        }
      }
    }
  );

  // Mutation para criar depósito
  const criarDepositoMutation = useMutation(
    ({ blingAccountId, dadosDeposito }) => blingApi.criarDeposito(tenantId, blingAccountId, dadosDeposito),
    {
      onSuccess: () => {
        setMensagem('Depósito criado com sucesso no Bling!');
        setMostrarModalCriar(false);
        setNovoDeposito({ descricao: '', situacao: 'A' });
        refetchDepositos(); // Atualiza a lista de depósitos
        setTimeout(() => setMensagem(null), 5000);
      },
      onError: (error) => {
        setErro(error.mensagem || error.message || 'Erro ao criar depósito no Bling');
        setTimeout(() => setErro(null), 7000);
      }
    }
  );

  // Sincronizar estado quando config mudar
  useEffect(() => {
    if (configInicial) {
      setDepositos(configInicial.depositos || []);
      setRegraSincronizacao(configInicial.regraSincronizacao || {
        tipo: 'soma',
        depositosPrincipais: [],
        depositosCompartilhados: []
      });
    }
  }, [configInicial]);

  const validarConfiguracao = () => {
    // Validar que todos os depósitos têm id e nome
    const depositosInvalidos = depositos.filter(
      d => !d.id || !d.id.trim() || !d.nome || !d.nome.trim()
    );
    if (depositosInvalidos.length > 0) {
      setErro('Todos os depósitos devem ter um ID e nome válidos.');
      return false;
    }

    // Validar IDs únicos
    const idsDuplicados = depositos.filter(
      (d, index) => depositos.findIndex(dep => dep.id === d.id) !== index
    );
    if (idsDuplicados.length > 0) {
      setErro('Não é permitido ter IDs de depósito duplicados.');
      return false;
    }

    // Validar que há pelo menos 1 depósito principal na regra
    if (regraSincronizacao.depositosPrincipais.length === 0) {
      setErro('É necessário selecionar pelo menos um depósito principal na regra de sincronização.');
      return false;
    }

    // Validar que há pelo menos 1 depósito compartilhado na regra
    if (regraSincronizacao.depositosCompartilhados.length === 0) {
      setErro('É necessário selecionar pelo menos um depósito compartilhado na regra de sincronização.');
      return false;
    }

    // Validar que os IDs da regra existem nos depósitos
    const idsDepositos = depositos.map(d => d.id);
    const idsInvalidosPrincipais = regraSincronizacao.depositosPrincipais.filter(
      id => !idsDepositos.includes(id)
    );
    const idsInvalidosCompartilhados = regraSincronizacao.depositosCompartilhados.filter(
      id => !idsDepositos.includes(id)
    );

    if (idsInvalidosPrincipais.length > 0 || idsInvalidosCompartilhados.length > 0) {
      setErro('A regra de sincronização referencia depósitos que não existem.');
      return false;
    }

    return true;
  };

  const handleSalvar = async () => {
    setErro(null);
    setMensagem(null);

    if (!validarConfiguracao()) {
      return;
    }

    setSalvando(true);

    try {
      // Usar endpoint de configuração geral
      const response = await sincronizacaoApi.obterConfiguracao(tenantId);
      let configAtual = response.data?.data || {};

      // Atualizar configuração com novos dados
      configAtual.depositos = depositos;
      configAtual.regraSincronizacao = regraSincronizacao;

      // Salvar configuração
      const responseSave = await sincronizacaoApi.salvarConfiguracao(tenantId, {
        depositos,
        regraSincronizacao
      });

      if (responseSave.data?.success !== false) {
        setMensagem('Configuração de depósitos salva com sucesso!');
        if (onConfigUpdate) {
          onConfigUpdate(responseSave.data?.data || configAtual);
        }
        setTimeout(() => setMensagem(null), 5000);
      } else {
        throw new Error(responseSave.data?.message || 'Erro ao salvar configuração');
      }
    } catch (err) {
      setErro(err.mensagem || err.message || 'Erro ao salvar configuração de depósitos');
      setTimeout(() => setErro(null), 7000);
    } finally {
      setSalvando(false);
    }
  };

  const handleDepositoChange = (index, field, value) => {
    const novosDepositos = [...depositos];
    novosDepositos[index] = {
      ...novosDepositos[index],
      [field]: value
    };
    setDepositos(novosDepositos);
    setErro(null);
  };

  const handleAdicionarDeposito = () => {
    setDepositos([
      ...depositos,
      {
        id: '',
        nome: '',
        tipo: 'principal',
        contaBlingId: ''
      }
    ]);
  };

  const handleRemoverDeposito = (index) => {
    const depositoRemovido = depositos[index];
    const novosDepositos = depositos.filter((_, i) => i !== index);
    setDepositos(novosDepositos);

    // Remover da regra de sincronização se estiver lá
    setRegraSincronizacao({
      ...regraSincronizacao,
      depositosPrincipais: regraSincronizacao.depositosPrincipais.filter(
        id => id !== depositoRemovido.id
      ),
      depositosCompartilhados: regraSincronizacao.depositosCompartilhados.filter(
        id => id !== depositoRemovido.id
      )
    });
    setErro(null);
  };

  const handleToggleDepositoPrincipal = (depositoId) => {
    const novosPrincipais = regraSincronizacao.depositosPrincipais.includes(depositoId)
      ? regraSincronizacao.depositosPrincipais.filter(id => id !== depositoId)
      : [...regraSincronizacao.depositosPrincipais, depositoId];

    setRegraSincronizacao({
      ...regraSincronizacao,
      depositosPrincipais: novosPrincipais
    });
    setErro(null);
  };

  const handleToggleDepositoCompartilhado = (depositoId) => {
    const novosCompartilhados = regraSincronizacao.depositosCompartilhados.includes(depositoId)
      ? regraSincronizacao.depositosCompartilhados.filter(id => id !== depositoId)
      : [...regraSincronizacao.depositosCompartilhados, depositoId];

    setRegraSincronizacao({
      ...regraSincronizacao,
      depositosCompartilhados: novosCompartilhados
    });
    setErro(null);
  };

  const handleAdicionarDepositoDaLista = (depositoBling) => {
    // Verificar se já não está na lista
    if (depositos.some(d => d.id === depositoBling.id.toString())) {
      setErro('Este depósito já está na lista.');
      setTimeout(() => setErro(null), 3000);
      return;
    }

    // Adicionar depósito da lista do Bling
    setDepositos([
      ...depositos,
      {
        id: depositoBling.id.toString(),
        nome: depositoBling.descricao || `Depósito ${depositoBling.id}`,
        tipo: 'principal',
        contaBlingId: contaSelecionada
      }
    ]);
    setMensagem(`Depósito "${depositoBling.descricao}" adicionado com sucesso!`);
    setTimeout(() => setMensagem(null), 3000);
  };

  const handleCriarDeposito = () => {
    if (!novoDeposito.descricao || !novoDeposito.descricao.trim()) {
      setErro('O nome do depósito é obrigatório.');
      return;
    }

    if (!contaSelecionada) {
      setErro('Selecione uma conta Bling primeiro.');
      return;
    }

    criarDepositoMutation.mutate({
      blingAccountId: contaSelecionada,
      dadosDeposito: {
        descricao: novoDeposito.descricao.trim(),
        situacao: novoDeposito.situacao || 'A'
      }
    });
  };

  return (
    <Card className="mb-4">
      <Card.Header>
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <Building className="me-2" />
            <h5 className="mb-0">Configuração de Depósitos</h5>
          </div>
          <Button
            variant="outline-primary"
            size="sm"
            onClick={handleAdicionarDeposito}
            disabled={salvando}
          >
            <Plus className="me-1" />
            Adicionar Depósito
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        <Form>
          {/* Seção: Selecionar Conta e Gerenciar Depósitos do Bling */}
          <div className="mb-4 p-3 border rounded bg-light">
            <h6 className="mb-3">
              <CloudArrowDown className="me-2" />
              Gerenciar Depósitos do Bling
            </h6>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Selecione uma Conta Bling</Form.Label>
                  <Form.Select
                    value={contaSelecionada}
                    onChange={(e) => {
                      setContaSelecionada(e.target.value);
                      setErro(null);
                    }}
                    disabled={salvando}
                  >
                    <option value="">-- Selecione uma conta --</option>
                    {contasBling
                      .filter(conta => conta.isActive !== false && conta.is_active !== false)
                      .map((conta) => (
                        <option key={conta._id || conta.id} value={conta.blingAccountId || conta._id || conta.id}>
                          {conta.accountName || conta.store_name || 'Conta sem nome'}
                        </option>
                      ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Selecione uma conta para listar e gerenciar seus depósitos
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6} className="d-flex align-items-end">
                <Button
                  variant="outline-success"
                  onClick={() => setMostrarModalCriar(true)}
                  disabled={!contaSelecionada || salvando}
                >
                  <Plus className="me-1" />
                  Criar Novo Depósito no Bling
                </Button>
              </Col>
            </Row>

            {/* Lista de Depósitos do Bling */}
            {contaSelecionada && (
              <div className="mt-3">
                {carregandoDepositos ? (
                  <div className="text-center py-3">
                    <Spinner animation="border" size="sm" className="me-2" />
                    <span>Carregando depósitos do Bling...</span>
                  </div>
                ) : depositosBling && depositosBling.length > 0 ? (
                  <div>
                    <Form.Label className="mb-2">
                      <strong>Depósitos Disponíveis no Bling:</strong>
                    </Form.Label>
                    <div className="d-flex flex-wrap gap-2">
                      {depositosBling.map((deposito) => {
                        const jaAdicionado = depositos.some(d => d.id === deposito.id.toString());
                        return (
                          <Badge
                            key={deposito.id}
                            bg={jaAdicionado ? 'secondary' : 'info'}
                            className="p-2 d-flex align-items-center gap-2"
                            style={{ cursor: jaAdicionado ? 'not-allowed' : 'pointer' }}
                            onClick={() => !jaAdicionado && handleAdicionarDepositoDaLista(deposito)}
                            title={jaAdicionado ? 'Já adicionado' : 'Clique para adicionar'}
                          >
                            <span>{deposito.descricao || `Depósito ${deposito.id}`}</span>
                            {!jaAdicionado && <Plus size={16} />}
                            {jaAdicionado && <X size={16} />}
                          </Badge>
                        );
                      })}
                    </div>
                    <Form.Text className="text-muted d-block mt-2">
                      Clique em um depósito para adicioná-lo à configuração
                    </Form.Text>
                  </div>
                ) : (
                  <Alert variant="info" className="mb-0">
                    Nenhum depósito encontrado nesta conta Bling.
                  </Alert>
                )}
              </div>
            )}
          </div>

          {/* Lista de Depósitos */}
          <div className="mb-4">
            <h6 className="mb-3">Depósitos Cadastrados na Configuração</h6>
            {depositos.length === 0 ? (
              <Alert variant="info">
                Nenhum depósito cadastrado. Clique em "Adicionar Depósito" para começar.
              </Alert>
            ) : (
              depositos.map((deposito, index) => (
                <Card key={index} className="mb-3">
                  <Card.Body>
                    <Row>
                      <Col md={4}>
                        <Form.Group className="mb-2">
                          <Form.Label>Nome do Depósito</Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Ex: Depósito Principal SP"
                            value={deposito.nome}
                            onChange={(e) => handleDepositoChange(index, 'nome', e.target.value)}
                            disabled={salvando}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-2">
                          <Form.Label>ID do Depósito (Bling)</Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Ex: 14886873196"
                            value={deposito.id}
                            onChange={(e) => handleDepositoChange(index, 'id', e.target.value)}
                            disabled={salvando}
                          />
                          <Form.Text className="text-muted">
                            ID único do depósito no Bling
                          </Form.Text>
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-2">
                          <Form.Label>Tipo</Form.Label>
                          <Form.Select
                            value={deposito.tipo}
                            onChange={(e) => handleDepositoChange(index, 'tipo', e.target.value)}
                            disabled={salvando}
                          >
                            <option value="principal">Principal</option>
                            <option value="compartilhado">Compartilhado</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={2}>
                        <Form.Group className="mb-2">
                          <Form.Label>Ações</Form.Label>
                          <div>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleRemoverDeposito(index)}
                              disabled={salvando}
                              title="Remover depósito"
                            >
                              <Trash />
                            </Button>
                          </div>
                        </Form.Group>
                      </Col>
                    </Row>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-2">
                          <Form.Label>Conta Bling (Opcional)</Form.Label>
                          <Form.Select
                            value={deposito.contaBlingId || ''}
                            onChange={(e) => handleDepositoChange(index, 'contaBlingId', e.target.value)}
                            disabled={salvando}
                          >
                            <option value="">Nenhuma conta associada</option>
                            {contasBling.map((conta) => (
                              <option key={conta._id || conta.id} value={conta.blingAccountId || conta._id || conta.id}>
                                {conta.accountName || conta.store_name || 'Conta sem nome'}
                              </option>
                            ))}
                          </Form.Select>
                          <Form.Text className="text-muted">
                            Associe este depósito a uma conta Bling específica
                          </Form.Text>
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              ))
            )}
          </div>

          {/* Regra de Sincronização */}
          {depositos.length > 0 && (
            <div className="mb-4">
              <h6 className="mb-3">Regra de Sincronização</h6>
              <Alert variant="info" className="mb-3">
                Selecione quais depósitos são usados para calcular o estoque (principais) 
                e quais recebem o resultado da sincronização (compartilhados).
              </Alert>

              <Row>
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <strong>Depósitos Principais</strong>
                      <Badge bg="primary" className="ms-2">
                        {regraSincronizacao.depositosPrincipais.length} selecionado(s)
                      </Badge>
                    </Card.Header>
                    <Card.Body>
                      <Form.Text className="text-muted d-block mb-2">
                        Estoque desses depósitos será somado
                      </Form.Text>
                      {depositos.map((deposito, idx) => (
                        <Form.Check
                          key={deposito.id || `temp-${idx}`}
                          type="checkbox"
                          id={`principal-${deposito.id || idx}`}
                          label={deposito.nome || `Depósito ${deposito.id || 'sem nome'}`}
                          checked={deposito.id && regraSincronizacao.depositosPrincipais.includes(deposito.id)}
                          onChange={() => deposito.id && handleToggleDepositoPrincipal(deposito.id)}
                          disabled={salvando || !deposito.id}
                          className="mb-2"
                        />
                      ))}
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <strong>Depósitos Compartilhados</strong>
                      <Badge bg="success" className="ms-2">
                        {regraSincronizacao.depositosCompartilhados.length} selecionado(s)
                      </Badge>
                    </Card.Header>
                    <Card.Body>
                      <Form.Text className="text-muted d-block mb-2">
                        Estoque será atualizado nesses depósitos
                      </Form.Text>
                      {depositos.map((deposito, idx) => (
                        <Form.Check
                          key={deposito.id || `temp-${idx}`}
                          type="checkbox"
                          id={`compartilhado-${deposito.id || idx}`}
                          label={deposito.nome || `Depósito ${deposito.id || 'sem nome'}`}
                          checked={deposito.id && regraSincronizacao.depositosCompartilhados.includes(deposito.id)}
                          onChange={() => deposito.id && handleToggleDepositoCompartilhado(deposito.id)}
                          disabled={salvando || !deposito.id}
                          className="mb-2"
                        />
                      ))}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </div>
          )}
        </Form>

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

        <div className="mt-3">
          <Button
            variant="primary"
            onClick={handleSalvar}
            disabled={salvando || depositos.length === 0}
          >
            {salvando ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="me-2" />
                Salvar Configuração
              </>
            )}
          </Button>
        </div>
      </Card.Body>

      {/* Modal para Criar Novo Depósito */}
      <Modal show={mostrarModalCriar} onHide={() => setMostrarModalCriar(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <Plus className="me-2" />
            Criar Novo Depósito no Bling
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Nome do Depósito *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ex: Depósito Principal SP"
                value={novoDeposito.descricao}
                onChange={(e) => setNovoDeposito({ ...novoDeposito, descricao: e.target.value })}
                disabled={criarDepositoMutation.isLoading}
              />
              <Form.Text className="text-muted">
                Nome que aparecerá no Bling
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Situação</Form.Label>
              <Form.Select
                value={novoDeposito.situacao}
                onChange={(e) => setNovoDeposito({ ...novoDeposito, situacao: e.target.value })}
                disabled={criarDepositoMutation.isLoading}
              >
                <option value="A">Ativo</option>
                <option value="I">Inativo</option>
              </Form.Select>
            </Form.Group>
            {criarDepositoMutation.isError && (
              <Alert variant="danger" className="mt-3">
                {criarDepositoMutation.error?.mensagem || criarDepositoMutation.error?.message || 'Erro ao criar depósito'}
              </Alert>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setMostrarModalCriar(false);
              setNovoDeposito({ descricao: '', situacao: 'A' });
            }}
            disabled={criarDepositoMutation.isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleCriarDeposito}
            disabled={criarDepositoMutation.isLoading || !novoDeposito.descricao.trim()}
          >
            {criarDepositoMutation.isLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Criando...
              </>
            ) : (
              <>
                <Plus className="me-1" />
                Criar Depósito
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}


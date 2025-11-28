import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner, Badge, Row, Col } from 'react-bootstrap';
import { Save, Building, Plus, Trash } from 'react-bootstrap-icons';
import { useQuery } from 'react-query';
import { sincronizacaoApi } from '../../services/sincronizacaoApi';
import { blingApi } from '../../services/blingApi';

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

  // Buscar contas Bling para associar aos depósitos
  const { data: contasResponse } = useQuery(
    ['bling-contas', tenantId],
    () => blingApi.listarContas(tenantId),
    {
      enabled: !!tenantId,
      refetchOnWindowFocus: false,
      select: (response) => response.data?.data || response.data || []
    }
  );

  const contasBling = contasResponse || [];

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
          {/* Lista de Depósitos */}
          <div className="mb-4">
            <h6 className="mb-3">Depósitos Cadastrados</h6>
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
    </Card>
  );
}


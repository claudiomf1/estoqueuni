import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner, Accordion } from 'react-bootstrap';
import { Save, Building } from 'react-bootstrap-icons';
import { sincronizacaoApi } from '../../../services/sincronizacaoApi';
import { validarConfiguracao } from './utilitarios';
import {
  manipularMudancaDeposito,
  removerDeposito,
  alternarDepositoPrincipal,
  alternarDepositoCompartilhado,
  adicionarDepositoDaLista,
  salvarConfiguracao
} from './manipuladores-depositos';
import {
  usarContasBling,
  usarDepositosBling,
  usarCriarDeposito,
  usarDeletarDeposito
} from './hooks-uso-depositos.jsx';
import SecaoGerenciarBling from './componentes/SecaoGerenciarBling';
import ListaDepositos from './componentes/ListaDepositos';
import RegraSincronizacao from './componentes/RegraSincronizacao';
import ModalCriarDeposito from './componentes/ModalCriarDeposito';
import ModalConfirmacaoDelecao from './componentes/ModalConfirmacaoDelecao';
import ModalConfirmacaoRemoverDeposito from './componentes/ModalConfirmacaoRemoverDeposito';

/**
 * Componente genérico para configuração de depósitos
 * Permite adicionar/remover depósitos e configurar regra de sincronização
 */
export default function ConfiguracaoDepositos({ tenantId, config: configInicial, onConfigUpdate }) {
  const [depositos, setDepositos] = useState(configInicial?.depositos || []);
  const [regraSincronizacao, setRegraSincronizacao] = useState(
    configInicial?.regraSincronizacao || {
      tipo: 'soma',
      depositosPrincipais: [],
      depositosCompartilhados: []
    }
  );
  const [sincronizacaoGeralAtiva, setSincronizacaoGeralAtiva] = useState(configInicial?.ativo || false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [erro, setErro] = useState(null);
  const [contaSelecionada, setContaSelecionada] = useState('');
  const [mostrarModalCriar, setMostrarModalCriar] = useState(false);
  const [novoDeposito, setNovoDeposito] = useState({ descricao: '', situacao: 'A' });
  const [mostrarModalConfirmacao, setMostrarModalConfirmacao] = useState(false);
  const [depositoParaDeletar, setDepositoParaDeletar] = useState(null);
  const [mostrarModalRemoverDeposito, setMostrarModalRemoverDeposito] = useState(false);
  const [depositoParaRemover, setDepositoParaRemover] = useState(null);

  // Hooks para buscar dados do Bling
  const { data: contasBling = [] } = usarContasBling(tenantId);
  const { data: depositosBling, isLoading: carregandoDepositos, refetch: refetchDepositos } = 
    usarDepositosBling(tenantId, contaSelecionada, setErro);

  // Hooks para mutations
  const criarDepositoMutation = usarCriarDeposito(
    tenantId,
    setMensagem,
    setErro,
    setMostrarModalCriar,
    setNovoDeposito,
    refetchDepositos
  );
  const deletarDepositoMutation = usarDeletarDeposito(
    tenantId,
    setMensagem,
    setErro,
    refetchDepositos,
    onConfigUpdate
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
      setSincronizacaoGeralAtiva(configInicial.ativo || false);
    }
  }, [configInicial]);

  // Handlers usando funções extraídas
  const handleDepositoChange = (index, field, value) => {
    manipularMudancaDeposito(depositos, index, field, value, setDepositos, setErro);
  };


  const handleRemoverDeposito = (index) => {
    const deposito = depositos[index];
    setDepositoParaRemover({ ...deposito, index });
    setMostrarModalRemoverDeposito(true);
  };

  const confirmarRemocaoDeposito = async () => {
    if (!depositoParaRemover || depositoParaRemover.index === undefined) return;

    const index = depositoParaRemover.index;
    
    // Guardar estado anterior para possível rollback
    const depositosAnteriores = [...depositos];
    const regraAnterior = { ...regraSincronizacao };
    
    // Calcular nova lista de depósitos e regra atualizada
    const novosDepositos = depositos.filter((_, i) => i !== index);
    const novaRegraSincronizacao = {
      ...regraSincronizacao,
      depositosPrincipais: regraSincronizacao.depositosPrincipais.filter(
        id => id !== depositoParaRemover.id
      ),
      depositosCompartilhados: regraSincronizacao.depositosCompartilhados.filter(
        id => id !== depositoParaRemover.id
      )
    };

    // Atualizar estado local primeiro
    setDepositos(novosDepositos);
    setRegraSincronizacao(novaRegraSincronizacao);
    setErro(null);

    // Salvar no banco de dados
    setSalvando(true);
    try {
      await salvarConfiguracao(
        tenantId,
        novosDepositos,
        novaRegraSincronizacao,
        sincronizacaoGeralAtiva,
        setSalvando,
        setErro,
        setMensagem,
        sincronizacaoApi,
        onConfigUpdate
      );
      
      setMensagem(`Depósito "${depositoParaRemover.nome || depositoParaRemover.id}" removido com sucesso!`);
      setTimeout(() => setMensagem(null), 5000);
      
      setMostrarModalRemoverDeposito(false);
      setDepositoParaRemover(null);
    } catch (err) {
      // Se der erro ao salvar, restaurar estado anterior
      setDepositos(depositosAnteriores);
      setRegraSincronizacao(regraAnterior);
      // Erro já tratado no salvarConfiguracao
      setMostrarModalRemoverDeposito(false);
      setDepositoParaRemover(null);
    }
  };

  const cancelarRemocaoDeposito = () => {
    setMostrarModalRemoverDeposito(false);
    setDepositoParaRemover(null);
  };

  const handleToggleDepositoPrincipal = (depositoId) => {
    alternarDepositoPrincipal(depositoId, regraSincronizacao, setRegraSincronizacao, setErro);
  };

  const handleToggleDepositoCompartilhado = (depositoId) => {
    alternarDepositoCompartilhado(depositoId, regraSincronizacao, setRegraSincronizacao, setErro);
  };

  const handleAdicionarDepositoDaLista = (depositoBling) => {
    adicionarDepositoDaLista(
      depositoBling,
      depositos,
      contaSelecionada,
      setDepositos,
      setErro,
      setMensagem
    );
  };

  const handleSalvar = async () => {
    setErro(null);
    setMensagem(null);

    const validacao = validarConfiguracao(depositos, regraSincronizacao);
    if (!validacao.valido) {
      // Mostrar todos os erros
      setErro(validacao.erros.join(' '));
      return;
    }

    await salvarConfiguracao(
      tenantId,
      depositos,
      regraSincronizacao,
      sincronizacaoGeralAtiva,
      setSalvando,
      setErro,
      setMensagem,
      sincronizacaoApi,
      onConfigUpdate
    );
  };

  // Verificar se há depósitos sem nome para desabilitar botão de salvar
  const temDepositosSemNome = depositos.some(d => !d.nome || !d.nome.trim());

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

  const handleDeletarDeposito = (depositoId, descricao) => {
    setDepositoParaDeletar({
      id: depositoId,
      nome: descricao || `ID ${depositoId}`
    });
    setMostrarModalConfirmacao(true);
  };

  const confirmarDelecao = () => {
    if (!depositoParaDeletar) return;

    deletarDepositoMutation.mutate({
      depositoId: depositoParaDeletar.id,
      nomeDeposito: depositoParaDeletar.nome
    });

    setMostrarModalConfirmacao(false);
    setDepositoParaDeletar(null);
  };

  const handleToggleSincronizacaoGeral = async (ativo) => {
    const estadoAnterior = sincronizacaoGeralAtiva;
    setSincronizacaoGeralAtiva(ativo);
    setErro(null);
    setMensagem(null);

    const validacao = validarConfiguracao(depositos, regraSincronizacao);
    if (!validacao.valido) {
      setErro(validacao.erros.join(' '));
      setSincronizacaoGeralAtiva(estadoAnterior);
      return;
    }

    try {
      await salvarConfiguracao(
        tenantId,
        depositos,
        regraSincronizacao,
        ativo,
        setSalvando,
        setErro,
        setMensagem,
        sincronizacaoApi,
        onConfigUpdate
      );
      setMensagem(ativo ? 'Sincronização geral ativada!' : 'Sincronização geral desativada.');
      setTimeout(() => setMensagem(null), 5000);
    } catch (err) {
      // mensagem tratada no helper; reverter estado visual
      setSincronizacaoGeralAtiva(estadoAnterior);
    }
  };

  const cancelarDelecao = () => {
    setMostrarModalConfirmacao(false);
    setDepositoParaDeletar(null);
  };

  return (
    <Card className="mb-4">
      <Card.Header>
        <div className="d-flex align-items-center">
          <Building className="me-2" />
          <h5 className="mb-0">Configuração de Depósitos</h5>
        </div>
      </Card.Header>
      <Card.Body>
        <Form>
          <Accordion className="mb-4">
            <Accordion.Item eventKey="gerenciar-bling">
              <Accordion.Header>
                <strong>Gerenciar Depósitos do Bling</strong>
              </Accordion.Header>
              <Accordion.Body>
                <SecaoGerenciarBling
                  contaSelecionada={contaSelecionada}
                  setContaSelecionada={setContaSelecionada}
                  contasBling={contasBling}
                  depositosBling={depositosBling}
                  carregandoDepositos={carregandoDepositos}
                  depositos={depositos}
                  salvando={salvando}
                  setMostrarModalCriar={setMostrarModalCriar}
                  handleAdicionarDepositoDaLista={handleAdicionarDepositoDaLista}
                  handleDeletarDeposito={handleDeletarDeposito}
                  deletarDepositoMutation={deletarDepositoMutation}
                />
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>

          <ListaDepositos
            depositos={depositos}
            contasBling={contasBling}
            salvando={salvando}
            handleDepositoChange={handleDepositoChange}
            handleRemoverDeposito={handleRemoverDeposito}
          />

          <Form.Group className="mb-4">
            <Form.Check
              type="switch"
              id="sincronizacao-geral"
              label="Ativar Sincronização Geral"
              checked={sincronizacaoGeralAtiva}
              disabled={salvando}
              onChange={(e) => handleToggleSincronizacaoGeral(e.target.checked)}
            />
            <Form.Text className="text-muted">
              Ao ativar, o EstoqueUni executa a sincronização automática para este tenant quando tudo estiver configurado.
            </Form.Text>
          </Form.Group>

          <RegraSincronizacao
            depositos={depositos}
            regraSincronizacao={regraSincronizacao}
            salvando={salvando}
            handleToggleDepositoPrincipal={handleToggleDepositoPrincipal}
            handleToggleDepositoCompartilhado={handleToggleDepositoCompartilhado}
            handleRemoverDeposito={handleRemoverDeposito}
          />
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
            disabled={salvando || depositos.length === 0 || temDepositosSemNome}
            title={temDepositosSemNome ? 'Corrija os depósitos sem nome antes de salvar' : ''}
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
          {temDepositosSemNome && (
            <Alert variant="warning" className="mt-2 mb-0">
              <strong>Atenção:</strong> Existem depósitos sem nome. Preencha o nome de todos os depósitos antes de salvar.
            </Alert>
          )}
        </div>
      </Card.Body>

      <ModalCriarDeposito
        mostrar={mostrarModalCriar}
        fechar={() => {
          setMostrarModalCriar(false);
          setNovoDeposito({ descricao: '', situacao: 'A' });
        }}
        novoDeposito={novoDeposito}
        setNovoDeposito={setNovoDeposito}
        criarDeposito={handleCriarDeposito}
        isLoading={criarDepositoMutation.isLoading}
        erro={criarDepositoMutation.isError ? (criarDepositoMutation.error?.mensagem || criarDepositoMutation.error?.message || 'Erro ao criar depósito') : null}
        contaSelecionada={contaSelecionada}
        contasBling={contasBling}
      />

      <ModalConfirmacaoDelecao
        mostrar={mostrarModalConfirmacao}
        fechar={cancelarDelecao}
        depositoParaDeletar={depositoParaDeletar}
        confirmarDelecao={confirmarDelecao}
        isLoading={deletarDepositoMutation.isLoading}
      />

      <ModalConfirmacaoRemoverDeposito
        mostrar={mostrarModalRemoverDeposito}
        fechar={cancelarRemocaoDeposito}
        deposito={depositoParaRemover}
        confirmarRemocao={confirmarRemocaoDeposito}
        isLoading={salvando}
      />
    </Card>
  );
}

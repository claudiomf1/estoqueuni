import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Table,
  Form,
  Button,
  Badge,
  Spinner,
  Alert,
  Collapse,
  ListGroup
} from 'react-bootstrap';
import {
  ClockHistory,
  ArrowRepeat,
  ChevronDown,
  ChevronUp
} from 'react-bootstrap-icons';
import { useQuery } from 'react-query';
import { sincronizacaoApi } from '../../services/sincronizacaoApi';
import FiltrosRapidosDias from './HistoricoSincronizacoes/FiltrosRapidosDias';

const ORIGEM_LABELS = {
  webhook: 'Webhook',
  manual: 'Manual',
  agendado: 'Agendado',
  compartilhado: 'Compartilhado'
};

const STATUS_MAP = {
  success: { label: 'Sucesso', variant: 'success' },
  sucesso: { label: 'Sucesso', variant: 'success' },
  ok: { label: 'Sucesso', variant: 'success' },
  fail: { label: 'Erro', variant: 'danger' },
  erro: { label: 'Erro', variant: 'danger' },
  error: { label: 'Erro', variant: 'danger' },
  warning: { label: 'Aviso', variant: 'warning' },
  aviso: { label: 'Aviso', variant: 'warning' },
  partial: { label: 'Parcial', variant: 'warning' },
  pending: { label: 'Pendente', variant: 'secondary' },
  pendente: { label: 'Pendente', variant: 'secondary' }
};

const formatarData = (valor) => {
  if (!valor) {
    return '—';
  }
  try {
    return new Date(valor).toLocaleString('pt-BR');
  } catch {
    return valor;
  }
};

const montarBadgeStatus = (registro) => {
  const statusRaw =
    registro.status ??
    registro.resultado ??
    (registro.sucesso === false
      ? 'erro'
      : registro.sucesso === true
      ? 'sucesso'
      : undefined);

  if (!statusRaw) {
    return <Badge bg="secondary">Desconhecido</Badge>;
  }

  const texto = statusRaw.toString().toLowerCase();

  for (const [chave, config] of Object.entries(STATUS_MAP)) {
    if (texto.includes(chave)) {
      return <Badge bg={config.variant}>{config.label}</Badge>;
    }
  }

  return <Badge bg="info">{texto}</Badge>;
};

const extrairListaHistorico = (response) => {
  const payload = response?.data?.data ?? response?.data;

  if (!payload) {
    return { registros: [], total: 0 };
  }

  if (Array.isArray(payload)) {
    return { registros: payload, total: payload.length };
  }

  const lista =
    payload.historico ??
    payload.items ??
    payload.registros ??
    payload.rows ??
    payload.lista ??
    payload.data;

  if (Array.isArray(lista)) {
    const totalEstimado =
      Number(
        payload.total ??
          payload.count ??
          payload.paginacao?.total ??
          lista.length
      ) || lista.length;
    return { registros: lista, total: totalEstimado };
  }

  const totalEstimado =
    Number(
      payload.total ??
        payload.count ??
        payload.paginacao?.total ??
        payload.length ??
        0
    ) || 0;
  return { registros: [], total: totalEstimado };
};

const getOrigemLabel = (origem) => {
  if (!origem) {
    return '—';
  }
  const chave = origem.toString().toLowerCase();
  return ORIGEM_LABELS[chave] ?? origem;
};

export default function HistoricoSincronizacoes({ tenantId }) {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [origem, setOrigem] = useState('');
  const [sku, setSku] = useState('');
  const [skuBusca, setSkuBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);
  const [detalheAberto, setDetalheAberto] = useState(null);

  const filtros = useMemo(
    () => ({
      ...(dataInicio ? { dataInicio } : {}),
      ...(dataFim ? { dataFim } : {}),
      ...(origem ? { origem } : {}),
      ...(sku ? { sku } : {}),
      limit: limite,
      skip: Math.max(0, (pagina - 1) * limite)
    }),
    [dataInicio, dataFim, origem, sku, limite, pagina]
  );

  const {
    data: historicoResponse,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery(
    [
      'historico-sincronizacao',
      tenantId,
      dataInicio,
      dataFim,
      origem,
      sku,
      pagina,
      limite
    ],
    () => sincronizacaoApi.obterHistoricoSincronizacoes(tenantId, filtros),
    {
      enabled: !!tenantId,
      keepPreviousData: true,
      staleTime: 30000
    }
  );

  const { registros, total } = useMemo(
    () => extrairListaHistorico(historicoResponse),
    [historicoResponse]
  );

  const totalPaginas = Math.max(
    1,
    Math.ceil((total || registros.length) / Math.max(1, limite))
  );
  const paginaAtual = Math.min(pagina, totalPaginas);

  // Resetar página quando filtros mudam
  useEffect(() => {
    setPagina(1);
  }, [dataInicio, dataFim, origem, sku, limite]);

  // Garantir que não passemos da última página
  useEffect(() => {
    if (pagina > totalPaginas) {
      setPagina(totalPaginas);
    }
  }, [pagina, totalPaginas]);

  // Fechar detalhes quando a lista for atualizada
  useEffect(() => {
    setDetalheAberto(null);
  }, [registros]);

  const handleAplicarFiltroDatas = (inicio, fim) => {
    setDataInicio(inicio);
    setDataFim(fim);
  };

  const handleBuscarSku = () => {
    setSku(skuBusca.trim());
  };

  const handleLimparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setOrigem('');
    setSku('');
    setSkuBusca('');
  };

  const handleDetalheToggle = (identificador) => {
    setDetalheAberto((prev) => (prev === identificador ? null : identificador));
  };

  const registrosVisiveis = registros || [];
  const exibindoTotal = registrosVisiveis.length;

  const renderDetalhe = (registro) => {
    const produto =
      registro.sku ||
      registro.produtoId ||
      registro.produto ||
      registro.codigo ||
      '—';
    const conta =
      registro.conta ||
      registro.deposito ||
      registro.nomeConta ||
      registro.contaBlingId ||
      '—';
    const origemFmt = getOrigemLabel(registro.origem || registro.tipo || registro.modo);
    const eventoId = registro.eventoId || registro.evento || registro.idEvento || '—';
    const depositoOrigem = registro.depositoOrigem || registro.depositoId || registro.depositId || '—';
    const quantidade = registro.soma ?? registro.quantidade ?? registro.qtd ?? '—';
    const chaveUnica = registro.chaveUnica || registro.id || '—';
    const mensagem =
      registro.mensagem ||
      registro.resumo ||
      registro.descricao ||
      (registro.sucesso === false ? 'Erro ao processar' : 'Processado');
    const compartilhados = Array.isArray(registro.compartilhadosAtualizados)
      ? registro.compartilhadosAtualizados
      : [];
    const debug = registro.debugInfo || {};

    return (
      <div>
        <ListGroup variant="flush" className="mb-2">
          <ListGroup.Item>
            <strong>Produto:</strong> {produto}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Origem:</strong> {origemFmt}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Conta/Depósito:</strong> {conta} | Depósito origem: {depositoOrigem}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Quantidade aplicada:</strong> {quantidade}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Evento ID:</strong> {eventoId}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Chave idempotente:</strong> {chaveUnica}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Mensagem:</strong> {mensagem}
          </ListGroup.Item>
        </ListGroup>
        {compartilhados.length > 0 && (
          <div className="mt-2">
            <strong>Depósitos compartilhados atualizados_v1:</strong>
            <ul className="mb-0">
              {compartilhados.map((item, idx) => (
                <li key={idx}>
                  {item.nomeDeposito || item.depositoId || 'Depósito'} — qty {item.quantidade ?? 'n/a'} (base: {item.quantidadeBase ?? 'n/a'}, saldo: {item.saldoAtual ?? 'n/a'}, delta: {item.deltaAplicado ?? 'n/a'})
                  {item.erro ? ` — erro: ${item.erro}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        {debug && (debug.depositosCompartilhados || debug.contasAtivas) && (
          <div className="mt-2">
            <strong>Debug:</strong>
            <ul className="mb-0">
              {debug.quantidadeParaCompartilhado !== undefined && (
                <li>Qtd para compartilhados: {debug.quantidadeParaCompartilhado}</li>
              )}
              {debug.quantidadeBase !== undefined && (
                <li>Quantidade base: {debug.quantidadeBase}</li>
              )}
              {debug.eventoQuantidade !== undefined && debug.eventoQuantidade !== null && (
                <li>Quantidade do evento: {debug.eventoQuantidade}</li>
              )}
              {debug.eventoSaldoTotal !== undefined && debug.eventoSaldoTotal !== null && (
                <li>Saldo total (evento): {debug.eventoSaldoTotal}</li>
              )}
              {debug.eventoSaldoDeposito !== undefined && debug.eventoSaldoDeposito !== null && (
                <li>Saldo depósito (evento): {debug.eventoSaldoDeposito}</li>
              )}
              {debug.deltaAplicado !== undefined && (
                <li>Delta aplicado: {debug.deltaAplicado ?? 'n/a'}</li>
              )}
              {debug.fonteQuantidade && (
                <li>Fonte da quantidade: {debug.fonteQuantidade}</li>
              )}
              {debug.depositosCompartilhados && debug.depositosCompartilhados.length > 0 && (
                <li>Depósitos configurados: {debug.depositosCompartilhados.join(', ')}</li>
              )}
              {debug.contasAtivas && debug.contasAtivas.length > 0 && (
                <li>Contas ativas: {debug.contasAtivas.join(', ')}</li>
              )}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="mb-4">
      <Card.Header>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center">
            <ClockHistory className="me-2" />
            <h5 className="mb-0">Histórico de Sincronizações</h5>
          </div>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => refetch()}
          >
            <ArrowRepeat className="me-1" />
            Atualizar
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        {!tenantId && (
          <Alert variant="warning">
            Informe o tenant antes de consultar o histórico.
          </Alert>
        )}

        <FiltrosRapidosDias onFiltroAplicado={handleAplicarFiltroDatas} />

        <Form className="row g-2 mb-3">
          <div className="col-md-3">
            <Form.Label className="small mb-1">Data Início</Form.Label>
            <Form.Control
              type="date"
              value={dataInicio}
              max={dataFim || undefined}
              onChange={(event) => setDataInicio(event.target.value)}
              disabled={!tenantId}
            />
          </div>
          <div className="col-md-3">
            <Form.Label className="small mb-1">Data Fim</Form.Label>
            <Form.Control
              type="date"
              value={dataFim}
              min={dataInicio || undefined}
              onChange={(event) => setDataFim(event.target.value)}
              disabled={!tenantId}
            />
          </div>
          <div className="col-md-2">
            <Form.Label className="small mb-1">Origem</Form.Label>
            <Form.Select
              value={origem}
              onChange={(event) => setOrigem(event.target.value)}
              disabled={!tenantId}
            >
              <option value="">Todas</option>
              <option value="webhook">Webhook</option>
              <option value="manual">Manual</option>
              <option value="agendado">Agendado</option>
              <option value="compartilhado">Compartilhado</option>
            </Form.Select>
          </div>
          <div className="col-md-3">
            <Form.Label className="small mb-1">Produto ou SKU</Form.Label>
            <div className="input-group">
              <Form.Control
                type="text"
                placeholder="Digite para filtrar"
                value={skuBusca}
                onChange={(event) => setSkuBusca(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleBuscarSku();
                  }
                }}
                disabled={!tenantId}
              />
              <Button
                variant="outline-primary"
                onClick={handleBuscarSku}
                disabled={!tenantId}
              >
                Aplicar
              </Button>
            </div>
          </div>
          <div className="col-md-1 d-flex align-items-end">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleLimparFiltros}
              disabled={!tenantId}
              className="w-100"
            >
              Limpar
            </Button>
          </div>
        </Form>

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div className="d-flex align-items-center gap-2">
            <small className="text-muted">
              Mostrando {exibindoTotal} de {total || exibindoTotal} registros
            </small>
            <Form.Select
              size="sm"
              value={limite}
              onChange={(event) => setLimite(Number(event.target.value))}
              style={{ width: '110px' }}
              disabled={!tenantId}
            >
              <option value={10}>10 / página</option>
              <option value={20}>20 / página</option>
              <option value={50}>50 / página</option>
              <option value={100}>100 / página</option>
            </Form.Select>
          </div>
          <div className="d-flex gap-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setPagina((prev) => Math.max(1, prev - 1))}
              disabled={!tenantId || paginaAtual <= 1 || isLoading}
            >
              Anterior
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() =>
                setPagina((prev) => Math.min(totalPaginas, prev + 1))
              }
              disabled={!tenantId || paginaAtual >= totalPaginas || isLoading}
            >
              Próxima
            </Button>
            <small className="text-muted align-self-center">
              {paginaAtual} / {totalPaginas}
            </small>
          </div>
        </div>

        {isError && (
          <Alert variant="danger" className="mb-3">
            Falha ao carregar o histórico (
            {error?.mensagem || error?.message || 'erro desconhecido'}).{' '}
            <Button variant="link" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </Alert>
        )}

        <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
          <Table hover responsive size="sm">
            <thead>
              <tr>
                <th>Data</th>
                <th>Origem</th>
                <th>Produto / SKU</th>
                <th>Conta / Depósito</th>
                <th>Status</th>
                <th className="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && registrosVisiveis.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4">
                    <Spinner animation="border" size="sm" className="me-2" />
                    Carregando histórico...
                  </td>
                </tr>
              ) : registrosVisiveis.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center">
                    Nenhum histórico encontrado.
                  </td>
                </tr>
              ) : (
                registrosVisiveis.map((registro, index) => {
                  const identificador =
                    registro.id ||
                    registro._id ||
                    `${registro.produto || registro.sku || index}-${index}`;

                  const produto =
                    registro.produtoNome ||
                    registro.nomeProduto ||
                    registro.produto ||
                    registro.sku ||
                    '—';

                  const conta =
                    registro.conta ||
                    registro.deposito ||
                    registro.nomeConta ||
                    '—';

                  return (
                    <React.Fragment key={identificador}>
                      <tr>
                        <td>{formatarData(registro.data || registro.createdAt || registro.timestamp)}</td>
                        <td>{getOrigemLabel(registro.origem || registro.tipo || registro.modo)}</td>
                        <td>{produto}</td>
                        <td>{conta}</td>
                        <td>{montarBadgeStatus(registro)}</td>
                        <td className="text-end">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleDetalheToggle(identificador)}
                          >
                            {detalheAberto === identificador ? (
                              <>
                                <ChevronUp className="me-1" />
                                Ocultar
                              </>
                            ) : (
                              <>
                                <ChevronDown className="me-1" />
                                Detalhes
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="p-0 border-0">
                          <Collapse in={detalheAberto === identificador}>
                            <div className="p-3">
                              <strong className="d-block mb-2">Detalhes</strong>
                              {renderDetalhe(registro)}
                            </div>
                          </Collapse>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
}

import React, { useState } from 'react';
import { Card, Table, Form, Button, Badge, Spinner, Pagination, Alert } from 'react-bootstrap';
import { Clock, ChevronDown, ChevronUp } from 'react-bootstrap-icons';
import { sincronizacaoApi } from '../../services/sincronizacaoApi';
import { useQuery } from 'react-query';

export default function HistoricoSincronizacoes({ tenantId }) {
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    origem: '',
    sku: ''
  });
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);
  const [linhaExpandida, setLinhaExpandida] = useState(null);

  const { data: historicoResponse, isLoading, refetch } = useQuery(
    ['historico-sincronizacoes', tenantId, pagina, itensPorPagina, filtros],
    () => sincronizacaoApi.obterHistoricoSincronizacoes(tenantId, {
      limit: itensPorPagina,
      skip: (pagina - 1) * itensPorPagina,
      ...filtros
    }),
    {
      enabled: !!tenantId,
      select: (response) => {
        const payload = response.data?.data || {};
        const eventos = Array.isArray(payload.eventos)
          ? payload.eventos
          : Array.isArray(response.data?.eventos)
          ? response.data.eventos
          : Array.isArray(response.data)
          ? response.data
          : [];

        return {
          sincronizacoes: eventos,
          paginacao: payload.paginacao || response.data?.paginacao || {
            total: eventos.length,
            totalPaginas: Math.ceil(eventos.length / itensPorPagina) || 1
          }
        };
      }
    }
  );

  const historico = historicoResponse?.sincronizacoes || [];
  const paginacao = historicoResponse?.paginacao || {};
  const totalItens = paginacao.total ?? historico.length;
  const totalPaginas = (paginacao.totalPaginas ?? Math.ceil((totalItens || 0) / itensPorPagina)) || 1;

  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
    setPagina(1);
  };

  const handleLimparFiltros = () => {
    setFiltros({
      dataInicio: '',
      dataFim: '',
      origem: '',
      sku: ''
    });
    setPagina(1);
  };

  const toggleLinha = (id) => {
    setLinhaExpandida(linhaExpandida === id ? null : id);
  };

  const formatarData = (data) => {
    if (!data) return '-';
    try {
      return new Date(data).toLocaleString('pt-BR');
    } catch {
      return '-';
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header>
        <div className="d-flex align-items-center">
          <Clock className="me-2" />
          <h5 className="mb-0">Histórico de Sincronizações</h5>
        </div>
      </Card.Header>
      <Card.Body>
        {/* Filtros */}
        <div className="mb-3 p-3 bg-light rounded">
          <h6 className="mb-3">Filtros</h6>
          <div className="row g-2">
            <div className="col-md-3">
              <Form.Label className="small">Data Início</Form.Label>
              <Form.Control
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => handleFiltroChange('dataInicio', e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <Form.Label className="small">Data Fim</Form.Label>
              <Form.Control
                type="date"
                value={filtros.dataFim}
                onChange={(e) => handleFiltroChange('dataFim', e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <Form.Label className="small">Origem</Form.Label>
              <Form.Select
                value={filtros.origem}
                onChange={(e) => handleFiltroChange('origem', e.target.value)}
              >
                <option value="">Todas</option>
                <option value="webhook">Notificações Automáticas (Webhook)</option>
                <option value="cronjob">Cronjob</option>
                <option value="manual">Manual</option>
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label className="small">SKU</Form.Label>
              <Form.Control
                type="text"
                placeholder="Buscar por SKU"
                value={filtros.sku}
                onChange={(e) => handleFiltroChange('sku', e.target.value)}
              />
            </div>
            <div className="col-md-1 d-flex align-items-end">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleLimparFiltros}
                className="w-100"
              >
                Limpar
              </Button>
            </div>
          </div>
        </div>

        {/* Tabela */}
        {isLoading ? (
          <div className="text-center py-4">
            <Spinner animation="border" className="me-2" />
            <span>Carregando histórico...</span>
          </div>
        ) : historico.length === 0 ? (
          <Alert variant="info" className="mb-0">
            Nenhuma sincronização encontrada com os filtros aplicados.
          </Alert>
        ) : (
          <>
            <div className="mb-2">
              <small className="text-muted">
                Total: {totalItens} sincronização(ões) | Página {pagina} de {totalPaginas}
              </small>
            </div>

            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th style={{ width: '3%' }}></th>
                  <th>Data/Hora</th>
                  <th>Origem</th>
                  <th>SKU</th>
                  <th>Status</th>
                  <th>Produtos Processados</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((item) => {
                  const isExpanded = linhaExpandida === item._id || linhaExpandida === item.id;
                  return (
                    <React.Fragment key={item._id || item.id}>
                      <tr>
                        <td>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => toggleLinha(item._id || item.id)}
                            className="p-0"
                          >
                            {isExpanded ? <ChevronUp /> : <ChevronDown />}
                          </Button>
                        </td>
                        <td>{formatarData(item.processadoEm || item.dataHora || item.criadoEm || item.createdAt)}</td>
                        <td>
                          <Badge bg={
                            item.origem === 'webhook' ? 'primary' :
                            item.origem === 'cronjob' ? 'info' : 'secondary'
                          }>
                            {item.origem === 'webhook' ? 'Notificações Automáticas (Webhook)' :
                             item.origem === 'cronjob' ? 'Cronjob' : 
                             item.origem || 'Manual'}
                          </Badge>
                        </td>
                        <td>{item.produtoId || item.sku || '-'}</td>
                        <td>
                          <Badge bg={(item.sucesso !== undefined ? item.sucesso : item.status === 'sucesso') ? 'success' : 'danger'}>
                            {(item.sucesso !== undefined ? item.sucesso : item.status === 'sucesso') ? 'Sucesso' : 'Erro'}
                          </Badge>
                        </td>
                        <td>{item.produtosProcessados || item.totalProcessado || 1}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-3 bg-light">
                            <div className="small">
                              <div className="mb-2">
                                <strong>Detalhes:</strong>
                              </div>
                              {item.produtoId && (
                                <div className="mb-1">
                                  <strong>Produto ID:</strong> {item.produtoId}
                                </div>
                              )}
                              {item.eventoId && (
                                <div className="mb-1">
                                  <strong>Evento ID:</strong> {item.eventoId}
                                </div>
                              )}
                              {item.depositoOrigem && (
                                <div className="mb-1">
                                  <strong>Depósito Origem:</strong> {item.depositoOrigem}
                                </div>
                              )}
                              {item.blingAccountId && (
                                <div className="mb-1">
                                  <strong>Conta Bling:</strong> {item.blingAccountId}
                                </div>
                              )}
                              {item.saldos && Object.keys(item.saldos).length > 0 && (
                                <div className="mb-1">
                                  <strong>Saldos:</strong>
                                  <pre className="small bg-white p-2 border rounded mt-1">
                                    {JSON.stringify(item.saldos, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {item.compartilhadosAtualizados && Object.keys(item.compartilhadosAtualizados).length > 0 && (
                                <div className="mb-1">
                                  <strong>Depósitos Compartilhados Atualizados:</strong>
                                  <pre className="small bg-white p-2 border rounded mt-1">
                                    {JSON.stringify(item.compartilhadosAtualizados, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {item.erro && (
                                <div className="mb-1 text-danger">
                                  <strong>Erro:</strong> {item.erro}
                                </div>
                              )}
                              {item.mensagem && (
                                <div className="mb-1">
                                  <strong>Mensagem:</strong> {item.mensagem}
                                </div>
                              )}
                              {item.detalhes && (
                                <div className="mb-1">
                                  <strong>Detalhes:</strong>
                                  <pre className="small bg-white p-2 border rounded mt-1">
                                    {JSON.stringify(item.detalhes, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </Table>

            {/* Paginação */}
            {totalPaginas > 1 && (
              <div className="d-flex justify-content-between align-items-center mt-3">
                <div>
                  <Form.Select
                    value={itensPorPagina}
                    onChange={(e) => {
                      setItensPorPagina(parseInt(e.target.value));
                      setPagina(1);
                    }}
                    style={{ width: 'auto', display: 'inline-block' }}
                    size="sm"
                  >
                    <option value={10}>10 por página</option>
                    <option value={20}>20 por página</option>
                    <option value={50}>50 por página</option>
                    <option value={100}>100 por página</option>
                  </Form.Select>
                </div>
                <Pagination>
                  <Pagination.First
                    onClick={() => setPagina(1)}
                    disabled={pagina === 1}
                  />
                  <Pagination.Prev
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                  />
                  {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                    let numPagina;
                    if (totalPaginas <= 5) {
                      numPagina = i + 1;
                    } else if (pagina <= 3) {
                      numPagina = i + 1;
                    } else if (pagina >= totalPaginas - 2) {
                      numPagina = totalPaginas - 4 + i;
                    } else {
                      numPagina = pagina - 2 + i;
                    }
                    return (
                      <Pagination.Item
                        key={numPagina}
                        active={numPagina === pagina}
                        onClick={() => setPagina(numPagina)}
                      >
                        {numPagina}
                      </Pagination.Item>
                    );
                  })}
                  <Pagination.Next
                    onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                    disabled={pagina === totalPaginas}
                  />
                  <Pagination.Last
                    onClick={() => setPagina(totalPaginas)}
                    disabled={pagina === totalPaginas}
                  />
                </Pagination>
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}


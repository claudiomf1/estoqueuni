import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Table, Badge, Spinner, Alert } from 'react-bootstrap';
import { FileEarmarkText, Download, Search } from 'react-bootstrap-icons';
import { sincronizacaoApi } from '../../services/sincronizacaoApi';
import { useQuery } from 'react-query';

export default function LogsMonitoramento({ tenantId }) {
  const [busca, setBusca] = useState('');
  const [nivel, setNivel] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [limite, setLimite] = useState(100);

  const { data: logsResponse, isLoading, refetch } = useQuery(
    ['logs-monitoramento', tenantId, busca, nivel, limite],
    () => sincronizacaoApi.obterLogs(tenantId, {
      limit: limite,
      busca: busca || undefined,
      nivel: nivel || undefined
    }),
    {
      enabled: !!tenantId,
      refetchInterval: autoRefresh ? 5000 : false,
      select: (response) => response.data?.data || response.data?.logs || []
    }
  );

  const logs = logsResponse || [];

  const handleExportar = async () => {
    try {
      const response = await sincronizacaoApi.exportarLogs(tenantId, {
        busca: busca || undefined,
        nivel: nivel || undefined
      });

      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `logs-sincronizacao-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao exportar logs: ' + (err.mensagem || err.message || 'Erro desconhecido'));
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    try {
      return new Date(data).toLocaleString('pt-BR');
    } catch {
      return '-';
    }
  };

  const getNivelBadge = (nivelLog) => {
    const nivelLower = (nivelLog || '').toLowerCase();
    if (nivelLower === 'error' || nivelLower === 'erro') {
      return <Badge bg="danger">ERRO</Badge>;
    } else if (nivelLower === 'warn' || nivelLower === 'warning' || nivelLower === 'aviso') {
      return <Badge bg="warning">AVISO</Badge>;
    } else if (nivelLower === 'info' || nivelLower === 'informação') {
      return <Badge bg="info">INFO</Badge>;
    } else {
      return <Badge bg="secondary">DEBUG</Badge>;
    }
  };

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refetch();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refetch]);

  return (
    <Card className="mb-4">
      <Card.Header>
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <FileEarmarkText className="me-2" />
            <h5 className="mb-0">Logs e Monitoramento</h5>
          </div>
          <div>
            <Button
              variant={autoRefresh ? 'success' : 'outline-success'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="me-2"
            >
              {autoRefresh ? '⏸️ Pausar' : '▶️ Auto-refresh'}
            </Button>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleExportar}
            >
              <Download className="me-1" />
              Exportar
            </Button>
          </div>
        </div>
      </Card.Header>
      <Card.Body>
        {/* Filtros */}
        <div className="mb-3 p-3 bg-light rounded">
          <div className="row g-2">
            <div className="col-md-4">
              <Form.Label className="small">Buscar nos Logs</Form.Label>
              <div className="input-group">
                <Form.Control
                  type="text"
                  placeholder="Digite para buscar..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                <Button variant="outline-secondary" disabled>
                  <Search />
                </Button>
              </div>
            </div>
            <div className="col-md-3">
              <Form.Label className="small">Nível</Form.Label>
              <Form.Select
                value={nivel}
                onChange={(e) => setNivel(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="error">Erro</option>
                <option value="warn">Aviso</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label className="small">Limite de Registros</Form.Label>
              <Form.Select
                value={limite}
                onChange={(e) => setLimite(parseInt(e.target.value))}
              >
                <option value={50}>50 registros</option>
                <option value={100}>100 registros</option>
                <option value={200}>200 registros</option>
                <option value={500}>500 registros</option>
              </Form.Select>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  setBusca('');
                  setNivel('');
                  setLimite(100);
                }}
                className="w-100"
              >
                Limpar
              </Button>
            </div>
          </div>
        </div>

        {/* Tabela de Logs */}
        {isLoading ? (
          <div className="text-center py-4">
            <Spinner animation="border" className="me-2" />
            <span>Carregando logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <Alert variant="info" className="mb-0">
            Nenhum log encontrado com os filtros aplicados.
          </Alert>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <Table striped bordered hover size="sm">
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                <tr>
                  <th style={{ width: '15%' }}>Data/Hora</th>
                  <th style={{ width: '8%' }}>Nível</th>
                  <th style={{ width: '77%' }}>Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={log._id || log.id || index}>
                    <td className="small">{formatarData(log.dataHora || log.timestamp || log.criadoEm)}</td>
                    <td>{getNivelBadge(log.nivel || log.level)}</td>
                    <td className="small" style={{ 
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {log.mensagem || log.message || JSON.stringify(log.dados || log.data || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        {autoRefresh && (
          <div className="mt-2">
            <small className="text-muted">
              ⏱️ Atualização automática a cada 5 segundos
            </small>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}



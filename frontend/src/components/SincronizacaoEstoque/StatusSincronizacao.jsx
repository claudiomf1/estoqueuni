import React, { useState } from 'react';
import { Card, Badge, Spinner, Row, Col, Button, OverlayTrigger, Tooltip, Alert, Modal } from 'react-bootstrap';
import { CheckCircle, XCircle, Clock, Activity, PauseFill, PlayFill, ArrowClockwise, Trash } from 'react-bootstrap-icons';
import { sincronizacaoApi } from '../../services/sincronizacaoApi';
import { useTenant } from '../../context/TenantContext';

export default function StatusSincronizacao({ status, isLoading, pollingAtivo, onTogglePolling, onRefreshManual, statusChecklist }) {
  const { tenantId } = useTenant();
  const [mostrarModalConfirmacao, setMostrarModalConfirmacao] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [mensagemLimpeza, setMensagemLimpeza] = useState(null);
  const [erroLimpeza, setErroLimpeza] = useState(null);
  if (isLoading && !status) {
    return (
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Status da Sincronização</h5>
          <div className="d-flex gap-2">
            {onRefreshManual && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={onRefreshManual}
                disabled={isLoading}
                title="Atualizar agora"
              >
                <ArrowClockwise className={isLoading ? 'spinning' : ''} />
              </Button>
            )}
            {onTogglePolling && (
              <Button
                variant={pollingAtivo ? 'warning' : 'success'}
                size="sm"
                onClick={onTogglePolling}
                title={pollingAtivo ? 'Pausar atualização automática' : 'Retomar atualização automática'}
              >
                {pollingAtivo ? (
                  <>
                    <PauseFill className="me-1" />
                    Pausar
                  </>
                ) : (
                  <>
                    <PlayFill className="me-1" />
                    Retomar
                  </>
                )}
              </Button>
            )}
          </div>
        </Card.Header>
        <Card.Body className="text-center">
          <Spinner animation="border" className="me-2" />
          <span>Carregando status...</span>
        </Card.Body>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Status da Sincronização</h5>
        </Card.Header>
        <Card.Body>
          <div className="alert alert-warning mb-0">
            Nenhum status disponível. Configure a sincronização para começar.
          </div>
        </Card.Body>
      </Card>
    );
  }

  const formatarData = (data) => {
    if (!data) return 'Nunca';
    try {
      return new Date(data).toLocaleString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  const renderTooltipConteudo = () => (
    <Tooltip id="status-geral-tooltip">
      {statusChecklist ? (
        <div className="small">
          <div className="fw-bold mb-1">{statusChecklist.titulo}</div>
          {statusChecklist.itens && statusChecklist.itens.length > 0 ? (
            <ul className="mb-0 ps-3">
              {statusChecklist.itens.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : (
            <div>Todos os requisitos foram atendidos.</div>
          )}
        </div>
      ) : (
        'Status detectado automaticamente baseado na configuração completa'
      )}
    </Tooltip>
  );

  const handleLimparEstatisticas = async () => {
    setLimpando(true);
    setMensagemLimpeza(null);
    setErroLimpeza(null);

    try {
      const response = await sincronizacaoApi.limparEstatisticas(tenantId);
      
      if (response.data?.success) {
        setMensagemLimpeza(response.data.message || 'Estatísticas limpas com sucesso!');
        setMostrarModalConfirmacao(false);
        
        // Atualizar o status após limpar
        if (onRefreshManual) {
          setTimeout(() => {
            onRefreshManual();
          }, 500);
        }

        // Limpar mensagem após 5 segundos
        setTimeout(() => {
          setMensagemLimpeza(null);
        }, 5000);
      } else {
        throw new Error(response.data?.message || 'Erro ao limpar estatísticas');
      }
    } catch (error) {
      console.error('[StatusSincronizacao] Erro ao limpar estatísticas:', error);
      setErroLimpeza(error.mensagem || error.message || 'Erro ao limpar estatísticas');
      
      // Limpar erro após 5 segundos
      setTimeout(() => {
        setErroLimpeza(null);
      }, 5000);
    } finally {
      setLimpando(false);
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-3">
          <h5 className="mb-0">Status da Sincronização</h5>
          <div className="d-flex align-items-center gap-2">
            {status.ativo ? (
              <CheckCircle size={20} className="text-success" />
            ) : (
              <XCircle size={20} className="text-danger" />
            )}
            <div className="d-flex align-items-center gap-1">
              <span className="text-muted small">Status Geral:</span>
              <OverlayTrigger
                placement="top"
                overlay={renderTooltipConteudo()}
              >
                <Badge bg={status.ativo ? 'success' : 'secondary'} style={{ cursor: 'help' }}>
                  {status.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </OverlayTrigger>
            </div>
          </div>
          {pollingAtivo === false && (
            <Badge bg="secondary" className="ms-2">
              <PauseFill size={12} className="me-1" />
              Atualização pausada
            </Badge>
          )}
        </div>
        <div className="d-flex gap-2">
          {onRefreshManual && (
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={onRefreshManual}
              disabled={isLoading}
              title="Atualizar agora"
            >
              <ArrowClockwise className={isLoading ? 'spinning' : ''} />
            </Button>
          )}
          {onTogglePolling && (
            <Button
              variant={pollingAtivo ? 'warning' : 'success'}
              size="sm"
              onClick={onTogglePolling}
              title={pollingAtivo ? 'Pausar atualização automática' : 'Retomar atualização automática'}
            >
              {pollingAtivo ? (
                <>
                  <PauseFill className="me-1" />
                  Pausar
                </>
              ) : (
                <>
                  <PlayFill className="me-1" />
                  Retomar
                </>
              )}
            </Button>
          )}
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip id="limpar-estatisticas-tooltip">
                Limpar todas as estatísticas de sincronização (Total Sincronizado, Sucessos, Erros)
              </Tooltip>
            }
          >
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => setMostrarModalConfirmacao(true)}
              disabled={isLoading || limpando}
              title="Limpar estatísticas"
            >
              {limpando ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-1" />
                  Limpando...
                </>
              ) : (
                <>
                  <Trash className="me-1" />
                  Limpar Estatísticas
                </>
              )}
            </Button>
          </OverlayTrigger>
        </div>
      </Card.Header>
      <Card.Body>
        {/* Mensagens de feedback */}
        {mensagemLimpeza && (
          <Alert variant="success" className="py-2 mb-3" dismissible onClose={() => setMensagemLimpeza(null)}>
            {mensagemLimpeza}
          </Alert>
        )}
        {erroLimpeza && (
          <Alert variant="danger" className="py-2 mb-3" dismissible onClose={() => setErroLimpeza(null)}>
            {erroLimpeza}
          </Alert>
        )}

        <Row>
          <Col md={3} className="mb-2">
            <div className="d-flex align-items-center">
              <Activity className="me-2 text-primary" />
              <div>
                <div className="fw-bold">Total Sincronizado</div>
                <div className="h4 mb-0">{status.totalSincronizado || 0}</div>
                <small className="text-muted">produtos</small>
              </div>
            </div>
          </Col>

          <Col md={3} className="mb-2">
            <div className="d-flex align-items-center">
              <CheckCircle className="me-2 text-success" />
              <div>
                <div className="fw-bold">Sucessos</div>
                <div className="h4 mb-0">{status.totalSucesso || 0}</div>
                <small className="text-muted">operações</small>
              </div>
            </div>
          </Col>

          <Col md={3} className="mb-2">
            <div className="d-flex align-items-center">
              <XCircle className="me-2 text-danger" />
              <div>
                <div className="fw-bold">Erros</div>
                <div className="h4 mb-0">{status.totalErros || 0}</div>
                <small className="text-muted">operações</small>
              </div>
            </div>
          </Col>

          <Col md={3} className="mb-2">
            <div className="d-flex align-items-center">
              <Clock className="me-2 text-warning" />
              <div>
                <div className="fw-bold">Pendentes</div>
                <div className="h4 mb-0">{status.totalPendentes || 0}</div>
                <small className="text-muted">operações</small>
              </div>
            </div>
          </Col>
        </Row>
      </Card.Body>

      {/* Modal de confirmação */}
      <Modal show={mostrarModalConfirmacao} onHide={() => setMostrarModalConfirmacao(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar Limpeza de Estatísticas</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Tem certeza que deseja limpar todas as estatísticas de sincronização?
          </p>
          <p className="text-muted small mb-0">
            Esta ação irá remover permanentemente todos os registros de eventos processados, 
            incluindo o histórico de sincronizações (Total Sincronizado, Sucessos, Erros).
            Esta ação não pode ser desfeita.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setMostrarModalConfirmacao(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleLimparEstatisticas} disabled={limpando}>
            {limpando ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Limpando...
              </>
            ) : (
              <>
                <Trash className="me-2" />
                Sim, Limpar Estatísticas
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}



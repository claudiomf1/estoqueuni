import React, { useState } from 'react';
import { Card, Form, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import { Clock, CheckCircle, XCircle } from 'react-bootstrap-icons';
import { sincronizacaoApi } from '../../services/sincronizacaoApi';
import { useQuery } from 'react-query';

export default function ConfiguracaoCronjob({ tenantId }) {
  const [ativo, setAtivo] = useState(false);
  const [intervaloMinutos, setIntervaloMinutos] = useState(60);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [erro, setErro] = useState(null);

  const { data: configResponse, isLoading, refetch } = useQuery(
    ['cronjob-config', tenantId],
    () => sincronizacaoApi.obterConfiguracaoCronjob(tenantId),
    {
      enabled: !!tenantId,
      select: (response) => response.data?.data || response.data,
      onSuccess: (data) => {
        if (data) {
          setAtivo(data.ativo || false);
          setIntervaloMinutos(data.intervaloMinutos || 60);
        }
      }
    }
  );

  const config = configResponse || {};

  const handleSalvar = async () => {
    setErro(null);
    setMensagem(null);

    if (intervaloMinutos < 1) {
      setErro('O intervalo deve ser de pelo menos 1 minuto.');
      return;
    }

    setSalvando(true);

    try {
      const response = await sincronizacaoApi.atualizarConfiguracaoCronjob(tenantId, {
        ativo,
        intervaloMinutos
      });

      if (response.data?.success !== false) {
        setMensagem('Configuração do cronjob salva com sucesso!');
        refetch();
        setTimeout(() => setMensagem(null), 5000);
      } else {
        throw new Error(response.data?.message || 'Erro ao salvar configuração');
      }
    } catch (err) {
      setErro(err.mensagem || err.message || 'Erro ao salvar configuração do cronjob');
      setTimeout(() => setErro(null), 7000);
    } finally {
      setSalvando(false);
    }
  };

  const formatarData = (data) => {
    if (!data) return 'Nunca';
    try {
      return new Date(data).toLocaleString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  const calcularProximaExecucao = () => {
    if (!config.ultimaExecucao || !ativo) return null;
    try {
      const ultima = new Date(config.ultimaExecucao);
      const proxima = new Date(ultima.getTime() + intervaloMinutos * 60000);
      return proxima;
    } catch {
      return null;
    }
  };

  const proximaExecucao = calcularProximaExecucao();

  if (isLoading) {
    return (
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Configuração de Cronjob</h5>
        </Card.Header>
        <Card.Body className="text-center">
          <Spinner animation="border" className="me-2" />
          <span>Carregando configuração...</span>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <Card.Header>
        <div className="d-flex align-items-center">
          <Clock className="me-2" />
          <h5 className="mb-0">Configuração de Cronjob</h5>
        </div>
      </Card.Header>
      <Card.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Check
              type="switch"
              id="cronjob-ativo"
              label="Ativar Sincronização Automática"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              disabled={salvando}
            />
            <Form.Text className="text-muted">
              Quando ativado, o sistema sincroniza automaticamente em intervalos regulares
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Intervalo de Execução (minutos)</Form.Label>
            <Form.Control
              type="number"
              min="1"
              max="1440"
              value={intervaloMinutos}
              onChange={(e) => setIntervaloMinutos(parseInt(e.target.value) || 60)}
              disabled={salvando || !ativo}
            />
            <Form.Text className="text-muted">
              Intervalo mínimo: 1 minuto | Máximo: 1440 minutos (24 horas)
            </Form.Text>
          </Form.Group>
        </Form>

        <hr />

        <div className="mb-3">
          <div className="row">
            <div className="col-md-6 mb-2">
              <div className="fw-bold">Status Atual:</div>
              <div>
                {ativo ? (
                  <>
                    <CheckCircle className="text-success me-2" />
                    <Badge bg="success">Ativo</Badge>
                  </>
                ) : (
                  <>
                    <XCircle className="text-secondary me-2" />
                    <Badge bg="secondary">Inativo</Badge>
                  </>
                )}
              </div>
            </div>

            <div className="col-md-6 mb-2">
              <div className="fw-bold">Última Execução:</div>
              <div>{formatarData(config.ultimaExecucao)}</div>
            </div>

            {proximaExecucao && (
              <div className="col-md-6 mb-2">
                <div className="fw-bold">Próxima Execução:</div>
                <div>{formatarData(proximaExecucao)}</div>
              </div>
            )}

            <div className="col-md-6 mb-2">
              <div className="fw-bold">Total de Execuções:</div>
              <div>{config.totalExecucoes || 0}</div>
            </div>

            <div className="col-md-6 mb-2">
              <div className="fw-bold">Execuções com Sucesso:</div>
              <div className="text-success">{config.execucoesSucesso || 0}</div>
            </div>

            <div className="col-md-6 mb-2">
              <div className="fw-bold">Execuções com Erro:</div>
              <div className="text-danger">{config.execucoesErro || 0}</div>
            </div>
          </div>
        </div>

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
            disabled={salvando}
          >
            {salvando ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Salvando...
              </>
            ) : (
              <>
                <Clock className="me-2" />
                Salvar Configuração
              </>
            )}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}



// frontend/src/components/RelatorioVerificacaoProdutos.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Modal,
  Button,
  Spinner,
  Badge,
  Alert,
  FormControl,
  ProgressBar,
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap';
import { XCircle, ExclamationTriangle, ArrowDownCircle } from 'react-bootstrap-icons';
import { produtoApi } from '../services/produtoApi';

function RelatorioVerificacaoProdutos({ tenantId, show, onHide }) {
  const [refetchKey, setRefetchKey] = useState(0);
  const [limitesImportacao, setLimitesImportacao] = useState({});
  const [progressoImportacao, setProgressoImportacao] = useState({});
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery(
    ['verificacao-produtos', tenantId, refetchKey],
    () => produtoApi.verificarProdutos(tenantId),
    {
      enabled: show && !!tenantId,
      refetchOnWindowFocus: false,
      retry: 1
    }
  );

  const importarMutation = useMutation(
    ({ blingAccountId, limite }) => produtoApi.importarProdutos(tenantId, blingAccountId, limite),
    {
      onSuccess: () => {
        // Invalidar queries para atualizar dados
        queryClient.invalidateQueries(['verificacao-produtos', tenantId]);
        queryClient.invalidateQueries(['produtos-estoque', tenantId]);
        // Atualizar relatório
        setRefetchKey(prev => prev + 1);
        refetch();
      }
    }
  );

  const handleAtualizar = () => {
    setRefetchKey(prev => prev + 1);
    refetch();
  };

  const handleImportar = async (conta) => {
    const limite = limitesImportacao[conta.blingAccountId] 
      ? parseInt(limitesImportacao[conta.blingAccountId]) 
      : null;

    // Validar limite se informado
    if (limite !== null && (isNaN(limite) || limite <= 0)) {
      alert('Por favor, informe um número válido para o limite de produtos.');
      return;
    }

    // Iniciar progresso
    setProgressoImportacao(prev => ({
      ...prev,
      [conta.blingAccountId]: { progresso: 0, importando: true }
    }));

    try {
      // Simular progresso durante a importação
      const intervaloProgresso = setInterval(() => {
        setProgressoImportacao(prev => {
          const atual = prev[conta.blingAccountId];
          if (atual && atual.importando) {
            const novoProgresso = Math.min(atual.progresso + 5, 90);
            return {
              ...prev,
              [conta.blingAccountId]: { ...atual, progresso: novoProgresso }
            };
          }
          return prev;
        });
      }, 500);

      const resultado = await importarMutation.mutateAsync({
        blingAccountId: conta.blingAccountId,
        limite
      });

      clearInterval(intervaloProgresso);

      // Completar progresso
      setProgressoImportacao(prev => ({
        ...prev,
        [conta.blingAccountId]: { progresso: 100, importando: false }
      }));

      // Limpar progresso após 2 segundos
      setTimeout(() => {
        setProgressoImportacao(prev => {
          const novo = { ...prev };
          delete novo[conta.blingAccountId];
          return novo;
        });
      }, 2000);

      alert(`✅ ${resultado.data?.data?.totalImportados || 0} produto(s) importado(s) com sucesso!`);
    } catch (err) {
      setProgressoImportacao(prev => ({
        ...prev,
        [conta.blingAccountId]: { progresso: 0, importando: false }
      }));
      alert(`❌ Erro ao importar produtos: ${err?.response?.data?.error || err.message || 'Erro desconhecido'}`);
    }
  };

  const verificacao = data?.data?.data || {};
  const todasContas = verificacao.contas || [];
  
  // Filtrar contas ativas (mesma lógica do badge: isActive !== false)
  const contas = todasContas.filter(conta => {
    return conta.isActive !== false && conta.is_active !== false;
  });

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Relatório de Verificação de Produtos</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {isLoading && (
          <div className="text-center py-4">
            <Spinner animation="border" role="status" className="me-2" />
            <span>Verificando produtos...</span>
          </div>
        )}

        {isError && (
          <Alert variant="danger">
            <ExclamationTriangle className="me-2" />
            Erro ao verificar produtos: {error?.message || 'Erro desconhecido'}
          </Alert>
        )}

        {!isLoading && !isError && verificacao && (
          <>
            {contas.length > 0 ? (
              <div>
                {contas.map((conta) => {
                  const progresso = progressoImportacao[conta.blingAccountId];
                  const estaImportando = progresso?.importando || false;
                  const limiteAtual = limitesImportacao[conta.blingAccountId] || '';

                  return (
                    <div key={conta.blingAccountId} className="mb-3">
                      <div className="p-3 border rounded">
                        {/* Linha principal com dados da conta */}
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <div className="d-flex align-items-center">
                            <strong className="me-2">{conta.accountName}</strong>
                            <span className="text-muted me-2">-</span>
                            <span className="me-2">Bling</span>
                            <Badge bg="info">{conta.totalProdutosBling || 0}</Badge>
                            {conta.status === 'erro' && (
                              <XCircle className="text-danger ms-2" size={18} />
                            )}
                          </div>
                          <div className="d-flex align-items-center">
                            <span className="me-2">EstoqueUni</span>
                            <Badge bg="success">
                              {conta.totalProdutosEstoqueUni || 0}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Controles de Importação */}
                        <div className="d-flex align-items-center gap-2">
                          <OverlayTrigger
                            placement="top"
                            overlay={
                              <Tooltip id={`tooltip-limite-${conta.blingAccountId}`}>
                                Deixe vazio para importar todos os produtos do Bling que ainda não estão no EstoqueUni
                              </Tooltip>
                            }
                          >
                            <FormControl
                              type="number"
                              placeholder="Limite (vazio = todos)"
                              value={limiteAtual}
                              onChange={(e) => {
                                setLimitesImportacao(prev => ({
                                  ...prev,
                                  [conta.blingAccountId]: e.target.value
                                }));
                              }}
                              disabled={estaImportando}
                              style={{ width: '180px' }}
                              min="1"
                            />
                          </OverlayTrigger>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleImportar(conta)}
                            disabled={estaImportando || conta.status === 'erro'}
                          >
                            {estaImportando ? (
                              <>
                                <Spinner
                                  as="span"
                                  animation="border"
                                  size="sm"
                                  className="me-2"
                                />
                                Importando...
                              </>
                            ) : (
                              <>
                                <ArrowDownCircle className="me-2" />
                                Atualizar no EstoqueUni
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Barra de Progresso */}
                        {progresso && progresso.importando && (
                          <div className="mt-2">
                            <ProgressBar
                              now={progresso.progresso}
                              label={`${progresso.progresso}%`}
                              animated
                              striped
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Alertas */}
                {contas.some(c => c.status === 'erro') && (
                  <Alert variant="danger" className="mt-3">
                    <XCircle className="me-2" />
                    Algumas contas apresentaram erros durante a verificação.
                    Verifique as configurações das contas Bling.
                  </Alert>
                )}
              </div>
            ) : (
              <Alert variant="info">
                Nenhuma conta Bling ativa encontrada para este tenant.
              </Alert>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Fechar
        </Button>
        <Button variant="primary" onClick={handleAtualizar} disabled={isLoading}>
          {isLoading ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                className="me-2"
              />
              Atualizando...
            </>
          ) : (
            'Atualizar Relatório'
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default RelatorioVerificacaoProdutos;


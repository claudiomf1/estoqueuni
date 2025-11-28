// frontend/src/components/SincronizacaoEstoque.jsx
import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Button,
  FormControl,
  Alert,
  Spinner,
  ProgressBar,
  Table,
  OverlayTrigger,
  Tooltip,
  FormSelect,
  Pagination,
  Badge,
  Collapse
} from 'react-bootstrap';
import { ChevronDown, ChevronUp, ArrowRepeat } from 'react-bootstrap-icons';
import { blingApi } from '../services/blingApi';
import { produtoApi } from '../services/produtoApi';
import './SincronizacaoEstoque.css';

function SincronizacaoEstoque({ tenantId }) {
  const [filtro, setFiltro] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const queryClient = useQueryClient();
  const syncCancelledRef = useRef(false);

  const [syncStatus, setSyncStatus] = useState({
    loading: false,
    message: null,
    error: null,
    progress: 0,
    totalToProcess: 0,
    processedCount: 0
  });

  const [singleSyncStatus, setSingleSyncStatus] = useState({
    sku: null,
    loading: false,
    message: null,
    error: null
  });

  // Query para buscar produtos
  const { data: produtosResponse, isLoading: isLoadingProdutos, refetch: refetchProdutos, isError: isErrorProdutos } = useQuery(
    ['produtos-estoque', tenantId],
    () => produtoApi.listarProdutos(tenantId),
    {
      enabled: !!tenantId,
      refetchOnWindowFocus: false,
      select: (response) => response.data?.data || response.data || []
    }
  );

  const produtos = produtosResponse || [];

  // Query para buscar contas Bling (para mostrar nomes nas expansões)
  const { data: contasResponse } = useQuery(
    ['bling-contas', tenantId],
    () => blingApi.listarContas(tenantId),
    {
      enabled: !!tenantId,
      refetchOnWindowFocus: false,
      select: (response) => {
        const contas = response.data?.data || response.data || [];
        // Criar mapa de blingAccountId -> accountName
        const mapaContas = {};
        contas.forEach(conta => {
          mapaContas[conta.blingAccountId] = conta.accountName || conta.store_name || 'Conta Bling';
        });
        return mapaContas;
      }
    }
  );

  const mapaNomesContas = contasResponse || {};

  // Função de ordenação
  const handleSort = (dataKey) => {
    let direction = 'asc';
    if (sortConfig.key === dataKey && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: dataKey, direction });
  };

  // Dados ordenados e filtrados
  const sortedAndFilteredData = useMemo(() => {
    let data = produtos || [];

    // Filtro de busca
    if (filtro) {
      data = data.filter(produto =>
        (produto.sku && produto.sku.toLowerCase().includes(filtro.toLowerCase())) ||
        (produto.nome && produto.nome.toLowerCase().includes(filtro.toLowerCase()))
      );
    }

    // Ordenação
    if (sortConfig.key) {
      data = [...data].sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Tratamento especial para valores numéricos
        if (sortConfig.key === 'estoque') {
          aValue = Number(aValue) || 0;
          bValue = Number(bValue) || 0;
          if (sortConfig.direction === 'asc') {
            return aValue - bValue;
          } else {
            return bValue - aValue;
          }
        }

        // Para datas
        if (sortConfig.key === 'ultimaSincronizacao') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
          if (sortConfig.direction === 'asc') {
            return aValue - bValue;
          } else {
            return bValue - aValue;
          }
        }

        // Para outros campos, converte para texto
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();

        if (sortConfig.direction === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });
    }

    return data;
  }, [produtos, filtro, sortConfig]);

  // Dados paginados
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedAndFilteredData.slice(startIndex, endIndex);
  }, [sortedAndFilteredData, currentPage, itemsPerPage]);

  // Cálculo do total de páginas
  const totalPages = Math.ceil((sortedAndFilteredData?.length || 0) / itemsPerPage);

  // Handler para mudar página
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Handler para mudar quantidade de itens por página
  const handleItemsPerPageChange = (e) => {
    const novoValor = parseInt(e.target.value);
    setItemsPerPage(novoValor);
    setCurrentPage(1);
  };

  // Mutation para sincronizar estoque unificado
  const sincronizarMutation = useMutation(
    () => blingApi.sincronizarEstoqueUnificado(tenantId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['produtos-estoque', tenantId]);
        refetchProdutos();
      }
    }
  );

  // Handler para sincronizar todos os produtos
  const handleSyncAll = async () => {
    if (syncStatus.loading) {
      syncCancelledRef.current = true;
      setSyncStatus({
        loading: false,
        message: 'Sincronização cancelada pelo usuário.',
        error: null,
        progress: 0,
        totalToProcess: 0,
        processedCount: 0
      });
      return;
    }

    syncCancelledRef.current = false;
    setSyncStatus({
      loading: true,
      message: 'Iniciando sincronização...',
      error: null,
      progress: 0,
      totalToProcess: produtos.length || 0,
      processedCount: 0
    });

    try {
      const response = await blingApi.sincronizarEstoqueUnificado(tenantId);
      
      if (response.data?.success !== false) {
        setSyncStatus({
          loading: false,
          message: `Sincronização concluída! ${response.data?.processedCount || produtos.length} produtos processados.`,
          error: null,
          progress: 100,
          totalToProcess: produtos.length || 0,
          processedCount: response.data?.processedCount || produtos.length || 0
        });
        refetchProdutos();
      } else {
        throw new Error(response.data?.message || 'Erro ao sincronizar');
      }
    } catch (err) {
      if (!syncCancelledRef.current) {
        setSyncStatus({
          loading: false,
          message: null,
          error: err.message || 'Erro ao sincronizar estoque',
          progress: 0,
          totalToProcess: 0,
          processedCount: 0
        });
      }
    } finally {
      if (!syncCancelledRef.current) {
        setTimeout(() => {
          setSyncStatus(prev => ({ ...prev, message: null, error: null }));
        }, 7000);
      }
    }
  };

  // Handler para sincronizar produto individual
  const handleSyncSingle = async (sku) => {
    setSingleSyncStatus({ sku, loading: true, message: null, error: null });

    try {
      const response = await blingApi.sincronizarEstoqueProduto(tenantId, sku);
      
      if (response.data?.success !== false) {
        setSingleSyncStatus({ sku, loading: false, message: 'Sincronizado com sucesso!', error: null });
        refetchProdutos();
      } else {
        throw new Error(response.data?.message || 'Erro ao sincronizar');
      }
    } catch (err) {
      setSingleSyncStatus({ sku, loading: false, message: null, error: err.message || 'Erro ao sincronizar' });
    } finally {
      setTimeout(() => {
        setSingleSyncStatus(prev => {
          if (prev.sku === sku) {
            return { sku: null, loading: false, message: null, error: null };
          }
          return prev;
        });
      }, 3000);
    }
  };

  // Handler para expandir/colapsar linha
  const toggleRow = (sku) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(sku)) {
      newExpanded.delete(sku);
    } else {
      newExpanded.add(sku);
    }
    setExpandedRows(newExpanded);
  };

  // Função para formatar data
  const formatarData = (data) => {
    if (!data) return '-';
    try {
      return new Date(data).toLocaleString('pt-BR');
    } catch {
      return '-';
    }
  };

  // Função para renderizar estoque por conta
  const renderEstoquePorConta = (produto) => {
    if (!produto.estoquePorConta) return null;

    const estoquePorConta = produto.estoquePorConta instanceof Map
      ? Object.fromEntries(produto.estoquePorConta)
      : produto.estoquePorConta;

    const contas = Object.entries(estoquePorConta || {});

    if (contas.length === 0) {
      return <div className="text-muted small">Nenhuma conta configurada</div>;
    }

    return (
      <div className="estoque-por-conta">
        {contas.map(([blingAccountId, quantidade]) => (
          <div key={blingAccountId} className="conta-estoque-item">
            <Badge bg="secondary" className="me-2">
              {mapaNomesContas[blingAccountId] || blingAccountId}
            </Badge>
            <span className="quantidade-estoque">{quantidade || 0}</span>
          </div>
        ))}
      </div>
    );
  };

  const headerCells = [
    { label: '', dataKey: 'expandir', width: '3%', sortable: false },
    { label: 'SKU', dataKey: 'sku', width: '15%', sortable: true },
    { label: 'Nome', dataKey: 'nome', width: '25%', sortable: true },
    { label: 'Estoque Total', dataKey: 'estoque', width: '12%', sortable: true },
    { label: 'Estoque por Conta', dataKey: 'estoquePorConta', width: '20%', sortable: false },
    { label: 'Última Sincronização', dataKey: 'ultimaSincronizacao', width: '15%', sortable: true },
    { label: 'Ações', dataKey: 'acoes', width: '10%', sortable: false }
  ];

  return (
    <div className="sincronizacao-estoque-container">
      <div className="sincronizacao-estoque-header">
        <h2>Sincronização de Estoque Unificado</h2>
      </div>

      {/* Barra de busca e ações */}
      <div className="barra-busca-acoes">
        <FormControl
          type="text"
          placeholder="Buscar por SKU ou nome..."
          value={filtro}
          onChange={(e) => {
            setFiltro(e.target.value);
            setCurrentPage(1);
          }}
          className="campo-busca"
        />
        <div className="grupo-botoes-acoes">
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip id="tooltip-sync-all">
                Sincroniza o estoque de todos os produtos com todas as contas Bling
              </Tooltip>
            }
          >
            <Button
              variant={syncStatus.loading ? "danger" : "primary"}
              onClick={handleSyncAll}
              disabled={isLoadingProdutos}
            >
              {syncStatus.loading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-2" />
                  Cancelar Sincronização
                </>
              ) : (
                <>
                  <ArrowRepeat className="me-2" />
                  Sincronizar Todos
                </>
              )}
            </Button>
          </OverlayTrigger>
        </div>
      </div>

      {/* Área de status */}
      <div className="area-status">
        {syncStatus.loading && (
          <div className="mt-2">
            <ProgressBar 
              now={syncStatus.progress} 
              label={`${syncStatus.progress}%`} 
              animated 
            />
            <small className="text-muted d-block mt-1">
              Processando {syncStatus.processedCount} de {syncStatus.totalToProcess} produtos...
            </small>
          </div>
        )}
        {!syncStatus.loading && syncStatus.error && (
          <Alert variant="danger" className="py-2 mt-2">
            {syncStatus.error}
          </Alert>
        )}
        {!syncStatus.loading && syncStatus.message && (
          <Alert variant="success" className="py-2 mt-2">
            {syncStatus.message}
          </Alert>
        )}
      </div>

      {/* Controles de paginação */}
      <div className="controles-paginacao">
        <div className="contador-paginacao">
          <p className="contador-produtos">
            Total de produtos: {sortedAndFilteredData?.length || 0}
            {filtro && (
              <span className="texto-busca">
                {' '}(mostrando {paginatedData?.length || 0} na página {currentPage} de {totalPages})
              </span>
            )}
          </p>
          <div className="select-itens-por-pagina">
            <label htmlFor="itemsPerPage" className="label-itens-por-pagina">
              Produtos por página:
            </label>
            <FormSelect
              id="itemsPerPage"
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              className="select-itens-por-pagina-control"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={400}>400</option>
            </FormSelect>
          </div>
        </div>
      </div>

      {/* Tabela de produtos */}
      {isLoadingProdutos ? (
        <div className="text-center my-4">
          <Spinner animation="border" role="status" className="me-2" />
          <span>Carregando produtos...</span>
        </div>
      ) : isErrorProdutos ? (
        <Alert variant="danger">
          Erro ao carregar produtos. Por favor, recarregue a página.
        </Alert>
      ) : !produtos || produtos.length === 0 ? (
        <Alert variant="info">Nenhum produto encontrado.</Alert>
      ) : (
        <div className="tabela-container">
          <Table striped bordered hover className="tabela-produtos">
            <thead>
              <tr>
                {headerCells.map((header, index) => {
                  const isSorted = sortConfig.key === header.dataKey;
                  const sortClass = isSorted
                    ? sortConfig.direction === 'asc'
                      ? 'ordenado-asc'
                      : 'ordenado-desc'
                    : header.sortable
                    ? 'ordenavel'
                    : '';
                  return (
                    <th
                      key={index}
                      style={{ width: header.width }}
                      className={sortClass}
                      onClick={() => header.sortable && handleSort(header.dataKey)}
                    >
                      {header.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((produto) => {
                const isExpanded = expandedRows.has(produto.sku);
                const isSyncing = singleSyncStatus?.loading && singleSyncStatus?.sku === produto.sku;
                
                return (
                  <>
                    <tr key={produto.sku || produto._id}>
                      {/* Coluna expandir */}
                      <td>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => toggleRow(produto.sku)}
                          className="botao-expandir"
                        >
                          {isExpanded ? <ChevronUp /> : <ChevronDown />}
                        </Button>
                      </td>
                      {/* SKU */}
                      <td>{produto.sku || '-'}</td>
                      {/* Nome */}
                      <td>{produto.nome || '-'}</td>
                      {/* Estoque Total */}
                      <td>
                        <Badge bg={produto.estoque > 0 ? "success" : "secondary"}>
                          {produto.estoque !== undefined && produto.estoque !== null ? produto.estoque : 0}
                        </Badge>
                      </td>
                      {/* Estoque por Conta (resumo) */}
                      <td>
                        {produto.estoquePorConta ? (
                          <div className="estoque-por-conta-resumo">
                            {Object.entries(
                              produto.estoquePorConta instanceof Map
                                ? Object.fromEntries(produto.estoquePorConta)
                                : produto.estoquePorConta
                            ).length} conta(s)
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      {/* Última Sincronização */}
                      <td>{formatarData(produto.ultimaSincronizacao)}</td>
                      {/* Ações */}
                      <td>
                        <OverlayTrigger
                          placement="top"
                          overlay={
                            <Tooltip id={`tooltip-sync-single-${produto.sku}`}>
                              Sincronizar estoque deste produto
                            </Tooltip>
                          }
                        >
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleSyncSingle(produto.sku)}
                            disabled={isSyncing}
                          >
                            {isSyncing ? (
                              <>
                                <Spinner as="span" animation="border" size="sm" className="me-1" />
                                Sincronizando
                              </>
                            ) : (
                              'Sincronizar'
                            )}
                          </Button>
                        </OverlayTrigger>
                        {singleSyncStatus?.sku === produto.sku && singleSyncStatus?.message && (
                          <div className="text-success small mt-1">{singleSyncStatus.message}</div>
                        )}
                        {singleSyncStatus?.sku === produto.sku && singleSyncStatus?.error && (
                          <div className="text-danger small mt-1">{singleSyncStatus.error}</div>
                        )}
                      </td>
                    </tr>
                    {/* Linha expandida com detalhes */}
                    <tr>
                      <td colSpan={headerCells.length} className="p-0">
                        <Collapse in={isExpanded}>
                          <div>
                            <div className="detalhes-produto-expandido">
                              <h6 className="mb-3">Detalhes do Estoque por Conta</h6>
                              {renderEstoquePorConta(produto)}
                            </div>
                          </div>
                        </Collapse>
                      </td>
                    </tr>
                  </>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {/* Navegação de paginação */}
      {totalPages > 1 && (
        <div className="navegacao-paginacao">
          <Pagination>
            <Pagination.First 
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
            />
            <Pagination.Prev 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            />
            
            {/* Números de página */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <Pagination.Item
                  key={pageNum}
                  active={pageNum === currentPage}
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </Pagination.Item>
              );
            })}
            
            <Pagination.Next 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            />
            <Pagination.Last 
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
            />
          </Pagination>
        </div>
      )}
    </div>
  );
}

export default SincronizacaoEstoque;









import { useEffect, useState, useContext } from 'react';
import { Card, Table, Button, Row, Col, Spinner } from 'react-bootstrap';
import { blingApi } from '../services/blingApi';
import { useTenant } from '../context/TenantContext';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-toastify';

export default function Pedidos() {
  const { tenantId } = useTenant();
  const { user } = useContext(AuthContext);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadPedidos = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await blingApi.listarPedidos(tenantId, undefined, { limit: 50, page: 1 });
      const lista = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
      setPedidos(lista);
    } catch (err) {
      toast.error(err?.mensagem || 'Falha ao listar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const removerPedido = async (pedido) => {
    const pedidoId = pedido?.pedidoId || pedido?.id;
    if (!pedidoId) return;
    if (!window.confirm(`Remover pedido ${pedidoId}?`)) return;
    setLoading(true);
    try {
      await blingApi.removerPedido(pedidoId, tenantId, pedido?.blingAccountId);
      toast.success(`Pedido ${pedidoId} removido e estoques recalculados`);
      await loadPedidos();
    } catch (err) {
      console.error(err);
      toast.error(err?.mensagem || 'Falha ao remover pedido');
    } finally {
      setLoading(false);
    }
  };

  // Carrega pedidos no mount/tenant change
  useEffect(() => {
    loadPedidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  return (
    <div className="container mt-4">
      <Card>
        <Card.Header>
          <Row className="align-items-center">
            <Col><h5>Pedidos Reservados</h5></Col>
            <Col className="text-end"><small className="text-muted">Usuário: {user}</small></Col>
          </Row>
        </Card.Header>
        <Card.Body>
          <Row className="mb-3">
            <Col md={2}>
              <Button variant="primary" onClick={loadPedidos} disabled={loading}>
                {loading ? <Spinner size="sm" animation="border" /> : 'Atualizar'}
              </Button>
            </Col>
          </Row>

          <div className="table-responsive">
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Conta</th>
                  <th>ID</th>
                  <th>Número</th>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted">Nenhum pedido encontrado</td>
                  </tr>
                )}
                {pedidos.map((p) => {
                  const pedidoId = p.pedidoId || p.id;
                  return (
                    <tr key={`${pedidoId}-${p.blingAccountId}`}>
                      <td>{p.accountName || p.blingAccountId || '-'}</td>
                      <td>{pedidoId}</td>
                      <td>{p.numero || '-'}</td>
                      <td>{p.data || '-'}</td>
                      <td>{p.clienteNome || p.cliente || '-'}</td>
                      <td>{p.total ?? '-'}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removerPedido(p)}
                          disabled={loading}
                        >
                          Remover
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

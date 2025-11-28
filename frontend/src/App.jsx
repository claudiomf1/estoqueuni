import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useContext } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Home from './pages/Home';
import ContasBling from './pages/ContasBling';
import Estoque from './pages/Estoque';
import Produtos from './pages/Produtos';
import SincronizacaoEstoque from './pages/SincronizacaoEstoque';
import BlingCallback from './pages/BlingCallback';

// Criar instância do QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Componente de rota protegida
function PrivateRoute({ children }) {
  const { isAuthenticated, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return <div className="text-center p-5">Verificando autenticação...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Home />
          </PrivateRoute>
        }
      />
      <Route
        path="/contas-bling"
        element={
          <PrivateRoute>
            <ContasBling />
          </PrivateRoute>
        }
      />
      <Route
        path="/estoque"
        element={
          <PrivateRoute>
            <Estoque />
          </PrivateRoute>
        }
      />
      <Route
        path="/produtos"
        element={
          <PrivateRoute>
            <Produtos />
          </PrivateRoute>
        }
      />
      <Route
        path="/sincronizacao"
        element={
          <PrivateRoute>
            <SincronizacaoEstoque />
          </PrivateRoute>
        }
      />
      <Route path="/bling/callback" element={<BlingCallback />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <Navbar />
          <div className="main-content-with-fixed-navbar">
            <AppRoutes />
          </div>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

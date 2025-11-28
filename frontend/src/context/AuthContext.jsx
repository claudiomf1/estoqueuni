import { createContext, useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = '/api/auth';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [email, setEmail] = useState(null);
  const [nivelAcesso, setNivelAcesso] = useState(null);
  const authCheckInProgress = useRef(false);

  const login = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Erro ao fazer logout no servidor:', error);
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      setTenantId(null);
      setEmail(null);
      setNivelAcesso(null);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    if (authCheckInProgress.current) {
      return;
    }

    authCheckInProgress.current = true;
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/verificarToken`, {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.userName || data.nome_usuario);
        setTenantId(data.tenantId);
        setEmail(data.email);
        setNivelAcesso(data.nivel_acesso);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setTenantId(null);
        setEmail(null);
        setNivelAcesso(null);
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      setIsAuthenticated(false);
      setUser(null);
      setTenantId(null);
      setEmail(null);
      setNivelAcesso(null);
    } finally {
      setIsLoading(false);
      authCheckInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value = {
    isAuthenticated,
    isLoading,
    user,
    tenantId,
    setTenantId,
    email,
    nivelAcesso,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';

const TenantContext = createContext();

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant deve ser usado dentro de TenantProvider');
  }
  return context;
};

export const TenantProvider = ({ children }) => {
  const { tenantId: authTenantId } = useContext(AuthContext);
  const [tenantId, setTenantId] = useState(() => {
    // Tentar pegar da URL ou localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlTenantId = urlParams.get('tenantId');
    const storedTenantId = localStorage.getItem('estoqueuni_tenantId');
    return urlTenantId || storedTenantId || null;
  });

  // Sincronizar com o tenantId do AuthContext quando disponível
  useEffect(() => {
    if (authTenantId) {
      setTenantId(authTenantId);
      localStorage.setItem('estoqueuni_tenantId', authTenantId);
    }
  }, [authTenantId]);

  const atualizarTenantId = (novoTenantId) => {
    setTenantId(novoTenantId);
    if (novoTenantId) {
      localStorage.setItem('estoqueuni_tenantId', novoTenantId);
    } else {
      localStorage.removeItem('estoqueuni_tenantId');
    }
  };

  return (
    <TenantContext.Provider value={{ tenantId, atualizarTenantId }}>
      {children}
    </TenantContext.Provider>
  );
};









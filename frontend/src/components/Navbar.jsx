import React, { useContext } from 'react';
import { Navbar as BootstrapNavbar, Nav, Container, NavDropdown } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTenant } from '../context/TenantContext';
import { AuthContext } from '../context/AuthContext';
import useIsOwner from '../hooks/useIsOwner';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { user, email, logout, isAuthenticated } = useContext(AuthContext);
  const isOwner = useIsOwner();

  // Não mostrar navbar na página de login
  if (location.pathname === '/login' || !isAuthenticated) {
    return null;
  }

  const isActive = (path) => {
    return location.pathname === path;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <BootstrapNavbar bg="dark" variant="dark" expand="lg" className="fixed-top">
      <Container>
        <BootstrapNavbar.Brand as={Link} to="/">
          EstoqueUni
        </BootstrapNavbar.Brand>
        <BootstrapNavbar.Toggle aria-controls="basic-navbar-nav" />
        <BootstrapNavbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link
              as={Link}
              to="/"
              active={isActive('/')}
            >
              Home
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/contas-bling"
              active={isActive('/contas-bling')}
            >
              Contas Bling
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/estoque"
              active={isActive('/estoque')}
            >
              Estoque
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/produtos"
              active={isActive('/produtos')}
            >
              Produtos
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/sincronizacao"
              active={isActive('/sincronizacao')}
            >
              Sincronização
            </Nav.Link>
            {isOwner && (
              <Nav.Link
                as={Link}
                to="/painelpresidente"
                active={isActive('/painelpresidente')}
              >
                Painel do Presidente
              </Nav.Link>
            )}
          </Nav>
          <Nav>
            <NavDropdown title={user || 'Usuário'} id="user-dropdown" align="end">
              <NavDropdown.Item disabled>
                <small className="text-muted">
                  {email && <div>{email}</div>}
                  {tenantId && <div>Tenant: {tenantId}</div>}
                </small>
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={handleLogout}>
                Sair
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </BootstrapNavbar.Collapse>
      </Container>
    </BootstrapNavbar>
  );
}








/**
 * Configurações de Autenticação e URLs para EstoqueUni
 */

export const JWT_SECRET = process.env.ESTOQUEUNI_AUTH_SECRET ||
                          process.env.SECRET_KEY ||
                          process.env.secretKey ||
                          'estoqueuni-dev-secret';

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

export const EMAIL_TOKEN_EXPIRES_IN =
  process.env.EMAIL_TOKEN_EXPIRES_IN || '24h';

const DEFAULT_FRONTEND_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://estoqueuni.com.br'
    : 'http://localhost:5174';

const DEFAULT_PUBLIC_API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://estoqueuni.com.br'
    : 'http://localhost:5010';

export const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || DEFAULT_FRONTEND_BASE_URL;

export const PUBLIC_API_BASE_URL =
  process.env.PUBLIC_API_BASE_URL || DEFAULT_PUBLIC_API_BASE_URL;





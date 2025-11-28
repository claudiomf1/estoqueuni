import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'estoqueuni_session';

const getAuthSecret = () =>
  process.env.ESTOQUEUNI_AUTH_SECRET ||
  process.env.SECRET_KEY ||
  process.env.secretKey ||
  'estoqueuni-dev-secret';

/**
 * Middleware de autenticação JWT
 * Extrai o token do cookie e adiciona informações do usuário ao req
 */
export const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token não fornecido',
      });
    }

    const decoded = jwt.verify(token, getAuthSecret());
    
    // Adiciona informações do usuário ao request
    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;
    req.accountType = decoded.accountType;
    req.rota_base = decoded.rota_base;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido',
      });
    }

    console.error('[auth middleware] Erro ao autenticar:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao autenticar',
    });
  }
};

/**
 * Middleware opcional - não bloqueia se não houver token
 * Útil para rotas que podem funcionar com ou sem autenticação
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];

    if (token) {
      const decoded = jwt.verify(token, getAuthSecret());
      req.userId = decoded.userId;
      req.tenantId = decoded.tenantId;
      req.accountType = decoded.accountType;
      req.rota_base = decoded.rota_base;
    }
  } catch (error) {
    // Ignora erros de token em autenticação opcional
  }

  next();
};

export default authenticate;


import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario.js';
import Tenant from '../models/Tenant.js';

const COOKIE_NAME = 'estoqueuni_session';
const TOKEN_EXPIRATION =
  process.env.ESTOQUEUNI_AUTH_TOKEN_EXPIRES_IN || process.env.AUTH_TOKEN_TTL || '12h';

const getAuthSecret = () =>
  process.env.ESTOQUEUNI_AUTH_SECRET ||
  process.env.SECRET_KEY ||
  process.env.secretKey ||
  'estoqueuni-dev-secret';

const buildUserPayload = (doc, { rota_base }) => {
  const tenantId =
    doc?.tenantId || doc?.tenant_id || doc?._id?.toString() || null;

  return {
    tenantId,
    id_nivel_acesso:
      doc?.id_nivel_acesso ||
      (doc?.nivel_acesso?.toLowerCase().includes('owner') ? 'owner' : 'user'),
    nivel_acesso: doc?.nivel_acesso || 'Administrador',
    nome_usuario: doc?.nome_usuario || doc?.usuario || doc?.nome || '',
    email: doc?.email || '',
    acessoModulos: doc?.acessoModulos || doc?.modulos || [],
    nome: doc?.nome || doc?.nome_usuario || '',
    indentificacaoFiscal: doc?.identificacaoFiscal || '',
    assinaturaStatus: doc?.assinaturaStatus || 'true',
    rota_base: rota_base || doc?.rota_base || 'estoqueuni',
    tipodocumento: doc?.tipoLocatario === 'Pessoa Física' ? 'CPF' : 'CNPJ',
  };
};

const setSessionCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000, // 12 horas
  });
};

const loadUserByUsername = async (username, rota_base) => {
  const isEmail = username.includes('@');

  const userQuery = isEmail
    ? { email: username, rota_base }
    : { nome_usuario: username, rota_base };

  const usuarioDoc = await Usuario.findOne(userQuery).lean();
  if (usuarioDoc) {
    return { doc: usuarioDoc, accountType: 'usuario' };
  }

  const tenantQuery = isEmail
    ? { email: username, rota_base }
    : { usuario: username, rota_base };
  const tenantDoc = await Tenant.findOne(tenantQuery).lean();
  if (tenantDoc) {
    return { doc: tenantDoc, accountType: 'tenant' };
  }

  return null;
};

const loadUserById = async (userId, accountType) => {
  if (accountType === 'usuario') {
    return Usuario.findById(userId).lean();
  }
  return Tenant.findById(userId).lean();
};

/**
 * Handler de login
 * POST /api/auth/login
 */
export async function loginHandler(req, res) {
  const { username, password, rota_base = 'estoqueuni' } = req.body || {};

  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, message: 'Usuário e senha são obrigatórios.' });
  }

  try {
    const result = await loadUserByUsername(username.trim(), rota_base);
    if (!result?.doc) {
      return res
        .status(401)
        .json({ success: false, message: 'Usuário ou senha inválidos.' });
    }

    const { doc, accountType } = result;
    const senhaHash = doc?.senha;
    if (!senhaHash) {
      return res
        .status(401)
        .json({ success: false, message: 'Usuário inválido.' });
    }

    const senhaCorreta = await bcrypt.compare(password, senhaHash);
    if (!senhaCorreta) {
      return res
        .status(401)
        .json({ success: false, message: 'Usuário ou senha inválidos.' });
    }

    const userPayload = buildUserPayload(doc, { rota_base });
    const tokenPayload = {
      userId: doc?._id?.toString(),
      tenantId: userPayload.tenantId,
      rota_base: userPayload.rota_base,
      accountType,
    };

    const token = jwt.sign(tokenPayload, getAuthSecret(), {
      expiresIn: TOKEN_EXPIRATION,
    });

    setSessionCookie(res, token);

    return res.json({
      success: true,
      user: userPayload,
      userName: userPayload.nome_usuario,
      email: userPayload.email,
    });
  } catch (error) {
    console.error('[login] Falha na autenticação:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Erro ao autenticar usuário.' });
  }
}

/**
 * Handler de logout
 * POST /api/auth/logout
 */
export async function logoutHandler(_req, res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ success: true });
}

/**
 * Handler para verificar token
 * GET /api/auth/verificarToken
 */
export async function verifyTokenHandler(req, res) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.json({ success: false });
  }

  try {
    const decoded = jwt.verify(token, getAuthSecret());
    const { userId, accountType, tenantId } = decoded;

    const doc = await loadUserById(userId, accountType);
    if (!doc) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.json({ success: false });
    }

    const userPayload = buildUserPayload(doc, { rota_base: decoded.rota_base });

    return res.json({
      success: true,
      ...userPayload,
      userName: userPayload.nome_usuario,
      email: userPayload.email,
      tenantId: userPayload.tenantId || tenantId,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.json({ success: false });
    }

    console.error('[verifyToken] Erro ao verificar token:', error);
    return res.status(500).json({ success: false });
  }
}


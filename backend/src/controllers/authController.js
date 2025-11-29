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

  // Garantir que nivel_acesso seja lido corretamente
  const nivelAcessoRaw = doc?.nivel_acesso;
  const nivelAcesso = nivelAcessoRaw ? String(nivelAcessoRaw).trim() : 'Administrador';
  
  console.log('[buildUserPayload] nivelAcessoRaw:', nivelAcessoRaw);
  console.log('[buildUserPayload] nivelAcesso processado:', nivelAcesso);

  return {
    tenantId,
    id_nivel_acesso:
      doc?.id_nivel_acesso ||
      (nivelAcesso.toLowerCase().includes('owner') ? 'owner' : 'user'),
    nivel_acesso: nivelAcesso,
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

  // PRIORIDADE: Buscar primeiro no Tenant (tenants-estoqueuni)
  // porque o login do painel do presidente usa o campo 'usuario' do tenant
  const tenantQuery = isEmail
    ? { email: username, rota_base }
    : { usuario: username, rota_base };
  console.log('[findUserByUsername] Buscando tenant PRIMEIRO com query:', JSON.stringify(tenantQuery, null, 2));
  const tenantDoc = await Tenant.findOne(tenantQuery).lean();
  if (tenantDoc) {
    console.log('[findUserByUsername] Tenant encontrado. nivel_acesso:', tenantDoc.nivel_acesso);
    console.log('[findUserByUsername] Tenant completo:', JSON.stringify(tenantDoc, null, 2));
    return { doc: tenantDoc, accountType: 'tenant' };
  }

  // Se não encontrou no tenant, buscar no Usuario
  const userQuery = isEmail
    ? { email: username, rota_base }
    : { nome_usuario: username, rota_base };
  console.log('[findUserByUsername] Tenant não encontrado. Buscando usuario com query:', JSON.stringify(userQuery, null, 2));
  const usuarioDoc = await Usuario.findOne(userQuery).lean();
  if (usuarioDoc) {
    console.log('[findUserByUsername] Usuario encontrado. nivel_acesso:', usuarioDoc.nivel_acesso);
    return { doc: usuarioDoc, accountType: 'usuario' };
  }

  console.log('[findUserByUsername] Nenhum documento encontrado para:', username);
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

    console.log('[login] Documento completo do banco:', JSON.stringify(doc, null, 2));
    console.log('[login] doc.nivel_acesso (raw):', doc?.nivel_acesso);
    console.log('[login] Tipo de doc.nivel_acesso:', typeof doc?.nivel_acesso);
    console.log('[login] accountType:', accountType);
    
    const userPayload = buildUserPayload(doc, { rota_base });
    console.log('[login] userPayload.nivel_acesso:', userPayload.nivel_acesso);
    const tokenPayload = {
      userId: doc?._id?.toString(),
      tenantId: userPayload.tenantId,
      rota_base: userPayload.rota_base,
      accountType,
      nivel_acesso: userPayload.nivel_acesso,
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
      nivel_acesso: userPayload.nivel_acesso,
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
 * Handler de cadastro
 * POST /api/auth/cadastro
 */
export async function cadastroHandler(req, res) {
  const { nome, email, usuario, senha, rota_base = 'estoqueuni' } = req.body || {};

  if (!nome || !email || !usuario || !senha) {
    return res.status(400).json({
      success: false,
      message: 'Todos os campos são obrigatórios.',
    });
  }

  if (senha.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'A senha deve ter no mínimo 6 caracteres.',
    });
  }

  try {
    // Verificar se usuário já existe
    const usuarioExistente = await Usuario.findOne({
      $or: [{ nome_usuario: usuario }, { email }],
      rota_base,
    });

    if (usuarioExistente) {
      return res.status(400).json({
        success: false,
        message: 'Usuário ou e-mail já cadastrado.',
      });
    }

    // Verificar se tenant já existe
    const tenantExistente = await Tenant.findOne({
      $or: [{ usuario }, { email }],
      rota_base,
    });

    if (tenantExistente) {
      return res.status(400).json({
        success: false,
        message: 'Usuário ou e-mail já cadastrado.',
      });
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Criar tenant primeiro
    const novoTenant = new Tenant({
      usuario,
      nome,
      email,
      senha: senhaHash,
      rota_base,
      tipoLocatario: 'Pessoa Jurídica',
      nivel_acesso: 'Administrador', // Padrão, pode ser alterado manualmente para 'owner'
    });

    await novoTenant.save();

    // Criar usuário associado ao tenant
    const novoUsuario = new Usuario({
      nome_usuario: usuario,
      nome,
      email,
      senha: senhaHash,
      rota_base,
      tenantId: novoTenant._id.toString(),
      nivel_acesso: 'Administrador',
      ativo: true,
    });

    await novoUsuario.save();

    return res.json({
      success: true,
      message: 'Cadastro realizado com sucesso!',
      tenantId: novoTenant._id.toString(),
    });
  } catch (error) {
    console.error('[cadastro] Erro ao cadastrar:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao realizar cadastro.',
    });
  }
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
      nivel_acesso: userPayload.nivel_acesso || decoded.nivel_acesso,
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


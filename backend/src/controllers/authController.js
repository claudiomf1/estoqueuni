import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario.js';
import Tenant from '../models/Tenant.js';
import TempTenant from '../models/TempTenant.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { APP_NAME } from '../config/email.js';
import { FRONTEND_BASE_URL, JWT_SECRET, EMAIL_TOKEN_EXPIRES_IN } from '../config/auth.js';

const COOKIE_NAME = 'estoqueuni_session';
const TOKEN_EXPIRATION =
  process.env.ESTOQUEUNI_AUTH_TOKEN_EXPIRES_IN || process.env.AUTH_TOKEN_TTL || '12h';

// getAuthSecret agora vem de config/auth.js
const getAuthSecret = () => JWT_SECRET;

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function generateVerificationToken(tempTenantId) {
  return jwt.sign({ tempTenantId }, getAuthSecret(), {
    expiresIn: EMAIL_TOKEN_EXPIRES_IN,
  });
}

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
  // Normalizar username: trim e lowercase para emails
  const normalizedUsername = username.trim();
  const isEmail = normalizedUsername.includes('@');
  
  // Para emails, normalizar (lowercase)
  // Para nomes de usuário, manter case-sensitive mas fazer trim
  const searchValue = isEmail ? normalizeEmail(normalizedUsername) : normalizedUsername;

  // PRIORIDADE: Buscar primeiro no Tenant (tenants-estoqueuni)
  // porque o login do painel do presidente usa o campo 'usuario' do tenant
  const tenantQuery = isEmail
    ? { email: searchValue, rota_base }
    : { usuario: searchValue, rota_base };
  
  console.log('[findUserByUsername] Buscando tenant PRIMEIRO com query:', JSON.stringify(tenantQuery, null, 2));
  const tenantDoc = await Tenant.findOne(tenantQuery).lean();
  if (tenantDoc) {
    console.log('[findUserByUsername] Tenant encontrado. nivel_acesso:', tenantDoc.nivel_acesso);
    console.log('[findUserByUsername] Tenant completo:', JSON.stringify(tenantDoc, null, 2));
    return { doc: tenantDoc, accountType: 'tenant' };
  }

  // Se não encontrou no tenant, buscar no Usuario
  const userQuery = isEmail
    ? { email: searchValue, rota_base }
    : { nome_usuario: searchValue, rota_base };
  
  console.log('[findUserByUsername] Tenant não encontrado. Buscando usuario com query:', JSON.stringify(userQuery, null, 2));
  const usuarioDoc = await Usuario.findOne(userQuery).lean();
  if (usuarioDoc) {
    console.log('[findUserByUsername] Usuario encontrado. nivel_acesso:', usuarioDoc.nivel_acesso);
    return { doc: usuarioDoc, accountType: 'usuario' };
  }

  console.log('[findUserByUsername] Nenhum documento encontrado para:', normalizedUsername);
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
    const normalizedUsername = username.trim();
    const isEmail = normalizedUsername.includes('@');
    const searchValue = isEmail ? normalizeEmail(normalizedUsername) : normalizedUsername;

    // PRIMEIRO: Verificar se existe cadastro temporário (email não verificado)
    // Isso deve ser verificado ANTES de validar senha
    // Se existe TempTenant, sempre mostrar aviso de email não verificado
    // A validação de senha só acontece DEPOIS de verificar se o email está validado
    if (isEmail) {
      const tempTenant = await TempTenant.findOne({
        email: searchValue,
        rota_base,
      }).lean();

      if (tempTenant) {
        // Sempre mostrar aviso de email não verificado se existe TempTenant
        // Não validar senha ainda - isso só acontece após email ser validado
        return res.status(403).json({
          success: false,
          message: 'Por favor, confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.',
          emailNotVerified: true,
          email: tempTenant.email || searchValue,
        });
      }
    }

    // SEGUNDO: Buscar usuário/tenant válido
    const result = await loadUserByUsername(normalizedUsername, rota_base);
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

    // TERCEIRO: Verificar se o email foi confirmado (apenas para tenants)
    if (accountType === 'tenant' && doc.isEmailVerified === false) {
      return res.status(403).json({
        success: false,
        message: 'Por favor, confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.',
        emailNotVerified: true,
        email: doc.email || username,
      });
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

  // Validação básica de email
  const emailRegex = /\S+@\S+\.\S+/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Formato de e-mail inválido.',
    });
  }

  try {
    const normalizedEmail = normalizeEmail(email);

    // Verificar se usuário já existe
    const usuarioExistente = await Usuario.findOne({
      $or: [{ nome_usuario: usuario }, { email: normalizedEmail }],
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
      $or: [{ usuario }, { email: normalizedEmail }],
      rota_base,
    });

    if (tenantExistente) {
      return res.status(400).json({
        success: false,
        message: 'Usuário ou e-mail já cadastrado.',
      });
    }

    // Verificar se já existe um cadastro temporário pendente
    const tempTenantExistente = await TempTenant.findOne({
      email: normalizedEmail,
      rota_base,
    });

    if (tempTenantExistente) {
      // Deletar cadastro temporário anterior
      await TempTenant.deleteOne({ _id: tempTenantExistente._id });
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Criar tenant temporário
    const tempTenant = await TempTenant.create({
      usuario,
      nome,
      email: normalizedEmail,
      senha: senhaHash,
      rota_base,
      tipoLocatario: 'Pessoa Jurídica',
      nivel_acesso: 'Administrador',
    });

    // Gerar token de verificação
    const token = generateVerificationToken(tempTenant._id.toString());

    // Enviar email de verificação
    try {
      await sendVerificationEmail({
        to: normalizedEmail,
        name: nome,
        token,
      });
    } catch (emailError) {
      // Se falhar ao enviar email, deletar o cadastro temporário
      await TempTenant.deleteOne({ _id: tempTenant._id });
      console.error('[cadastro] Erro ao enviar email:', emailError);
      throw emailError;
    }

    return res.status(201).json({
      success: true,
      message: 'Cadastro iniciado. Verifique seu e-mail para confirmar a conta.',
    });
  } catch (error) {
    console.error('[cadastro] Erro ao cadastrar:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao realizar cadastro. Tente novamente.',
    });
  }
}

/**
 * Handler para obter token (para uso do backend-ai)
 * POST /getToken
 */
export async function getTokenHandler(req, res) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token não encontrado' });
  }

  try {
    const decoded = jwt.verify(token, getAuthSecret());
    return res.json({
      success: true,
      token,
      userId: decoded.userId,
      tenantId: decoded.tenantId,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.status(401).json({ success: false, message: 'Token inválido ou expirado' });
    }
    console.error('[getToken] Erro ao obter token:', error);
    return res.status(500).json({ success: false, message: 'Erro ao processar token' });
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

/**
 * Handler para verificar email
 * GET /api/auth/verify-email?token=...
 */
export async function verifyEmailHandler(req, res) {
  const { token } = req.query || {};

  if (!token) {
    return res.status(400).send(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; text-align: center; padding: 20px;">
        <h1 style="color: #dc2626;">Token de verificação é obrigatório.</h1>
        <p>Por favor, use o link completo enviado por e-mail.</p>
      </div>
    `);
  }

  try {
    const decoded = jwt.verify(token, getAuthSecret());
    const { tempTenantId } = decoded;

    const tempTenant = await TempTenant.findById(tempTenantId);
    if (!tempTenant) {
      return res.status(400).send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; text-align: center; padding: 20px;">
          <h1 style="color: #dc2626;">Token inválido ou expirado.</h1>
          <p>Por favor, solicite um novo link de verificação.</p>
        </div>
      `);
    }

    const normalizedEmail = tempTenant.email;
    const { usuario, nome, senha, rota_base, tipoLocatario, nivel_acesso } = tempTenant;

    // Verificar se já existe tenant com esse email
    const tenantExistente = await Tenant.findOne({
      $or: [{ usuario }, { email: normalizedEmail }],
      rota_base,
    });

    if (tenantExistente) {
      // Se já existe, apenas deletar o temp e mostrar mensagem
      await TempTenant.deleteOne({ _id: tempTenant._id });
      return res.send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; text-align: center; padding: 20px;">
          <h1 style="color: #16a34a;">E-mail já confirmado!</h1>
          <p>Este e-mail já está cadastrado e verificado no <strong>${APP_NAME}</strong>.</p>
          <p>Você já pode fazer login.</p>
        </div>
      `);
    }

    // Criar tenant definitivo
    const novoTenant = new Tenant({
      usuario,
      nome,
      email: normalizedEmail,
      senha,
      rota_base,
      tipoLocatario,
      nivel_acesso,
      isEmailVerified: true,
    });

    await novoTenant.save();

    // Criar usuário associado ao tenant
    const novoUsuario = new Usuario({
      nome_usuario: usuario,
      nome,
      email: normalizedEmail,
      senha,
      rota_base,
      tenantId: novoTenant._id.toString(),
      nivel_acesso,
      ativo: true,
    });

    await novoUsuario.save();

    // Deletar tenant temporário
    await TempTenant.deleteOne({ _id: tempTenant._id });

    const loginUrl = `${FRONTEND_BASE_URL.replace(/\/$/, '')}/login`;

    return res.send(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; text-align: center; padding: 20px; line-height: 1.6;">
        <h1 style="color: #16a34a; margin-bottom: 20px;">✅ E-mail confirmado!</h1>
        <p style="font-size: 18px;">Sua conta no <strong>${APP_NAME}</strong> foi ativada com sucesso.</p>
        <p>Você já pode fazer login utilizando seu e-mail <strong>${normalizedEmail}</strong>.</p>
        <div style="margin: 30px 0;">
          <a href="${loginUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Ir para o login
          </a>
        </div>
      </div>
    `);
  } catch (error) {
    console.error('[verifyEmail] Erro ao verificar email:', error);
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(400).send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; text-align: center; padding: 20px;">
          <h1 style="color: #dc2626;">Token inválido ou expirado.</h1>
          <p>Por favor, solicite um novo link de verificação.</p>
        </div>
      `);
    }
    return res.status(500).send(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; text-align: center; padding: 20px;">
        <h1 style="color: #dc2626;">Erro ao verificar e-mail.</h1>
        <p>Tente novamente mais tarde ou entre em contato com o suporte.</p>
      </div>
    `);
  }
}


import Usuario from '../models/Usuario.js';
import Tenant from '../models/Tenant.js';

/**
 * Middleware para verificar se o usuário tem nivel_acesso = "owner"
 * Deve ser usado após o middleware de autenticação
 */
export const checkOwner = async (req, res, next) => {
  try {
    if (!req.userId || !req.accountType) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
    }

    let doc;
    if (req.accountType === 'usuario') {
      doc = await Usuario.findById(req.userId).lean();
    } else if (req.accountType === 'tenant') {
      doc = await Tenant.findById(req.userId).lean();
    }

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
      });
    }

    const nivelAcesso = doc.nivel_acesso || doc.nivelAcesso || '';
    const nivelAcessoNormalizado = nivelAcesso.toString().trim().toLowerCase();

    if (nivelAcessoNormalizado !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Apenas o owner pode acessar esta rota.',
      });
    }

    // Adiciona informações do usuário ao request
    req.userDoc = doc;
    next();
  } catch (error) {
    console.error('[checkOwner] Erro ao verificar owner:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao verificar permissões',
    });
  }
};

export default checkOwner;


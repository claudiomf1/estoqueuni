/**
 * Middleware para validar tenantId nas requisições
 * Busca tenantId em query, body ou headers
 */
export const validarTenantId = (req, res, next) => {
  const tenantId =
    req.query?.tenantId ||
    req.body?.tenantId ||
    req.headers['x-tenant-id'] ||
    req.headers['x-user-tenantid'] ||
    req.authTenantId;

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      error: 'tenantId é obrigatório',
      message: 'O tenantId deve ser fornecido via query, body ou header x-tenant-id'
    });
  }

  // Normalizar tenantId (trim e string)
  req.tenantId = String(tenantId).trim();

  if (!req.tenantId) {
    return res.status(400).json({
      success: false,
      error: 'tenantId inválido',
      message: 'O tenantId não pode estar vazio'
    });
  }

  next();
};

export default validarTenantId;









/**
 * Configuração de Email para EstoqueUni
 * Usa Zoho Mail SMTP (mesma configuração do ClaudioIA)
 */

export const emailConfigEstoqueUni = {
  host: process.env.EMAIL_SMTP_HOST || 'smtppro.zoho.com',
  port: Number(process.env.EMAIL_SMTP_PORT || 465),
  secure: process.env.EMAIL_SMTP_SECURE
    ? process.env.EMAIL_SMTP_SECURE === 'true'
    : true,
  auth: {
    user: process.env.EMAIL_SMTP_USER || 'cadastro@negocios360.com.br',
    pass: process.env.EMAIL_SMTP_PASS || 'K8jm3EyvX1jE',
  },
  tls: {
    ciphers: 'SSLv3',
  },
};

export const EMAIL_FROM =
  process.env.EMAIL_FROM || 'EstoqueUni <cadastro@negocios360.com.br>';

export const APP_NAME = process.env.APP_NAME || 'EstoqueUni';











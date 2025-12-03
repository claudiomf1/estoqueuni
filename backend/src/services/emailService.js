import nodemailer from 'nodemailer';
import { emailConfigEstoqueUni, EMAIL_FROM, APP_NAME } from '../config/email.js';
import { PUBLIC_API_BASE_URL } from '../config/auth.js';

const transporter = nodemailer.createTransport(emailConfigEstoqueUni);

transporter
  .verify()
  .then(() => {
    console.info('[email] SMTP transporter verificado com sucesso.');
  })
  .catch((error) => {
    console.error('[email] Falha ao verificar transporter SMTP:', error);
  });

function buildVerificationLink(token) {
  const base = PUBLIC_API_BASE_URL.replace(/\/$/, '');
  return `${base}/api/auth/verify-email?token=${token}`;
}

/**
 * Envia email de verificação para novo cadastro
 */
export async function sendVerificationEmail({ to, name, token }) {
  const verificationLink = buildVerificationLink(token);

  const subject = `${APP_NAME} - Confirme seu e-mail`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb; margin-bottom: 20px;">Confirme seu e-mail</h2>
      <p>Olá ${name || ''},</p>
      <p>Recebemos um pedido para criar sua conta no <strong>${APP_NAME}</strong>.</p>
      <p>Para concluir o cadastro, clique no botão abaixo ou copie e cole o link no navegador:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          Confirmar meu e-mail
        </a>
      </div>
      <p style="word-break: break-all; color: #666; font-size: 12px;">
        Link: ${verificationLink}
      </p>
      <p style="color: #666; font-size: 14px;">
        Se você não solicitou este cadastro, ignore esta mensagem.
      </p>
      <p style="margin-top: 30px;">
        Atenciosamente,<br/>
        Equipe ${APP_NAME}
      </p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });

    console.info('[email] Email de verificação enviado:', {
      to,
      messageId: info?.messageId,
    });

    return info;
  } catch (error) {
    console.error('[email] Erro ao enviar email de verificação:', error);
    throw error;
  }
}


const nodemailer = require('nodemailer');
const { google } = require('googleapis');

async function sendEmail({ to, cc, bcc, subject, text, attachments }) {
  try {
    console.log('[emailService] sendEmail START', { to, cc, bcc, subject, hasAttachments: !!attachments });

    console.log('[emailService] Configurando OAuth2...');
    
    const oAuth2Client = new google.auth.OAuth2(
      process.env.EMAIL_CLIENT_ID,
      process.env.EMAIL_CLIENT_SECRET,
      process.env.EMAIL_REDIRECT_URI
    );

    oAuth2Client.setCredentials({ refresh_token: process.env.EMAIL_REFRESH_TOKEN });

    const accessToken = await oAuth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.EMAIL_CLIENT_ID,
        clientSecret: process.env.EMAIL_CLIENT_SECRET,
        refreshToken: process.env.EMAIL_REFRESH_TOKEN,
        accessToken: accessToken.token,
      }
    });

    console.log('[emailService] Transporter configurado.');

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      cc,
      bcc,
      subject,
      text,
      attachments
    };

    console.log('[emailService] mailOptions montado:', mailOptions);

    const info = await transporter.sendMail(mailOptions);
    console.log('[emailService] E-mail enviado com sucesso:', info);

    return info;
  } catch (error) {
    console.error('[emailService] Erro ao enviar e-mail:', error);
    throw error;
  }
}

module.exports = { sendEmail };

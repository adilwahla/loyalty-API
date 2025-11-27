const nodemailer = require('nodemailer');

/**
 * Create a transporter. For Gmail, you need an App Password (recommended)
 * or enable “Less secure apps” (deprecated).
 *
 * Set these in your .env:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465
 *   SMTP_SECURE=true
 *   SMTP_USER=your@gmail.com
 *   SMTP_PASS=your_app_password
 *   MAIL_FROM="Your App <your@gmail.com>"
 */
function getTransporter() {
  const {
    SMTP_HOST = 'smtp.office365.com',
    SMTP_PORT = '587',
    SMTP_SECURE = 'false',
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    // logger: true,        // 🔧 verbose logs
    // debug: true,         // 🔧 verbose logs
  });
}

/**
 * Send an email (HTML + text + cc/bcc)
 * @param {Object} opts
 * @param {string|string[]} to
 * @param {string|string[]} [cc]
 * @param {string|string[]} [bcc]
 * @param {string} subject
 * @param {string} html
 * @param {string} [text]
 */
async function sendMail({ to, cc, bcc, subject, html, text ,attachments}) {
  const transporter = getTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to,
    cc,     // ✅ now supported
    bcc,    // ✅ now supported
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ' '),
    attachments
  });
}

module.exports = { sendMail };

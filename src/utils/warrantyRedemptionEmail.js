// src/utils/warrantyRedemptionUtils.js
const { User, BranchManager } = require('../models');
const { sendMail } = require('./mailer');

// CSV in .env, e.g. REDEMPTION_APPROVAL_TO="adilwahla360@gmail.com,ops@example.com"
const DEFAULT_RECIPIENTS = (process.env.REDEMPTION_APPROVAL_TO || 'ar.ahmed@bin-shihon.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Optional CC/BCC via env if you want (safe to leave empty)
const DEFAULT_CC = (process.env.REDEMPTION_APPROVAL_CC || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const DEFAULT_BCC = (process.env.REDEMPTION_APPROVAL_BCC || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Simple approval email to the default recipients.
 * @param {Object} payload - plain object with redemption fields
 */
async function sendApprovalEmail(payload) {
  const to = DEFAULT_RECIPIENTS;
  if (!to.length) return; // nothing to send to

  const subject = `✅ Redemption Approved — ${payload.rewards} for ${payload.name}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
      <h2 style="margin:0 0 8px">Redemption Approved</h2>
      <p>The following redemption request has been <b>APPROVED</b>:</p>
      <table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse">
        <tr><td><b>ID</b></td><td>${payload.id ?? ''}</td></tr>
        <tr><td><b>User</b></td><td>${payload.name ?? ''} (${payload.role ?? ''})</td></tr>
        <tr><td><b>Phone</b></td><td>${payload.phone ?? ''}</td></tr>
        <tr><td><b>Reward</b></td><td>${payload.rewards ?? ''}</td></tr>
        <tr><td><b>Required Points</b></td><td>${payload.requiredPoints ?? ''}</td></tr>
        <tr><td><b>Points Accumulated</b></td><td>${payload.pointsAccumulated ?? ''}</td></tr>
        <tr><td><b>Location</b></td><td>${payload.location ?? ''}</td></tr>
        <tr><td><b>Requested At</b></td><td>${payload.requestDate ?? ''}</td></tr>
        <tr><td><b>Approved At</b></td><td>${new Date().toISOString()}</td></tr>
      </table>
      <p style="margin-top:16px">— Redemption System</p>
    </div>
  `;

  await sendMail({ to, subject, html, cc: DEFAULT_CC, bcc: DEFAULT_BCC });
}

/**
 * Stakeholder email that looks up Sales Rep + Branch Manager by branchCode.
 * Falls back to DEFAULT_RECIPIENTS if lookups fail.
 * @param {Object} redemption - Sequelize instance or plain object with keys:
 *   salesRepUserId, rewardId, pointsConsumed, userId, name, role, phone, rewards, ...
 */
async function sendEmailToRedemptionStakeholders(redemption) {   

  try {
    const toRecipients = new Set(DEFAULT_RECIPIENTS);
    const ccRecipients = new Set(DEFAULT_CC);
    const bccRecipients = new Set(DEFAULT_BCC);

    if (redemption?.userId) {
      // 1️⃣ Load actor
      const actor = await User.findByPk(String(redemption.userId)).catch(() => null);
      if (actor) {
        if (actor.email) {
          toRecipients.add(actor.email);
          console.log('[EMAIL] + Added actor email to TO:', actor.email);
        }

        // 2️⃣ Find sales rep by actor.salesRepId
        if (actor.salesRepId) {
          const rep = await User.findOne({
            where: { role: 'SALES_REP', binShihonWorkerId: actor.salesRepId }
          }).catch(() => null);

          if (rep?.email) {
            ccRecipients.add(rep.email);
            console.log('[EMAIL] + Added sales rep email to CC:', rep.email, '(id:', rep.id, ', code:', actor.salesRepId, ')');
          } else {
            console.log('[EMAIL] No SALES_REP found with binShihonWorkerId =', actor.salesRepId);
          }
        } else {
          console.log('[EMAIL] Actor has no salesRepId value');
        }
      } else {
        console.warn('[EMAIL] Actor not found for userId:', redemption.userId);
      }
    }

    if (!toRecipients.size) {
      console.warn('[EMAIL] No TO recipients; skipping send');
      return;
    }

    const to = Array.from(toRecipients);
    const cc = Array.from(ccRecipients);
    const bcc = Array.from(bccRecipients);

    console.log('[EMAIL] FINAL TO:', to, 'CC:', cc, 'BCC:', bcc);

    const subject = `✅ Redemption Approved — ${redemption?.rewards ?? redemption?.rewardId ?? ''}`;
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
        <h2 style="margin:0 0 8px">Redemption Approved</h2>
        <p>A redemption request has been <b>APPROVED</b>:</p>
        <table cellpadding="6" cellspacing="0" b     order="0" style="border-collapse:collapse">
          <tr><td><b>ID</b></td><td>${redemption?.id ?? ''}</td></tr>
          <tr><td><b>User</b></td><td>${redemption?.name ?? ''} (${redemption?.role ?? ''})</td></tr>
          <tr><td><b>Phone</b></td><td>${redemption?.phone ?? ''}</td></tr>
          <tr><td><b>Reward</b></td><td>${redemption?.rewards ?? redemption?.rewardId ?? ''}</td></tr>
          <tr><td><b>Required Points</b></td><td>${redemption?.requiredPoints ?? redemption?.pointsConsumed ?? ''}</td></tr>
          <tr><td><b>Points Accumulated</b></td><td>${redemption?.pointsAccumulated ?? ''}</td></tr>
          <tr><td><b>Location</b></td><td>${redemption?.location ?? ''}</td></tr>
          <tr><td><b>Requested At</b></td><td>${redemption?.requestDate ?? ''}</td></tr>
          <tr><td><b>Approved At</b></td><td>${new Date().toISOString()}</td></tr>
        </table>
        <p style="margin-top:16px">— Redemption System</p>
      </div>
    `;

    await sendMail({ to, subject, html, cc: cc, bcc: bcc });
  } catch (err) {
    console.error('[EMAIL ERROR]', err.message);
  }
}

module.exports = {
  sendApprovalEmail,
  sendEmailToRedemptionStakeholders,
};

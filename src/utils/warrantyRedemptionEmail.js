// src/utils/warrantyRedemptionUtils.js
const PDFDocument = require('pdfkit');
const { User, BranchManager } = require('../models');
const { sendMail } = require('./mailer');

// CSV in .env, e.g. REDEMPTION_APPROVAL_TO="someone@example.com,ops@example.com"
const DEFAULT_RECIPIENTS = (process.env.REDEMPTION_APPROVAL_TO)
  .split(',').map((s) => s.trim()).filter(Boolean);

// Optional CC/BCC via env if you want (safe to leave empty)
const DEFAULT_CC = (process.env.REDEMPTION_APPROVAL_CC || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

const DEFAULT_BCC = (process.env.REDEMPTION_APPROVAL_BCC || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

// Toggle attaching PDF (default on)
const ATTACH_PDF = (process.env.REDEMPTION_ATTACH_PDF || 'true').toLowerCase() !== 'false';

// ---------- Helpers ---------------------------------------------------------

/**
 * Human-friendly datetime formatter.
 * Defaults to Asia/Riyadh and 12-hour time. Adjust as needed.
 */
function prettyDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);

  // Try to format in Asia/Riyadh (user’s timezone)
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium', // e.g., 27 Sept 2025
      timeStyle: 'short',  // e.g., 03:15
      hour12: true,
      timeZone: 'Asia/Riyadh',
    }).format(d);
  } catch {
    // Fallback if timezone not available
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: true,
    }).format(d);
  }
}

/** Generic value -> string with good date handling. */
/** Generic value -> string with good date handling. */
// --- add this helper above fmt ---
function looksLikeDateString(s) {
  return typeof s === 'string' && (
    /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+\-]\d{2}:\d{2})?)?$/.test(s) // ISO-ish
  );
}

/** Generic value -> string with good date handling (no numbers). */
function fmt(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);     // <- keep numbers as numbers
  if (v instanceof Date) return prettyDate(v);
  if (looksLikeDateString(v)) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : prettyDate(d);
  }
  return String(v);
}


// --- bottom-anchored layout constants (shared) ---
const SIG_BOX_HEIGHT = 80;   // inner box height
const SIG_BLOCK_HEIGHT = 150;  // total height consumed by signature block
const FOOTER_HEIGHT = 36;   // separator line + footer text
const BOTTOM_RESERVED = SIG_BLOCK_HEIGHT + FOOTER_HEIGHT; // 186pt

/**
 * Draw a two-column signature block for Sales Rep and Branch Manager.
 * Returns total height consumed (matches SIG_BLOCK_HEIGHT).
 */
function drawSignatureBlock(doc, customerName = '') {
  const startY = doc.y;
  const startX = 42;
  const colGap = 18;
  const rightEdge = 553; // A4 width - 2×42 margins
  const totalUsableWidth = rightEdge - startX; // 511 usable width

  // Three equal columns
  const colWidth = (totalUsableWidth - colGap * 2) / 3;
  const col1X = startX;
  const col2X = col1X + colWidth + colGap;
  const col3X = col2X + colWidth + colGap;

  const drawSigColumn = (x, title, name) => {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text(title, x, startY);
    doc.font('Helvetica').fontSize(10).text('Name:', x, doc.y + 6);
    const nameLineY = doc.y + 12;
    const nameText = name ? ` ${name}` : '';
    if (nameText) doc.text(nameText, x + 36, nameLineY - 12);

    doc.moveTo(x + 36, nameLineY).lineTo(x + colWidth, nameLineY)
      .strokeColor('#aaaaaa').stroke();

    const sigTop = nameLineY + 12;
    doc.fontSize(10).fillColor('#444').text('Signature / Stamp:', x, sigTop);
    const boxTop = sigTop + 14;
    doc.rect(x, boxTop, colWidth, SIG_BOX_HEIGHT)
      .strokeColor('#888888').stroke();

    return boxTop + SIG_BOX_HEIGHT;
  };

  const endYLeft = drawSigColumn(col1X, 'Sales Representative');
  const endYCenter = drawSigColumn(col2X, 'Branch Manager');
  const endYRight = drawSigColumn(col3X, 'Customer', customerName);

  const endY = Math.max(endYLeft, endYCenter, endYRight);
  doc.y = endY + 12;
  return SIG_BLOCK_HEIGHT;
}

const plain = (v) => (v === null || v === undefined ? '' : String(v));
/**
 * Build a simple 1-page PDF summary and return as Buffer
 * @param {Object} data - redemption payload (plain object)
 * @returns {Promise<Buffer>}
 */
function buildRedemptionPdf(data = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ---------------- Header ----------------
    doc.fontSize(18).fillColor('black').text('Redemption Approval Summary', { align: 'left' });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor('#555').text(`Generated at: ${fmt(new Date())}`);
    doc.fillColor('black').moveDown(1);

    // Separator
    doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.6);

    // ---------------- Key details table ----------------
    const rows = [
      ['Name', `${fmt(data.name)}${data.role ? ` (${fmt(data.role)})` : ''}`],
      ['Phone', data.phone],
      ['Reward', data.rewards ?? data.rewardId],
      ['Required Points', plain(data.requiredPoints ?? data.pointsConsumed)], // <- plain
      ['Points Accumulated', plain(data.pointsAccumulated ?? 0)],            // <- plain
      ['Location', data.location],
      ['Requested At', fmt(data.requestDate)],   // dates keep fmt()
      ['Approved At', fmt(new Date())],      // human-readable via fmt()
    ];

    const labelWidth = 150;
    const startX = 42;
    let y = doc.y;

    doc.fontSize(12).fillColor('black');
    rows.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(fmt(label), startX, y, { width: labelWidth });
      doc.font('Helvetica').text(fmt(value), startX + labelWidth + 8, y, {
        width: 553 - startX - labelWidth - 8,
      });
      y = doc.y + 6;
    });

    // -------------- Bottom anchoring (no cut / no spill) --------------
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    const yAfterTable = doc.y;

    // Where signatures must start so signature+footer fully fit
    const sigStartY = pageBottom - BOTTOM_RESERVED;

    // If table already used too much space, go to a new page and anchor there
    if (yAfterTable > sigStartY) {
      doc.addPage();
    }

    // Recompute for (current/new) page and anchor signatures to bottom
    const pageBottom2 = doc.page.height - doc.page.margins.bottom;
    const sigStartY2 = pageBottom2 - BOTTOM_RESERVED;
    doc.y = sigStartY2;

    // Signature block
    // Signature block (include customer name for display)
    drawSignatureBlock(doc, data.name || '');


    // Footer
    doc.moveDown(0.4);
    doc.strokeColor('#cccccc').moveTo(42, doc.y).lineTo(553, doc.y).stroke();
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor('#666').text('— Redemption System', { align: 'left' });

    doc.end();
  });
}


// <tr><td><b>ID</b></td><td>${payload.id ?? ''}</td></tr>
function buildApprovalEmailHtml(payload) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
      <h2 style="margin:0 0 8px">Redemption Approved</h2>
      <p>The following redemption request has been <b>APPROVED</b>:</p>
      <table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse">
      
        <tr><td><b>Name</b></td><td>${payload.name ?? ''} (${payload.role ?? ''})</td></tr>
        <tr><td><b>Phone</b></td><td>${payload.phone ?? ''}</td></tr>
        <tr><td><b>Reward</b></td><td>${payload.rewards ?? ''}</td></tr>
        <tr><td><b>Required Points</b></td><td>${payload.requiredPoints ?? ''}</td></tr>
        <tr><td><b>Points Accumulated</b></td><td>${payload.pointsAccumulated ?? ''}</td></tr>
        <tr><td><b>Location</b></td><td>${payload.location ?? ''}</td></tr>
        <tr><td><b>Requested At</b></td><td>${prettyDate (payload.requestDate )?? ''}</td></tr>
        <tr><td><b>Approved At</b></td><td>${prettyDate(new Date())}</td></tr>

      </table>
      <p style="margin-top:16px">PDF summary is attached.</p>
      <p style="margin-top:16px">— Redemption System</p>
    </div>
  `;
}

function buildStakeholderEmailHtml(redemption) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
      <h2 style="margin:0 0 8px">Redemption Approved</h2>
      <p>A redemption request has been <b>APPROVED</b>:</p>
      <table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse">
     
        <tr><td><b>User</b></td><td>${redemption?.name ?? ''} (${redemption?.role ?? ''})</td></tr>
        <tr><td><b>Phone</b></td><td>${redemption?.phone ?? ''}</td></tr>
        <tr><td><b>Reward</b></td><td>${redemption?.rewards ?? redemption?.rewardId ?? ''}</td></tr>
        <tr><td><b>Required Points</b></td><td>${redemption?.requiredPoints ?? redemption?.pointsConsumed ?? ''}</td></tr>
        <tr><td><b>Points Accumulated</b></td><td>${redemption?.pointsAccumulated ?? ''}</td></tr>
        <tr><td><b>Location</b></td><td>${redemption?.location ?? ''}</td></tr>
       <tr><td><b>Requested At</b></td><td>${prettyDate(redemption?.requestDate)}</td></tr>
        <tr><td><b>Approved At</b></td><td>${prettyDate(new Date())}</td></tr>

      </table>
      <p style="margin-top:16px">PDF summary is attached.</p>
      <p style="margin-top:16px">— Redemption System</p>
    </div>
  `;
}

// ---------- Public functions -----------------------------------------------

/**
 * Simple approval email to the default recipients.
 * @param {Object} payload - plain object with redemption fields
 */
async function sendApprovalEmail(payload) {
  const to = DEFAULT_RECIPIENTS;
  if (!to.length) return; // nothing to send to

  const subject = `✅ Redemption Approved — ${payload.rewards} for ${payload.name}`;
  const html = buildApprovalEmailHtml(payload);

  let attachments = [];
  if (ATTACH_PDF) {
    try {
      const pdfBuffer = await buildRedemptionPdf(payload);
      attachments.push({
        filename: `Redemption-${payload.id || 'summary'}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    } catch (e) {
      console.error('[EMAIL] PDF build failed (sendApprovalEmail):', e.message);
    }
  }

  await sendMail({ to, subject, html, cc: DEFAULT_CC, bcc: DEFAULT_BCC, attachments });
}

/**
 * Stakeholder email that looks up Sales Rep + Branch Manager by branchCode.
 * Falls back to DEFAULT_RECIPIENTS if lookups fail.
 * @param {Object} redemption - Sequelize instance or plain object with keys:
 *   salesRepUserId, rewardId, pointsConsumed, userId, name, role, phone, rewards, ...
 */
// async function sendEmailToRedemptionStakeholders(redemption) {
//   try {
//     const toRecipients = new Set(DEFAULT_RECIPIENTS);
//     const ccRecipients = new Set(DEFAULT_CC);
//     const bccRecipients = new Set(DEFAULT_BCC);

//     if (redemption?.userId) {
//       // 1️⃣ Load actor
//       const actor = await User.findByPk(String(redemption.userId)).catch(() => null);
//       if (actor) {
//         if (actor.email) {
//           toRecipients.add(actor.email);
//           console.log('[EMAIL] + Added actor email to TO:', actor.email);
//         }

//         // 2️⃣ Find sales rep by actor.salesRepId
//         if (actor.salesRepId) {
//           const rep = await User.findOne({
//             where: { role: 'SALES_REP', binShihonWorkerId: actor.salesRepId },
//           }).catch(() => null);

//           if (rep?.email) {
//             ccRecipients.add(rep.email);
//             console.log('[EMAIL] + Added sales rep email to CC:', rep.email, '(id:', rep.id, ', code:', actor.salesRepId, ')');
//           } else {
//             console.log('[EMAIL] No SALES_REP found with binShihonWorkerId =', actor.salesRepId);
//           }
//         } else {
//           console.log('[EMAIL] Actor has no salesRepId value');
//         }
//       } else {
//         console.warn('[EMAIL] Actor not found for userId:', redemption.userId);
//       }
//     }

//     if (!toRecipients.size) {
//       console.warn('[EMAIL] No TO recipients; skipping send');
//       return;
//     }

//     const to = Array.from(toRecipients);
//     const cc = Array.from(ccRecipients);
//     const bcc = Array.from(bccRecipients);

//     console.log('[EMAIL] FINAL TO:', to, 'CC:', cc, 'BCC:', bcc);

//     const subject = `✅ Redemption Approved — ${redemption?.rewards ?? redemption?.rewardId ?? ''}`;
//     const html = buildStakeholderEmailHtml(redemption);

//     let attachments = [];
//     if (ATTACH_PDF) {
//       try {
//         const pdfBuffer = await buildRedemptionPdf(redemption);
//         attachments.push({
//           filename: `Redemption-${redemption?.id || 'summary'}.pdf`,
//           content: pdfBuffer,
//           contentType: 'application/pdf',
//         });
//       } catch (e) {
//         console.error('[EMAIL] PDF build failed (stakeholders):', e.message);
//       }
//     }

//     await sendMail({ to, subject, html, cc, bcc, attachments });
//   } catch (err) {
//     console.error('[EMAIL ERROR]', err.message);
//   }
// }
async function sendEmailToRedemptionStakeholders(redemption) {
  try {
    const toRecipients = new Set(DEFAULT_RECIPIENTS);
    const ccRecipients = new Set(DEFAULT_CC);
    const bccRecipients = new Set(DEFAULT_BCC);

    if (redemption?.userId) {
      // 1️⃣ Load the actor (Customer / BO / Technician)
      const actor = await User.findByPk(String(redemption.userId)).catch(() => null);
      let salesRep = null; // declare outside to use later

      if (actor) {
        // Actor email → TO
        if (actor.email) {
          toRecipients.add(actor.email);
          console.log('[EMAIL] + Added actor email to TO:', actor.email);
        }

        // 2️⃣ Find Sales Rep by actor.salesRepId
        if (actor.salesRepId) {
          salesRep = await User.findOne({
            where: { salesRepId: actor.salesRepId, role: 'SALES_REP' },
          }).catch(() => null);

          if (salesRep?.email) {
            ccRecipients.add(salesRep.email);
            console.log('[EMAIL] + Added Sales Rep email to CC:', salesRep.email, '(id:', actor.salesRepId, ')');
          } else {
            console.log('[EMAIL] No SALES_REP found with id =', actor.salesRepId);
          }
        } else {
          console.log('[EMAIL] Actor has no salesRepId');
        }

        // 3️⃣ Find Branch Manager via salesRep.branchManagerId
        if (salesRep?.branchManagerId) {
          const branchManager = await User.findOne({
            where: { branchManagerId: salesRep.branchManagerId, role: 'BRANCH_MANAGER' },
          }).catch(() => null);

          if (branchManager?.email) {
            ccRecipients.add(branchManager.email);
            console.log('[EMAIL] + Added Branch Manager email to CC:', branchManager.email, '(id:', salesRep.branchManagerId, ')');
          } else {
            console.log('[EMAIL] No BRANCH_MANAGER found with id =', salesRep.branchManagerId);
          }
        } else {
          console.log('[EMAIL] Sales Rep has no branchManagerId field');
        }
      } else {
        console.warn('[EMAIL] Actor not found for userId:', redemption.userId);
      }
    }

    // 4️⃣ Ensure there’s at least one TO recipient
    if (!toRecipients.size) {
      console.warn('[EMAIL] No TO recipients; skipping send');
      return;
    }

    const to = Array.from(toRecipients);
    const cc = Array.from(ccRecipients);
    const bcc = Array.from(bccRecipients);

    console.log('[EMAIL] FINAL TO:', to, 'CC:', cc, 'BCC:', bcc);

    const subject = `✅ Redemption Approved — ${redemption?.rewards ?? redemption?.rewardId ?? ''}`;
    const html = buildStakeholderEmailHtml(redemption);

    let attachments = [];
    if (ATTACH_PDF) {
      try {
        const pdfBuffer = await buildRedemptionPdf(redemption);
        attachments.push({
          filename: `Redemption-${redemption?.id || 'summary'}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        });
      } catch (e) {
        console.error('[EMAIL] PDF build failed (stakeholders):', e.message);
      }
    }

    await sendMail({ to, cc, bcc, subject, html, attachments });
  } catch (err) {
    console.error('[EMAIL ERROR]', err.message);
  }
}


module.exports = {
  sendApprovalEmail,
  sendEmailToRedemptionStakeholders,
};

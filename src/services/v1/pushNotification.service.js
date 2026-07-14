const { getFirebaseMessaging } = require('../../config/firebase');
const {
  getFcmTokensForSalesRep,
  removeFcmTokens,
} = require('./deviceToken.service');

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

async function sendTaskAssignedNotification({ salesRepId, taskId, customerName }) {
  if (!salesRepId || !taskId) {
    console.warn('[PUSH] skipped — missing salesRepId or taskId', { salesRepId, taskId });
    return { sent: 0, skipped: true, reason: 'missing_fields' };
  }

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.warn('[PUSH] skipped — firebase_not_configured', { salesRepId, taskId });
    return { sent: 0, skipped: true, reason: 'firebase_not_configured' };
  }

  const tokens = await getFcmTokensForSalesRep(salesRepId);
  if (!tokens.length) {
    console.warn('[PUSH] skipped — no_tokens for salesRepId=', salesRepId, 'taskId=', taskId);
    return { sent: 0, skipped: true, reason: 'no_tokens' };
  }

  const title = 'مهمة جديدة';
  const body = customerName
    ? `تم تعيين مهمة جديدة لك العميل : ${customerName}`
    : 'تم تعيين مهمة جديدة لك';
  const taskIdStr = String(taskId);

  console.log('[PUSH] sending task_assigned', {
    salesRepId,
    taskId: taskIdStr,
    customerName: customerName || null,
    tokenCount: tokens.length,
  });

  const response = await messaging.sendEachForMulticast({
    notification: {
      title,
      body,
    },
    data: {
      title,
      body,
      taskId: taskIdStr,
      type: 'task_assigned',
    },
    android: {
      priority: 'high',
      collapseKey: 'task_assigned',
      notification: {
        channelId: 'task_notifications',
        tag: taskIdStr,
      },
    },
    tokens,
  });

  const invalidTokens = [];
  response.responses.forEach((item, index) => {
    if (!item.success) {
      console.error('[PUSH] token failed', {
        index,
        code: item.error?.code,
        message: item.error?.message,
      });
      if (INVALID_TOKEN_CODES.has(item.error?.code)) {
        invalidTokens.push(tokens[index]);
      }
    }
  });

  if (invalidTokens.length) {
    await removeFcmTokens(invalidTokens);
  }

  console.log('[PUSH] result', {
    salesRepId,
    taskId,
    sent: response.successCount,
    failed: response.failureCount,
    invalidRemoved: invalidTokens.length,
  });

  return {
    sent: response.successCount,
    failed: response.failureCount,
    invalidRemoved: invalidTokens.length,
  };
}

module.exports = {
  sendTaskAssignedNotification,
};

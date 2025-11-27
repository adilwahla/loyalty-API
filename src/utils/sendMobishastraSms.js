const axios = require('axios');
const querystring = require('querystring');


const AX = axios.create({
  timeout: parseInt(process.env.MOBIS_TIMEOUT_MS || '5000', 10), // 5s cap
});

async function sendMobishastraSms(phone, otp) {

    const apiUrl = process.env.MOBIS_URL;
    const user = process.env.MOBIS_USER;  // ✅ your Mobishastra username
    const pwd = process.env.MOBIS_PWD;    // ✅ your password
    const senderId = process.env.MOBIS_SENDER;  // ✅ your approved sender ID
    const countryCode = process.env.MOBIS_COUNTRY_CODE;
  //  const message = `Your OTP is ${otp}. Please use it to verify your identity.`;
  // ✅ Flutter App Hash (from SmsAutoFill)
  const APP_HASH = "HdCMaTHtXex";

  // ✅ Keep your message exactly the same — just append 2 new lines:
  const message = `Your OTP is ${otp}. Please use it to verify your identity.

<#> Bin Shihon Loyalty
${APP_HASH}`;
    const query = querystring.stringify({
        user,
        pwd,
        senderid: senderId,
        CountryCode: countryCode,
        mobileno: phone,
        msgtext: message,
    });

    const fullUrl = `${apiUrl}?${query}`;
  //  console.log('[Mobishastra] URL →', fullUrl);

    try {
        const response = await axios.get(fullUrl);
        console.log('[Mobishastra] SMS sent → Response:', response.data);
        return true;
    } catch (err) {
        console.error('[Mobishastra] Failed to send SMS:', err.message);
        return false;
    }
}


/** NEW: Approval message (English + Arabic). No OTP here. */
function buildParams({ phone, message }) {
  const params = {
    user: process.env.MOBIS_USER,
    pwd: process.env.MOBIS_PWD,
    senderid: process.env.MOBIS_SENDER,
    CountryCode: process.env.MOBIS_COUNTRY_CODE || '966',
    mobileno: phone,
    msgtext: message,
  };
  if (String(process.env.MOBIS_UNICODE || '').trim() === '1') params.unicode = 1;
  return params;
}

// NEW: bilingual approval SMS (no OTP here)
async function sendApprovalSms(phone) {
  try {
    const english =
      'Bin-Shihon Group Loyalty Rewards: Your profile has been approved. You can now log in to the mobile app, scan QR codes to activate warranties, and redeem rewards.';
    const arabic =
      'مكافآت مجموعة بن شيهون : تم اعتماد ملفك. يمكنك الآن تسجيل الدخول إلى تطبيق الجوال ومسح رموز QR لتفعيل الضمان واستبدال النقاط بالمكافآت.';
    const message = `${english}\n${arabic}`;

    const url = `${process.env.MOBIS_URL}?${querystring.stringify(buildParams({ phone, message }))}`;
    const { data } = await AX.get(url);
    console.log('[Mobishastra][APPROVAL] sent →', data);
    return true;
  } catch (err) {
    console.error('[Mobishastra][APPROVAL] failed →', err.message);
    return false; // <-- never throws
  }
}

 // module.exports = sendMobishastraSms;
 module.exports = { sendMobishastraSms, sendApprovalSms };
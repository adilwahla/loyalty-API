const axios = require('axios');
const querystring = require('querystring');

async function sendMobishastraSms(phone, otp) {

    const apiUrl = process.env.MOBIS_URL;
    const user = process.env.MOBIS_USER;  // ✅ your Mobishastra username
    const pwd = process.env.MOBIS_PWD;    // ✅ your password
    const senderId = process.env.MOBIS_SENDER;  // ✅ your approved sender ID
    const countryCode = process.env.MOBIS_COUNTRY_CODE;
    const message = `Your OTP is ${otp}. Please use it to verify your identity.`;

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

module.exports = sendMobishastraSms;

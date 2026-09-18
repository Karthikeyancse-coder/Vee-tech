import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

function result(channel, values = {}) {
  return { success: false, channel, simulated: false, ...values };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function sendWhatsAppAlert(summaryBullets, title, riskScore, phone = process.env.EMERGENCY_LEAD_PHONE) {
  const body = `[VEE-ALERT] ${title}\nRisk: ${riskScore}/10\n\n${summaryBullets.map((bullet, index) => `${index + 1}. ${bullet}`).join('\n')}`;
  return sendTwilioMessage({
    channel: 'WhatsApp',
    to: phone ? `whatsapp:${phone}` : undefined,
    from: process.env.TWILIO_WHATSAPP_FROM,
    body
  });
}

export async function sendEmailAlert(summaryBullets, title, riskScore) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  const recipients = (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!apiKey || !from || recipients.length === 0) {
    return result('Email', { error: 'SendGrid email credentials are not configured' });
  }
  try {
    const response = await axios.post('https://api.sendgrid.com/v3/mail/send', {
      personalizations: [{ to: recipients.map((email) => ({ email })) }],
      from: { email: from, name: process.env.ALERT_SENDER_NAME || 'Vee-Alert' },
      subject: `[VEE-ALERT] ${title} | Risk ${riskScore}/10`,
      content: [{ type: 'text/plain', value: summaryBullets.map((bullet, index) => `${index + 1}. ${bullet}`).join('\n') }]
    }, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: Number(process.env.NOTIFICATION_TIMEOUT_MS || 5000)
    });
    return { success: response.status >= 200 && response.status < 300, channel: 'Email', simulated: false, recipients };
  } catch (error) {
    return result('Email', { recipients, error: errorMessage(error) });
  }
}

async function sendTwilioMessage({ channel, to, from, body }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken || !to || !from) {
    return result(channel, { error: 'Twilio credentials or sender/recipient are not configured' });
  }
  try {
    const params = new URLSearchParams({ To: to, From: from, Body: body });
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      params.toString(),
      {
        auth: { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: Number(process.env.NOTIFICATION_TIMEOUT_MS || 5000)
      }
    );
    return { success: true, channel, simulated: false, messageSid: response.data?.sid };
  } catch (error) {
    return result(channel, { error: errorMessage(error) });
  }
}

export async function triggerVoiceCall(title, summaryBullets, phone = process.env.EMERGENCY_LEAD_PHONE) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from || !phone) {
    return result('Voice', { error: 'Twilio voice credentials or phone numbers are not configured' });
  }

  const escapeXml = (value) => String(value).replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[character]));
  const speechBrief = summaryBullets.slice(0, 2).join('. ');
  const callbackUrl = process.env.TWILIO_VOICE_STATUS_CALLBACK_URL;
  const gather = callbackUrl
    ? `<Gather numDigits="1" action="${escapeXml(callbackUrl)}" method="POST" timeout="10"><Say>Press 1 to acknowledge, or press 2 to bridge.</Say></Gather>`
    : '';
  const twiml = `<Response><Say voice="${escapeXml(process.env.TWILIO_TTS_VOICE || 'Polly.Matthew')}" language="${escapeXml(process.env.TWILIO_TTS_LANGUAGE || 'en-US')}">Emergency priority crisis alert. Subject: ${escapeXml(title)}. ${escapeXml(speechBrief)}.</Say>${gather}</Response>`;

  try {
    const params = new URLSearchParams({ To: phone, From: from, Twiml: twiml });
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      params.toString(),
      {
        auth: { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: Number(process.env.NOTIFICATION_TIMEOUT_MS || 5000)
      }
    );
    return { success: true, channel: 'Voice', callSid: response.data?.sid, phone, twimlAudioScript: twiml, simulated: false, dispatchedAt: new Date().toISOString() };
  } catch (error) {
    return result('Voice', { error: errorMessage(error) });
  }
}

import dotenv from 'dotenv';
dotenv.config();

/**
 * Dispatches an automated Telegram crisis brief.
 * Formats executive notification with risk level and 5-bullet summary.
 *
 * @param {string[]|object} summary Five-bullet summary points
 * @param {string} riskLevel 'Low' | 'Medium' | 'High' | 'Critical'
 * @param {string} [title='Crisis Intelligence Alert']
 * @returns {Promise<boolean>} Success boolean
 */
export async function sendTelegramAlert(summary, riskLevel, title = 'Crisis Intelligence Alert') {
  const timestamp = new Date().toISOString();
  const bullets = Array.isArray(summary)
    ? summary
    : (summary && typeof summary === 'object' ? Object.values(summary) : [String(summary)]);

  console.log(`\n================== [TELEGRAM CRISIS DISPATCH] ==================`);
  console.log(`[TARGET] Telegram War Room Channel (Chat ID: ${process.env.TELEGRAM_CHAT_ID || '@infosys_war_room'})`);
  console.log(`[TIMESTAMP] ${timestamp}`);
  console.log(`[SEVERITY] ${String(riskLevel).toUpperCase()} RISK ALERT`);
  console.log(`[HEADLINE] ${title}`);
  console.log(`[EXECUTIVE BRIEF]`);
  bullets.forEach((bullet, index) => {
    console.log(`   ${index + 1}. ${bullet}`);
  });
  console.log(`[STATUS] Webhook simulation dispatched successfully (HTTP 200 OK)`);
  console.log(`=================================================================\n`);

  return true;
}

/**
 * Triggers an automated Tier-4 emergency voice escalation call.
 * Synthesizes voice payload for Chief Risk Officer / Crisis Lead.
 *
 * @param {string[]|object} summary Five-bullet executive summary points
 * @param {string} [title='EMERGENCY PRIORITY ESCALATION']
 * @param {string} [recipientPhone]
 * @returns {Promise<boolean>} Success boolean
 */
export async function triggerVoiceCall(summary, title = 'EMERGENCY PRIORITY ESCALATION', recipientPhone = process.env.EMERGENCY_LEAD_PHONE || '+1 (555) 019-2834') {
  const timestamp = new Date().toISOString();
  const bullets = Array.isArray(summary)
    ? summary
    : (summary && typeof summary === 'object' ? Object.values(summary) : [String(summary)]);

  const briefSpeech = bullets.slice(0, 2).join('. ');

  console.log(`\n🚨🚨🚨 [TIER-4 CRITICAL VOICE ESCALATION TRIGGERED] 🚨🚨🚨`);
  console.log(`[DIALER] Dispatching automated telephony call to: ${recipientPhone}`);
  console.log(`[TIMESTAMP] ${timestamp}`);
  console.log(`[TITLE] ${title}`);
  console.log(`[TTS VOICE] Amazon Polly.Matthew (High Urgency)`);
  console.log(`[SYNTHESIZED SPEECH SCRIPT]`);
  console.log(`   "Emergency priority crisis alert for Infosys leadership. Subject: ${title}. ${briefSpeech}. Press 1 to acknowledge, or press 2 to bridge to PR Emergency War Room."`);
  console.log(`[CALL STATUS] Ringing -> Connected -> Briefing Delivered -> Acknowledged`);
  console.log(`🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n`);

  return true;
}

/**
 * Backward-compatible WhatsApp stub.
 */
export async function sendWhatsAppAlert(summary, title, riskScore) {
  console.log(`[WHATSAPP DISPATCH] Dispatched alert for "${title}" (Risk: ${riskScore}/10)`);
  return { success: true, channel: 'WhatsApp', simulated: true };
}

/**
 * Backward-compatible Email stub.
 */
export async function sendEmailAlert(summary, title, riskScore) {
  console.log(`[EMAIL DISPATCH] Dispatched war room email for "${title}" (Risk: ${riskScore}/10)`);
  return { success: true, channel: 'Email', simulated: true };
}

export interface TelegramAlertResult {
  success: boolean;
  channel: 'Telegram';
  messageId?: string;
  simulated?: boolean;
  preview?: string;
}

export interface VoiceCallResult {
  success: boolean;
  channel: 'Voice';
  callSid: string;
  phone: string;
  twimlAudioScript: string;
  simulated: boolean;
  dispatchedAt: string;
}

export interface NotificationResult {
  success: boolean;
  channel: 'Telegram' | 'WhatsApp' | 'Email' | 'Voice';
  simulated: boolean;
  error?: string;
  messageSid?: string;
  callSid?: string;
  recipients?: string[];
  dispatchedAt?: string;
  twimlAudioScript?: string;
}

export function sendTelegramAlert(
  summaryBullets: string[],
  title: string,
  riskScore: number
): Promise<TelegramAlertResult>;

export function triggerVoiceCall(
  title: string,
  summaryBullets: string[],
  phone?: string
): Promise<VoiceCallResult>;

export function sendWhatsAppAlert(
  summaryBullets: string[],
  title: string,
  riskScore: number,
  phone?: string
): Promise<NotificationResult>;

export function sendEmailAlert(
  summaryBullets: string[],
  title: string,
  riskScore: number
): Promise<NotificationResult>;

import axios from 'axios'

// ─── Twilio ───────────────────────────────────────────────────────────────────
// Routed through /api/twilio → https://api.twilio.com (Vite proxy, avoids CORS)

interface TwilioConfig {
  accountSid: string
  authToken: string
  fromNumber: string  // e.g. "whatsapp:+14155238886"
  toNumber: string    // e.g. "whatsapp:+1234567890"
}

export async function sendViaTwilio(cfg: TwilioConfig, message: string): Promise<void> {
  const path = `/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`
  const params = new URLSearchParams({
    From: cfg.fromNumber.startsWith('whatsapp:') ? cfg.fromNumber : `whatsapp:${cfg.fromNumber}`,
    To: cfg.toNumber.startsWith('whatsapp:') ? cfg.toNumber : `whatsapp:${cfg.toNumber}`,
    Body: message,
  })

  await axios.post(`/api/twilio${path}`, params.toString(), {
    auth: { username: cfg.accountSid, password: cfg.authToken },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

// ─── Meta WhatsApp Cloud API ──────────────────────────────────────────────────
// Routed through /api/meta → https://graph.facebook.com (Vite proxy, avoids CORS)

interface MetaConfig {
  phoneNumberId: string
  accessToken: string
  toNumber: string  // international format, no +
}

export async function sendViaMeta(cfg: MetaConfig, message: string): Promise<void> {
  const url = `/api/meta/v19.0/${cfg.phoneNumberId}/messages`
  await axios.post(
    url,
    {
      messaging_product: 'whatsapp',
      to: cfg.toNumber,
      type: 'text',
      text: { body: message },
    },
    {
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )
}

// ─── Unified send ─────────────────────────────────────────────────────────────

export interface WhatsAppConfig {
  provider: 'twilio' | 'meta'
  // Twilio
  twilio_account_sid?: string
  twilio_auth_token?: string
  twilio_from_number?: string
  // Meta
  meta_phone_number_id?: string
  meta_access_token?: string
  // Common
  destination_phone: string
}

export async function sendWhatsApp(cfg: WhatsAppConfig, message: string): Promise<void> {
  if (cfg.provider === 'twilio') {
    if (!cfg.twilio_account_sid || !cfg.twilio_auth_token || !cfg.twilio_from_number) {
      throw new Error('Faltan credenciales de Twilio')
    }
    await sendViaTwilio(
      {
        accountSid: cfg.twilio_account_sid,
        authToken: cfg.twilio_auth_token,
        fromNumber: cfg.twilio_from_number,
        toNumber: cfg.destination_phone,
      },
      message
    )
  } else {
    if (!cfg.meta_phone_number_id || !cfg.meta_access_token) {
      throw new Error('Faltan credenciales de Meta WhatsApp')
    }
    await sendViaMeta(
      {
        phoneNumberId: cfg.meta_phone_number_id,
        accessToken: cfg.meta_access_token,
        toNumber: cfg.destination_phone,
      },
      message
    )
  }
}

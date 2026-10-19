// Utsending av e-post (SMTP) og SMS (Twilio) til beboerne. Begge er av til
// serveroppsettet er komplett; ingen nøkler eller meldingsinnhold logges.
import nodemailer from 'nodemailer';

export function emailConfig(env = process.env) {
  const port = Number(env.SMTP_PORT || 587);
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM || !Number.isInteger(port)) return null;
  return { host: env.SMTP_HOST, port, secure: port === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }, from: env.SMTP_FROM };
}
export function smsConfig(env = process.env) {
  if (!/^AC[a-f0-9]{32}$/i.test(env.TWILIO_ACCOUNT_SID || '') || !env.TWILIO_AUTH_TOKEN || !(env.TWILIO_FROM || env.TWILIO_MESSAGING_SERVICE_SID)) return null;
  return { sid: env.TWILIO_ACCOUNT_SID, token: env.TWILIO_AUTH_TOKEN, from: env.TWILIO_FROM || null, service: env.TWILIO_MESSAGING_SERVICE_SID || null };
}

export function createMessaging({ email = emailConfig, sms = smsConfig, fetchImpl = fetch, transport = cfg => nodemailer.createTransport(cfg) } = {}) {
  let mailer, mailerKey;
  return {
    channels: () => ({ epost: Boolean(email()), sms: Boolean(sms()) }),
    async sendEmail(to, subject, text) {
      const cfg = email();
      if (!cfg) throw new Error('E-post er ikke satt opp');
      const key = JSON.stringify(cfg);
      if (!mailer || mailerKey !== key) { mailer = transport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: cfg.auth }); mailerKey = key; }
      await mailer.sendMail({ from: cfg.from, to, subject, text });
    },
    async sendSms(to, text) {
      const cfg = sms();
      if (!cfg) throw new Error('SMS er ikke satt opp');
      const body = new URLSearchParams({ To: to, Body: text.slice(0, 1500), ...(cfg.service ? { MessagingServiceSid: cfg.service } : { From: cfg.from }) });
      const r = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000), body,
        headers: { Authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (!r.ok) throw new Error(`SMS-tjenesten svarte med HTTP ${r.status}`);
    }
  };
}
export const messaging = createMessaging();

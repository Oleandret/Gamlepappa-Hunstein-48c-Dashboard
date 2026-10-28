// Utsending av e-post (SMTP) og SMS (fra iPhonen via iphone-remote) til
// beboerne. Begge er av til serveroppsettet er komplett; ingen nøkler eller
// meldingsinnhold logges.
import nodemailer from 'nodemailer';
import { iphoneSms } from './iphoneSms.js';

export function emailConfig(env = process.env) {
  const port = Number(env.SMTP_PORT || 587);
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM || !Number.isInteger(port)) return null;
  return { host: env.SMTP_HOST, port, secure: port === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }, from: env.SMTP_FROM };
}
export function createMessaging({ email = emailConfig, sms = iphoneSms, transport = cfg => nodemailer.createTransport(cfg) } = {}) {
  let mailer, mailerKey;
  return {
    channels: () => ({ epost: Boolean(email()), sms: sms.configured() }),
    async sendEmail(to, subject, text) {
      const cfg = email();
      if (!cfg) throw new Error('E-post er ikke satt opp');
      const key = JSON.stringify(cfg);
      if (!mailer || mailerKey !== key) { mailer = transport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: cfg.auth }); mailerKey = key; }
      await mailer.sendMail({ from: cfg.from, to, subject, text });
    },
    async sendSms(to, text) {
      if (!sms.configured()) throw new Error('SMS er ikke satt opp');
      await sms.send(to, text);
    }
  };
}
export const messaging = createMessaging();

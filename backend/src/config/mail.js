import nodemailer from 'nodemailer';

// SMTP settings come purely from env (defaults target Gmail):
//   SMTP_HOST (smtp.gmail.com), SMTP_PORT (587), SMTP_SECURE (true = implicit TLS, e.g. port 465),
//   SMTP_EMAIL or SMTP_USER (login), SMTP_PASSWORD (Gmail App Password), SMTP_FROM (optional From address).
// Port 587 uses STARTTLS (secure=false); port 465 uses implicit TLS (secure=true).
const isLocalHost = (host) => ['127.0.0.1', 'localhost', '::1'].includes(host);

export function smtpUser(env = process.env) {
    return env.SMTP_USER || env.SMTP_EMAIL || '';
}

export function smtpOptions(env = process.env) {
    const host = env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(env.SMTP_PORT) || 587;
    const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465;
    const user = smtpUser(env);
    return {
        host,
        port,
        secure,
        // Force STARTTLS on submission ports, but allow plain local fake SMTP servers (dev/tests).
        ...(!secure && !isLocalHost(host) ? { requireTLS: true } : {}),
        ...(user ? { auth: { user, pass: env.SMTP_PASSWORD || '' } } : {}),
        tls: { minVersion: 'TLSv1.2' },
    };
}

export function createTransport(env = process.env) {
    return nodemailer.createTransport(smtpOptions(env));
}

// Gmail only delivers mail whose From is the authenticated account, so From defaults to the SMTP login.
export function fromAddress(env = process.env) {
    return env.SMTP_FROM || smtpUser(env) || env.RECIPIENT_EMAIL;
}

export function logMailStartupChecks(env = process.env, log = console) {
    if (!env.SMTP_PASSWORD) {
        log.warn('[mail] SMTP_PASSWORD is not set - contact-form emails will fail. For Gmail create an App Password and put it in backend/.env (see README).');
    }
    if (!env.RECIPIENT_EMAIL) {
        log.warn('[mail] RECIPIENT_EMAIL is not set - contact-form emails have no recipient.');
    }
}

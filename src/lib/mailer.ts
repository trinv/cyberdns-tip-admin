import nodemailer from 'nodemailer';

// Standard SMTP relay — works with Gmail (an "App Password", not the normal
// account password — see myaccount.google.com/apppasswords), SendGrid,
// Mailgun, AWS SES, or any other SMTP provider. Configured entirely via env
// (see .env.example) so no credentials ever live in source.
//
// Lazily built once and cached: `undefined` means "not built yet", `null`
// means "built once and SMTP_HOST wasn't set, so email alerts are off".
let transporter: ReturnType<typeof nodemailer.createTransport> | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  if (!process.env.SMTP_HOST) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true = implicit TLS (port 465), false = STARTTLS (port 587, the common case)
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

// Fired from recordLoginAttempt (queries.ts) whenever a login succeeds from
// an IP address never seen before for that account — the same real signal
// that already drives the in-app toast warning and the Login History view's
// "IP mới" badge, just also pushed out-of-band via email since a
// compromised account's real owner may not be looking at the app right now.
//
// Deliberately never throws — recordLoginAttempt's contract is that a
// logging failure must never block a real login, and that extends to this:
// if SMTP is unreachable/misconfigured, or SECURITY_ALERT_EMAIL/SMTP_HOST
// simply isn't set (both optional — email alerting is off by default until
// configured), this silently no-ops. The in-app toast warning already
// covers the case where email isn't configured at all.
export async function sendNewIpLoginAlert(data: {
  userEmail: string;
  ipAddress: string;
  userAgent?: string | null;
  time: Date;
}) {
  const to = process.env.SECURITY_ALERT_EMAIL;
  if (!to) return;

  const t = getTransporter();
  if (!t) {
    console.warn('sendNewIpLoginAlert skipped: SMTP_HOST is not set in .env — email alerts are disabled.');
    return;
  }

  const subject = `⚠️ CyberDNS TIP — Đăng nhập từ IP mới (${data.userEmail})`;
  const text = [
    '⚠️ Đăng nhập từ một địa chỉ IP mới chưa từng dùng trước đây.',
    'Nếu không phải bạn, hãy đổi mật khẩu ngay trong phần Người dùng & Phân quyền.',
    '',
    `Tài khoản:        ${data.userEmail}`,
    `Địa chỉ IP:        ${data.ipAddress}`,
    `Thời gian:        ${data.time.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
    data.userAgent ? `Trình duyệt/Thiết bị: ${data.userAgent}` : null,
    '',
    '— CyberDNS Threat Intelligence Platform',
  ]
    .filter((line) => line !== null)
    .join('\n');

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error('sendNewIpLoginAlert failed:', error);
  }
}

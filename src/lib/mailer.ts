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
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return transporter;
}

// Minimal HTML-escaper for the handful of dynamic values spliced into the
// alert email's HTML body below (userEmail, ipAddress, the parsed
// device/browser strings, the formatted time). ipAddress and especially
// userAgent both originate straight from request headers (see
// recordLoginAttempt in queries.ts) — fully attacker-controlled, never
// validated as "safe HTML" — so escaping before interpolation is required,
// not optional: without it, a login request sent with e.g.
// `User-Agent: <a href="...">click me</a>` would inject real markup into a
// security-alert email an admin reads and trusts.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Dependency-free User-Agent split into { device, browser } for the alert
// email's two separate table rows (matches the ops-provided thongbao.html
// template). No UA-parsing library exists anywhere in this repo — checked;
// LoginHistoryView.tsx just shows the raw string as-is — and pulling one in
// for a single internal alert email would be overkill. Regex-only, never
// throws, always returns something readable: falls back to the raw UA
// string on either side when nothing matches, rather than an empty field.
function parseUserAgent(ua: string): { device: string; browser: string } {
  const device = /windows nt 10\.0/i.test(ua)
    ? // Standard UA strings can't tell Windows 10 and 11 apart — both
      // report the exact same "Windows NT 10.0" token, so "10/11" is the
      // most precise honest answer here, not a guess.
      'Windows 10/11'
    : /windows nt 6\.3/i.test(ua)
      ? 'Windows 8.1'
      : /windows nt 6\.1/i.test(ua)
        ? 'Windows 7'
        : /windows/i.test(ua)
          ? 'Windows'
          : // iPhone/iPad UA strings also contain the literal substring
            // "like Mac OS X" (e.g. "CPU iPhone OS 17_5 like Mac OS X"), so
            // the iOS check must run before the macOS one or every iPhone
            // misreports as "macOS".
            /iphone|ipad|ipod/i.test(ua)
            ? 'iOS'
            : /mac os x/i.test(ua)
              ? 'macOS'
              : /android/i.test(ua)
                ? 'Android'
                : /linux/i.test(ua)
                  ? 'Linux'
                  : ua;

  // Order matters: Edge and Opera's UA strings both also carry a "Chrome/"
  // token (they're Chromium-based), and every Chromium/WebKit browser's UA
  // also carries "Safari/" — so the more specific tokens must be checked
  // first and Safari last, or e.g. a real Edge browser would misreport as
  // Chrome.
  const edge = ua.match(/Edg(?:A|iOS)?\/([\d.]+)/i);
  const opera = ua.match(/OPR\/([\d.]+)/i);
  const firefox = ua.match(/Firefox\/([\d.]+)/i);
  const chrome = ua.match(/Chrome\/([\d.]+)/i);
  const safari = /Safari\//i.test(ua) ? ua.match(/Version\/([\d.]+)/i) : null;

  const browser = edge
    ? `Edge ${edge[1]}`
    : opera
      ? `Opera ${opera[1]}`
      : firefox
        ? `Firefox ${firefox[1]}`
        : chrome
          ? `Chrome ${chrome[1]}`
          : safari
            ? `Safari ${safari[1]}`
            : ua;

  return { device, browser };
}

// Production origin this alert email's logo and "đổi mật khẩu" link point
// to — matches deploy/nginx.conf.example's real server_name
// (tip.cyberdns.vn). No APP_URL/PUBLIC_URL env var exists anywhere else in
// this codebase (checked .env.example + every src file), so hardcoding
// here mirrors the deploy doc rather than inventing new env plumbing for
// the one email this app sends.
const APP_ORIGIN = 'https://tip.cyberdns.vn';

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
  const timeText = data.time.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const text = [
    '⚠️ Đăng nhập từ một địa chỉ IP mới chưa từng dùng trước đây.',
    'Nếu không phải bạn, hãy đổi mật khẩu ngay trong phần Người dùng & Phân quyền.',
    '',
    `Tài khoản:        ${data.userEmail}`,
    `Địa chỉ IP:        ${data.ipAddress}`,
    `Thời gian:        ${timeText}`,
    data.userAgent ? `Trình duyệt/Thiết bị: ${data.userAgent}` : null,
    '',
    '— CyberDNS Threat Intelligence Platform',
  ]
    .filter((line) => line !== null)
    .join('\n');

  // HTML body — adapted from the ops-provided thongbao.html template (same
  // table shell, card, footer). The header now carries the real CyberDNS
  // light-variant mark (logo_cyberdns_light.png, the same asset
  // CyberDNSLogo.tsx / index.html already use) plus the app's actual
  // two-tone wordmark styling (Cyber in dark text, DNS in brand green
  // #059669 — see src/components/CyberDNSLogo.tsx) instead of the
  // template's flat solid-blue placeholder text. Every dynamic value below
  // goes through escapeHtml — see its own comment for why that's mandatory
  // here rather than optional.
  const rows: [string, string][] = [['Địa chỉ IP', data.ipAddress]];
  if (data.userAgent) {
    const { device, browser } = parseUserAgent(data.userAgent);
    rows.push(['Thiết bị', device], ['Trình duyệt', browser]);
  }
  rows.push(['Thời gian', timeText]);
  const detailRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:3px 12px 3px 0;">${escapeHtml(label)}</td><td style="padding:3px 0;">${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:Arial,sans-serif;font-size:13px;margin:0;padding:0;background-color:#eaeaea;">
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%" align="center">
    <tr>
      <td align="center" style="padding:30px 12px;">
        <table role="presentation" cellspacing="0" cellpadding="0" width="700" border="0"
               style="width:100%;max-width:700px;padding:25px;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 10px rgba(0,0,0,0.1);">
          <tr>
            <td align="center">
              <img src="${APP_ORIGIN}/logo_cyberdns_light.png" alt="CyberDNS" width="32" height="32" style="vertical-align:middle;margin-right:8px;">
              <span style="font-size:24px;font-weight:bold;color:#1d2630;vertical-align:middle;">Cyber<span style="color:#059669;">DNS</span> TIP</span>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;font-size:13px;line-height:20px;color:#222222;">
              <p>Kính chào Quản trị viên,</p>

              <p>CyberDNS TIP xin thông báo tài khoản <b>${escapeHtml(data.userEmail)}</b> vừa được đăng nhập từ một địa chỉ IP mới, chi tiết như sau:</p>

              <table role="presentation" cellspacing="0" cellpadding="0" style="font-size:13px;color:#222222;">
                ${detailRows}
              </table>

              <p>Nếu thông tin truy cập trên đúng là bạn, vui lòng bỏ qua email này. Ngược lại, nếu không phải thiết bị của bạn có thể ai đó đang cố truy cập vào tài khoản. <a href="${APP_ORIGIN}/users" target="_blank">Hãy đổi mật khẩu ngay trong phần Người dùng &amp; Phân quyền</a>.</p>

              <p>Trân trọng!</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:14px;background-color:#f8f9fa;font-size:13px;color:#222222;">
              CyberDNS Threat Intelligence Platform
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error('sendNewIpLoginAlert failed:', error);
  }
}

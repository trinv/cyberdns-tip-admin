import type { Request, Response, NextFunction } from 'express';

// Content-Security-Policy tuned to exactly what this app loads. Keep it in
// sync with what the client actually pulls in:
//   - own bundled JS/CSS ....................... 'self'
//   - maplibre-gl WASM ........................ script-src 'wasm-unsafe-eval'
//   - maplibre-gl web worker (Blob URL) ....... worker-src blob:
//   - CARTO basemap: style.json + vector tiles + sprite + glyph fonts, all
//     served from *.basemaps.cartocdn.com .... connect-src / img-src
//     (see src/components/ui/map.tsx — change these two lines too if you
//      point the map at a different basemap provider)
//   - Google Fonts: stylesheet + font files .. style-src fonts.googleapis.com,
//                                               font-src fonts.gstatic.com
//   - inline styles: Vite's bootstrap <style> + maplibre-gl / React element
//     styles ................................. style-src 'unsafe-inline'
//     ('unsafe-inline' is allowed for style-src ONLY, never script-src —
//      the standard, low-risk allowance; index.html carries no inline script)
const CARTO = 'https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com';
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${CARTO}`,
  `connect-src 'self' ${CARTO}`,
  "worker-src 'self' blob:",
].join('; ');

// A dev run serves the SPA through Vite's middleware, which injects an inline
// React-Refresh preamble + /@vite/client — a production `script-src 'self'`
// would break it. Dev is localhost-only and not a security boundary, so the
// CSP is production-only; the other headers apply everywhere.
export function securityHeaders() {
  const sendCsp = process.env.NODE_ENV === 'production';
  return (req: Request, res: Response, next: NextFunction) => {
    // HSTS only once TLS actually terminates in front (Nginx + Let's Encrypt,
    // see deploy/). Gate on the proxy's scheme header so a plain-HTTP dev run
    // doesn't advertise a policy it can't keep. `includeSubDomains` is correct
    // for the documented tip.<domain> vhost; drop it if you serve this from a
    // bare apex that has other, non-HTTPS subdomains.
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader(
      'Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
    );
    if (sendCsp) res.setHeader('Content-Security-Policy', CSP);
    next();
  };
}

import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
  showText?: boolean;
  textClassName?: string;
  // 'auto' (default): follows the real page theme via the global `.dark`
  // class on <html> — correct for every normal usage (Sidebar, loading
  // screen, ...) since those surfaces actually change with the theme.
  // 'dark'/'light': FORCES that color scheme regardless of the actual
  // theme toggle — for a surface that never changes (e.g. LoginPage's hero
  // panel, which is always dark-styled): with 'auto', a light-mode toggle
  // would still render "Cyber" in near-black text sitting on that
  // permanently-dark panel, unreadable.
  variant?: 'auto' | 'light' | 'dark';
  glow?: boolean;
}

export const CyberDNSLogo: React.FC<LogoProps> = ({
  className = '',
  size = 32,
  showText = false,
  textClassName = '',
  variant = 'auto',
  glow = false,
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;
  const isAuto = variant === 'auto';
  const isForcedDark = variant === 'dark';

  const cyberTextClass = isAuto ? 'text-foreground' : isForcedDark ? 'text-white' : 'text-slate-900';
  const subtitleClass = isAuto
    ? 'text-slate-500 dark:text-slate-400'
    : isForcedDark
      ? 'text-slate-400'
      : 'text-slate-500';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div
        style={{ width: pixelSize, height: pixelSize }}
        className={`relative flex-shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${
          glow ? 'drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]' : ''
        }`}
      >
        {/* Real logo artwork (public/logo_cyberdns_light.png,
            public/logo_cyberdns_dark.png — a green shield mark on
            transparent for light surfaces, a white shield mark on
            transparent for dark ones) replaces the earlier hand-drawn
            shield paths. PNG, not an SVG using <mask>+feColorMatrix — that
            combo is a known cross-browser rendering gap specifically for
            SVGs loaded via <img>/favicon ("image context", more restricted
            than an inlined <svg>) and was in fact what broke the logo
            everywhere it appears the last time this used SVGs; flattening
            to PNG removes the whole risk category. Both files are cropped
            to their content + resized to a 512px-max master (source was a
            5000px, 1.4–2MB export) — this only ever renders at <=40px CSS,
            so that's still generous headroom for retina. 'auto' stacks both
            and lets the same ambient `.dark` class this file already keyed
            off of (see variant's own doc-comment) show/hide the right one
            via Tailwind `dark:` — no JS theme detection needed. 'light'/
            'dark' render only the single forced variant, matching how
            cyberTextClass below already forces one or the other. */}
        {isAuto ? (
          <>
            <img
              src="/logo_cyberdns_light.png"
              alt="CyberDNS"
              draggable={false}
              className="w-full h-full object-contain transition-colors duration-200 dark:hidden"
            />
            <img
              src="/logo_cyberdns_dark.png"
              alt="CyberDNS"
              draggable={false}
              className="hidden w-full h-full object-contain transition-colors duration-200 dark:block"
            />
          </>
        ) : (
          <img
            src={isForcedDark ? '/logo_cyberdns_dark.png' : '/logo_cyberdns_light.png'}
            alt="CyberDNS"
            draggable={false}
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {showText && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5 leading-none">
            {/* "Cyber" follows the theme like normal text (black in light
                mode, white in dark — text-foreground already resolves to
                that via --text-primary in src/index.css) UNLESS variant
                forces one or the other. "DNS" is always pinned to the same
                fixed brand color (emerald-600, matching every primary
                button/action in the app) regardless of variant/theme —
                it must read the same everywhere. */}
            <span
              className={`font-bold tracking-tight transition-colors ${cyberTextClass} ${textClassName || 'text-lg'}`}
            >
              Cyber<span style={{ color: '#059669' }}>DNS</span>
            </span>
          </div>
          <span className={`text-xs font-medium tracking-wide mt-0.5 ${subtitleClass}`}>
            Threat Intelligence Platform
          </span>
        </div>
      )}
    </div>
  );
};

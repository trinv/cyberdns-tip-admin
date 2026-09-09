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
  const subtitleClass = isAuto ? 'text-slate-500 dark:text-slate-400' : isForcedDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div
        style={{ width: pixelSize, height: pixelSize }}
        className={`relative flex-shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${
          glow ? 'drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]' : ''
        }`}
      >
        {/* Real logo artwork (public/logo_light.svg, public/logo_dark.svg)
            replaces the earlier hand-drawn shield paths — same shield
            silhouette, now sourced from the actual brand asset instead of
            an approximation of it. 'auto' stacks both and lets the same
            ambient `.dark` class this file already keyed off of (see
            variant's own doc-comment) show/hide the right one via Tailwind
            `dark:` — no JS theme detection needed. 'light'/'dark' render
            only the single forced variant, matching how markFill/
            cyberTextClass below already force one or the other. */}
        {isAuto ? (
          <>
            <img
              src="/logo_light.svg"
              alt="CyberDNS"
              draggable={false}
              className="w-full h-full object-contain transition-colors duration-200 dark:hidden"
            />
            <img
              src="/logo_dark.svg"
              alt="CyberDNS"
              draggable={false}
              className="hidden w-full h-full object-contain transition-colors duration-200 dark:block"
            />
          </>
        ) : (
          <img
            src={isForcedDark ? '/logo_dark.svg' : '/logo_light.svg'}
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
            <span className={`font-bold tracking-tight transition-colors ${cyberTextClass} ${textClassName || 'text-lg'}`}>
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

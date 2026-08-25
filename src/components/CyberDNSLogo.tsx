import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
  showText?: boolean;
  textClassName?: string;
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

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div 
        style={{ width: pixelSize, height: pixelSize }}
        className={`relative flex-shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${
          glow ? 'drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]' : ''
        }`}
      >
        <svg
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            {/* Brand teal in light mode, white in dark mode — driven by the
                same global `.dark` class on <html> that toggles every other
                themed color in this app (see src/index.css), so the mark
                switches automatically wherever this component is used. */}
            <style>{`.cyberdns-mark { fill: #128e6f; } .dark .cyberdns-mark { fill: #ffffff; }`}</style>
          </defs>

          {/*
            Geometry matches the reference logo image (shield split into 4
            quadrants by a central vertical/horizontal slit, with a
            4-pointed diamond/star negative-space cutout at the center).

            The reference app-icon image shows the mark filling roughly
            half the canvas, with generous padding around it — the paths
            below (unchanged) were originally sized to nearly fill the
            whole 200x200 viewBox instead, so the rendered logo looked
            noticeably larger/more cropped than the reference. Scaled down
            and re-centered via this <g> instead of hand-editing every
            curve's coordinates, which would risk distorting the shape.
          */}
          <g transform="translate(28,28) scale(0.72)">
            {/* 1. Top-Left Quadrant */}
            <path
              d="M 97 12 C 72 18 42 25 24 28 L 24 97 L 38 97 C 68 97 97 68 97 12 Z"
              className="cyberdns-mark transition-colors duration-200"
            />

            {/* 2. Top-Right Quadrant */}
            <path
              d="M 103 12 C 128 18 158 25 176 28 L 176 97 L 162 97 C 132 97 103 68 103 12 Z"
              className="cyberdns-mark transition-colors duration-200"
            />

            {/* 3. Bottom-Left Quadrant */}
            <path
              d="M 24 103 L 38 103 C 68 103 97 132 97 188 C 76 182 24 148 24 103 Z"
              className="cyberdns-mark transition-colors duration-200"
            />

            {/* 4. Bottom-Right Quadrant */}
            <path
              d="M 176 103 L 162 103 C 132 103 103 132 103 188 C 124 182 176 148 176 103 Z"
              className="cyberdns-mark transition-colors duration-200"
            />
          </g>
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5 leading-none">
            {/* "Cyber" follows the theme like normal text (black in light
                mode, white in dark — text-foreground already resolves to
                that via --text-primary in src/index.css). "DNS" is pinned
                to a fixed brand color instead of the theme-swapping
                text-primary *utility* (a different, confusingly-named
                thing — Tailwind's `--color-primary`, which itself changes
                per theme) — it must read the same in both modes. Uses the
                same emerald-600 as every primary button/action across the
                app, not a separate one-off brand hex. */}
            <span className={`font-bold tracking-tight text-foreground transition-colors ${textClassName || 'text-lg'}`}>
              Cyber<span style={{ color: '#059669' }}>DNS</span>
            </span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-[#0f8564] dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 font-mono">
              TIP v4.0
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide mt-0.5">
            Threat Intelligence Platform
          </span>
        </div>
      )}
    </div>
  );
};

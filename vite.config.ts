import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // Points at src/ (the shadcn/Next.js convention) rather than the repo
        // root — matches components.json's aliases below, needed for the
        // vendored mapcn map component's own `@/lib/utils`/`@/components/ui/*`
        // imports to resolve. Safe: nothing in this codebase used the `@`
        // alias before this (verified — every existing import is relative).
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Split the big, rarely-changing vendors into their own chunks so a
          // returning visitor re-downloads only the app code after a deploy,
          // not React + Chart.js too. maplibre-gl already rides its own lazy
          // chunk (App.tsx code-splits DnsNodesView) — this keeps it isolated
          // even if something else pulls it in.
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler'))
                return 'react';
              if (id.includes('chart.js')) return 'charts';
              if (id.includes('maplibre-gl')) return 'maplibre';
            }
          },
        },
      },
      // maplibre-gl's chunk is legitimately ~1 MB and is already lazy-loaded
      // (only when the DNS Nodes tab opens) — raise the bar so a real
      // regression in the *initial* bundle still stands out.
      chunkSizeWarningLimit: 1200,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      // HMR is disabled because Vite runs behind the custom Express server;
      // the preview proxy only exposes the shared HTTP port.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

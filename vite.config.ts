import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

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

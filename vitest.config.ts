import path from 'path';
import { defineConfig } from 'vitest/config';

// Dedicated config so Vitest does NOT load vite.config.ts (React + Tailwind
// plugins are irrelevant to these pure-function unit tests). Node environment:
// everything under test is server-side (feed parsing, SSRF guard, login rate
// limiter, password hashing).
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

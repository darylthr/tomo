/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// For local development against a real server: TOMO_SUWAYOMI=http://server:4567 pnpm dev
const suwayomi = process.env.TOMO_SUWAYOMI;

export default defineConfig({
  plugins: [react()],
  server: suwayomi ? { proxy: { '/api': { target: suwayomi, changeOrigin: true, ws: true } } } : undefined,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});

/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// For local development against a real server: TOMO_SUWAYOMI=http://server:4567 pnpm dev
const suwayomi = process.env.TOMO_SUWAYOMI;
// ...and TOMO_DAV=http://server:8080 for the novels' WebDAV share, served under /dav/.
const dav = process.env.TOMO_DAV;

export default defineConfig({
  plugins: [react()],
  server:
    suwayomi || dav
      ? {
          proxy: {
            ...(suwayomi && { '/api': { target: suwayomi, changeOrigin: true, ws: true } }),
            ...(dav && { '/dav': { target: dav, changeOrigin: true, rewrite: (path: string) => path.replace(/^\/dav/, '') } }),
          },
        }
      : undefined,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});

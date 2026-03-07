import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // index.html lives at the project root — Vite's default convention.
  // 'public/' is for static assets only (favicon, etc.).
  publicDir: 'public',

  // Local dev: base = '/'
  // GitHub Pages build (GITHUB_PAGES=true in CI): base = '/abyssarium/'
  base: process.env['GITHUB_PAGES'] === 'true' ? '/abyssarium/' : '/',

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    outDir:      'dist',
    emptyOutDir: true,
  },

  server: {
    port: 5173,
    open: true,
  },
});

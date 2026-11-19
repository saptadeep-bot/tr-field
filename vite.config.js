import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes the live app (dist/) for Cloudflare Pages.
// `npm run build:preview` makes the one-file sample-data preview for the artifact.
export default defineConfig(({ mode }) => mode === 'preview'
  ? { plugins: [react(), viteSingleFile()], publicDir: false,
      build: { outDir: 'dist-preview', target: 'es2019', cssCodeSplit: false, assetsInlineLimit: 100000000 } }
  : { plugins: [react()], build: { outDir: 'dist', target: 'es2019', sourcemap: false } });

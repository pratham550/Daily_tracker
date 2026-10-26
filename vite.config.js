import { defineConfig } from 'vite';

export default defineConfig({
  // relative paths so the built files load inside the Android app
  base: './',
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 900 },
  server: { host: true, port: 5173 },
});

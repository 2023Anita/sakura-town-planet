import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 41731 },
  preview: { host: '0.0.0.0', port: 41732 },
  build: { chunkSizeWarningLimit: 1200 },
});

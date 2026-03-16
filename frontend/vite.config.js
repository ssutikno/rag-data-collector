import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../backend/ui',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      // Proxy all API calls to the Go backend during development
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
});

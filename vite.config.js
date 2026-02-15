import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('html2canvas')) return 'vendor_html2canvas';
            if (id.includes('purify.es') || id.includes('purify')) return 'vendor_purify';
            return 'vendor';
          }
        }
      }
    }
  }
});

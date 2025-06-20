import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/envioDocsExe/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      external: ['electron']
    }
  },
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5173,
    strictPort: true
  }
}); 
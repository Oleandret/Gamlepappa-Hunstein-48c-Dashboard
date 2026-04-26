import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendors so the initial bundle stays small.
          // Recharts is loaded only when the energy chart actually mounts.
          'recharts':       ['recharts'],
          'framer-motion':  ['framer-motion'],
          'react-vendor':   ['react', 'react-dom'],
          'icons':          ['lucide-react']
        }
      }
    }
  }
});

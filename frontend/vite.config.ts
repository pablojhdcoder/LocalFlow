import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // required for debugging from mobile devices on the LAN
    port: 5173,
    proxy: {
      // Let the browser talk only to Vite (works better on mobile/LAN).
      // Vite forwards requests to the backend running on the same machine.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/audio': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/thumbnails': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});


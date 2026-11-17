import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In dev, /api is proxied to `wrangler dev` (pnpm dev:api, port 8787).
// In production set VITE_API_BASE to the Worker URL, e.g. https://oina-api.<you>.workers.dev/api/v1
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  build: { target: 'es2022', sourcemap: true },
});

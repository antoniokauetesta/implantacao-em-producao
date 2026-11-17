import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento (npm run dev), /api é redirecionado para a API local.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', rewrite: (p) => p.replace(/^\/api/, '') } },
  },
});

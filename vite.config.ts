import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        // Bind to localhost only. Never expose dev server to 0.0.0.0.
      },
      plugins: [react()],
      define: {
        // SECURITY: Do NOT expose API keys to the client bundle via define.
        // Move Gemini calls to a server-side API route instead.
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    server: {
      // Listen on all interfaces so both localhost and 127.0.0.1 work on Windows.
      host: true,
    },
    // Default to root base for custom domains and root-path deployments.
    // Override VITE_BASE_PATH only when deploying under a subpath.
    base: env.VITE_BASE_PATH || '/',
  };
});



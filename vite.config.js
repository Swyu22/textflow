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
    // Default to relative base so built files work both in local file preview
    // and when deployed under different paths.
    // Set VITE_BASE_PATH=/textflow/ when deploying to a fixed subpath (e.g. GitHub Pages).
    base: env.VITE_BASE_PATH || './',
  };
});

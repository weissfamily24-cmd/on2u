import { defineConfig } from 'vite';

// Vite-Konfiguration. `fs.allow: ['..']` erlaubt den Import von `../lib/data/*`
// (Frische-Regel und Typen werden mit dem Backend-Spiegel geteilt).
export default defineConfig({
  server: {
    port: 5173,
    fs: { allow: ['..'] },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});

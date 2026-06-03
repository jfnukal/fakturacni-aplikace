import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // html2pdf.js → canvg → core-js: canvg importuje core-js polyfilly způsobem
  // nekompatibilním s Vite/Rollup ESM bundlingem. Řešení: externalizujeme core-js
  // z produkčního buildu (html2pdf funguje i bez nich v moderních prohlížečích).
  build: {
    rollupOptions: {
      external: (id) => id.startsWith('core-js/'),
    },
  },
});

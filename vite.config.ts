import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // مسارات نسبية حتى يعمل ملف البناء من أي مكان (مثل OBS Local File)
  base: './',
  server: { port: 5173, open: false },
});

import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages(/school-metaverse/)에서도 열리도록 상대 경로로 빌드
  base: './',
  server: { port: 5173, open: false },
  build: { chunkSizeWarningLimit: 900 },
});

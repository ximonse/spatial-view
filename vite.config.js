import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/', // Vercel deployment at root
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'konva': ['konva'],
          'dexie': ['dexie'],
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});

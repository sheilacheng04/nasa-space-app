import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 2000, rollupOptions: {output: {entryFileNames:'js/[name]-[hash].js',chunkFileNames:'js/[name]-[hash].js',assetFileNames:asset=>asset.name?.endsWith('.css')?'css/[name]-[hash][extname]':'assets/[name]-[hash][extname]'}} },
  server: { port: 5173, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:' + (process.env.API_PORT || '8000'), changeOrigin: false } } },
});

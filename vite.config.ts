import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // GitHub Pages serves from /speaker-design/; Docker overrides with BASE_PATH=/
  base: process.env.BASE_PATH || '/speaker-design/',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      external: ['pdfjs-dist/build/pdf.worker.min.mjs'],
    },
  },
})

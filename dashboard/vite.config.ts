import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative base so the built dashboard also works from a file server subfolder
  base: './',
  server: { port: 5173, host: 'localhost' },
  build: {
    chunkSizeWarningLimit: 1500,
  },
})

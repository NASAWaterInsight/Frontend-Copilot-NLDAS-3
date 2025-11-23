import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Temporarily disable PostCSS
  // css: {
  //   postcss: './postcss.config.cjs'
  // },
  server: {
    watch: {
      usePolling: true,
      interval: 1000
    },
    fs: {
      strict: false
    }
  }
})
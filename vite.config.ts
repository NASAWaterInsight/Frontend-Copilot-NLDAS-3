import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // ✅ UPDATED: Proxy to FastAPI instead of Azure Functions
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      // Keep legacy proxy for backward compatibility
      '/multi_agent_function': {
        target: 'http://localhost:7071',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxies API calls to the backend during local dev, so the frontend
      // can just call relative paths like /workspaces without hardcoding
      // http://localhost:4000 everywhere.
      '/auth': 'http://localhost:4000',
      '/workspaces': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
})

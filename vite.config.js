import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The dev server proxies /api to the local backend so the browser only ever
// talks to one origin and CORS stays out of the way while developing. In
// production the two are on different hosts, so VITE_API_BASE points the app
// at the deployed backend instead — and if neither is reachable the app falls
// back to the precomputed bundle in public/demo. See src/lib/api.js.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 1186,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API || 'http://localhost:1184',
        changeOrigin: true,
      },
    },
  },
})

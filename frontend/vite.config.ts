import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // ✅ sockjs-client (used for the live Tables/Kitchen updates) is a
  // CommonJS/UMD package that references Node's `global` object at
  // module-load time. Vite's dev server doesn't polyfill `global` the way
  // webpack used to, so without this the whole app crashed on load with
  // "Uncaught ReferenceError: global is not defined" -- a blank white
  // screen, since it happened during the very first module evaluation.
  // Aliasing `global` to `globalThis` (which every browser already
  // provides) is the standard fix for this exact sockjs-client/Vite issue.
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5173,
    // In dev (`npm run dev`), the app calls relative "/v1/..." URLs, and now
    // also "/ws" (the SockJS/STOMP endpoint for real-time updates) -- see
    // axiosClient.ts base_url and useRestaurantSocket.ts. Vite's dev server
    // doesn't know either route on its own, so without this proxy every API
    // call 404s (login fails) and the WebSocket handshake fails too. This
    // forwards both to the Spring Boot backend (server.port=8084 by default).
    proxy: {
      '/v1': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8084',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8084',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})

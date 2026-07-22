import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const SERVER_PORT = Number(process.env.PORT ?? 3000)

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      // three 与 gsap 体积大且独立，拆成各自 vendor chunk 便于长缓存
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/gsap')) return 'gsap'
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${SERVER_PORT}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `ws://127.0.0.1:${SERVER_PORT}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        'service-worker': './src/service-worker.ts'
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'service-worker' 
            ? '[name].js' 
            : 'assets/[name]-[hash].js'
        }
      }
    }
  }
})
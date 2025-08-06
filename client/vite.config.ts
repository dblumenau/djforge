import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Generate build version
const buildVersion = process.env.BUILD_VERSION || Date.now().toString();
const buildTime = new Date().toISOString();

export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_VERSION': JSON.stringify(buildVersion),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
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
    sourcemap: true, // Generate source maps for production
    rollupOptions: {
      input: {
        main: './index.html',
        'service-worker': './src/service-worker.ts'
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'service-worker' 
            ? '[name].js' 
            : `assets/[name]-[hash]-${Date.now()}.js`
        },
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-[hash]-${Date.now()}[extname]`
      }
    }
  }
})
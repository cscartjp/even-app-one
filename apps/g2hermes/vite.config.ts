import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    dedupe: [
      'react',
      'react-dom',
      'react-router',
      'even-toolkit',
      '@evenrealities/even_hub_sdk',
    ],
  },
})

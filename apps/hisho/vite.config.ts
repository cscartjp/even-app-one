import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// アプリ版は app.json の version を正本にする（package.json の 1.0.0 はアプリ版ではない）。
const appVersion: string = JSON.parse(
  readFileSync(path.resolve(__dirname, './app.json'), 'utf-8'),
).version

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    dedupe: [
      'react',
      'react-dom',
      'react-router',
      '@evenrealities/even_hub_sdk',
      '@jappyjan/even-better-sdk',
      'upng-js',
    ],
  },
})

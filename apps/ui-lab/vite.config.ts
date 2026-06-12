import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const appVersion = JSON.parse(
  readFileSync(path.resolve(__dirname, './app.json'), 'utf-8'),
).version
if (typeof appVersion !== 'string' || appVersion.length === 0) {
  throw new Error(
    'apps/ui-lab/app.json の version が不正です（非空の文字列が必要）',
  )
}

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
      'even-toolkit',
      '@evenrealities/even_hub_sdk',
    ],
  },
})

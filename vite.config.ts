import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  // GitHub Pages lives at /timer-plus/; local dev stays at /
  base: command === 'build' ? '/timer-plus/' : '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
}))

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base works for GitHub Pages (/timer-plus/), Capacitor APK, and root hosts
  base: './',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
})

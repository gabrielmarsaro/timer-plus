import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.timerplus.app',
  appName: 'Timer Plus',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Allow YouTube embed / open-in-app for Tabata music (no audio ripping).
    allowNavigation: [
      'youtube.com',
      '*.youtube.com',
      'youtu.be',
      '*.youtu.be',
      'youtube-nocookie.com',
      '*.youtube-nocookie.com',
    ],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#000000',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
    },
  },
}

export default config

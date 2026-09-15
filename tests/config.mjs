import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

export default {
  configFile: false,
  mode: 'test',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^.*\/firebaseClient(?:\.js)?$/, replacement: fileURLToPath(new URL('./firebaseClient.mjs', import.meta.url)) },
      { find: '@emailjs/browser', replacement: fileURLToPath(new URL('./emailjs.mjs', import.meta.url)) },
    ],
  },
  server: { host: '127.0.0.1', port: 4179, strictPort: true, hmr: false },
}

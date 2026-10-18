import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // rutas relativas: funciona en GitHub Pages (subcarpeta) y dentro de la APK
  plugins: [react()],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['onnxruntime-web'] }, // trae sus propios .wasm/.mjs (se copian a public/ort)
  build: { target: 'es2020' },
})

// Copia los archivos WASM de onnxruntime-web a public/ort para que la app funcione sin Internet (no se usa el CDN).
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
const src = 'node_modules/onnxruntime-web/dist', dst = 'public/ort'
if (!existsSync(src)) { console.error('Falta onnxruntime-web: ejecutá npm install'); process.exit(1) }
mkdirSync(dst, { recursive: true })
const files = readdirSync(src).filter((f) => /^ort-wasm.*\.(wasm|mjs)$/.test(f) && !/jsep|jspi|webgpu|asyncify/.test(f))
if (!files.length) { console.error('No se encontraron los archivos ort-wasm*.wasm en ' + src); process.exit(1) }
for (const f of files) copyFileSync(`${src}/${f}`, `${dst}/${f}`)
console.log('onnxruntime-web: copiados', files.join(', '))

// Después de compilar: huella (SHA-256) y tamaño de todo lo que forma el motor de análisis, para comparar web y APK.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
const pick = (dir, re) => readdirSync(dir).filter((f) => re.test(f)).map((f) => `${dir}/${f}`)
const files = [...pick('dist/models', /\.onnx$/), ...pick('dist/ort', /\.(wasm|mjs)$/), ...pick('dist/assets', /worker.*\.js$/)]
const out = { files: {}, engineBytes: 0, distBytes: 0 }
for (const f of files) { const b = readFileSync(f); out.files[f.replace('dist/', '')] = { bytes: b.length, sha256: createHash('sha256').update(b).digest('hex').slice(0, 16) }; out.engineBytes += b.length }
const walk = (d) => readdirSync(d).forEach((f) => { const p = `${d}/${f}`; statSync(p).isDirectory() ? walk(p) : (out.distBytes += statSync(p).size) })
walk('dist')
writeFileSync('dist/engine-manifest.json', JSON.stringify(out, null, 1))
console.log(`Motor: ${(out.engineBytes / 1e6).toFixed(1)} MB en ${files.length} archivos; web completa: ${(out.distBytes / 1e6).toFixed(1)} MB`)
for (const [f, v] of Object.entries(out.files)) console.log(`  ${f}  ${(v.bytes / 1e6).toFixed(2)} MB  ${v.sha256}`)

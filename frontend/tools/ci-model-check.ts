/**
 * Verificación en CI: ejecuta el modelo con onnxruntime-web (el MISMO paquete y backend WASM que usa la app) sobre el audio de la
 * prueba (Do mayor) y compara con la referencia calculada con ONNX Runtime nativo. Mide además la velocidad (no equivale a un teléfono).
 *   node --experimental-strip-types tools/ci-model-check.ts
 */
import { readFileSync } from 'node:fs'
import * as ort from 'onnxruntime-web/wasm' // la misma entrada que usa la app
import { BP, bpUnwrap, bpWindow, bpWindowCount, selfTestSignal } from '../src/lib/engine/notes.ts'

// Referencia (Python, onnxruntime 1.29 nativo, mismo audio): probabilidad media 1–4 s de las notas principales
const REF: Record<number, number> = { 48: 0.7859, 64: 0.6833, 67: 0.4883, 86: 0.3973, 60: 0.2315, 76: 0.2256 }
ort.env.wasm.numThreads = 1
const s = await ort.InferenceSession.create(new Uint8Array(readFileSync('public/models/basic-pitch-nmp.onnx')), { executionProviders: ['wasm'] })
const x = selfTestSignal(), { count, nFrames } = bpWindowCount(x.length), outs: Float32Array[] = []
const t0 = performance.now()
for (let i = 0; i < count; i++) {
  const r = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', bpWindow(x, i), [1, BP.nSamples, 1]) })
  outs.push(new Float32Array(r['StatefulPartitionedCall:1'].data as Float32Array))
}
const ms = (performance.now() - t0) / count
const rows = bpUnwrap(outs, nFrames), mean = new Float64Array(BP.keys)
for (let j = 86; j < 4 * 86; j++) for (let k = 0; k < BP.keys; k++) mean[k] += rows[j][k] / (3 * 86)
let worst = 0
for (const [m, p] of Object.entries(REF)) { const d = Math.abs(mean[Number(m) - BP.firstMidi] - p); worst = Math.max(worst, d); console.log(`MIDI ${m}: web ${mean[Number(m) - BP.firstMidi].toFixed(4)} vs nativo ${p}`) }
console.log(`ventanas ${count}, filas ${rows.length} (nativo: 4 y 432); ${ms.toFixed(0)} ms por ventana en este servidor de CI (1 hilo, WASM)`)
if (count !== 4 || rows.length !== 432 || worst > 0.02) { console.error(`DIFERENCIA con la referencia: ${worst.toFixed(4)}`); process.exit(1) }
console.log(`OK: onnxruntime-web reproduce al nativo (diferencia máxima ${worst.toFixed(4)})`)

/** Basic Pitch (Spotify, Apache-2.0) ejecutado en el dispositivo con onnxruntime-web (WASM, sin Internet una vez instalada). */
import * as ort from 'onnxruntime-web'
import { BP, bpUnwrap, bpWindow, bpWindowCount } from './notes.ts'

let session: ort.InferenceSession | null = null

async function load(base: string): Promise<ort.InferenceSession> {
  if (session) return session
  ort.env.wasm.wasmPaths = `${base}ort/`
  ort.env.wasm.numThreads = 1 // sin aislamiento entre orígenes no hay hilos compartidos
  const res = await fetch(`${base}models/basic-pitch-nmp.onnx`)
  if (!res.ok) throw new Error(`no se encontró el modelo (${res.status})`)
  session = await ort.InferenceSession.create(new Uint8Array(await res.arrayBuffer()), { executionProviders: ['wasm'] })
  return session
}

/** Devuelve las probabilidades de 88 notas por cuadro (~11,6 ms). `x` debe estar a 22 050 Hz, mono. */
export async function transcribeNotes(x: Float32Array, base: string, onProgress?: (p: number) => void): Promise<Float32Array[]> {
  const s = await load(base)
  const input = s.inputNames[0], output = s.outputNames.includes('StatefulPartitionedCall:1') ? 'StatefulPartitionedCall:1' : s.outputNames[1]
  const { count, nFrames } = bpWindowCount(x.length)
  const outs: Float32Array[] = []
  for (let i = 0; i < count; i++) {
    const r = await s.run({ [input]: new ort.Tensor('float32', bpWindow(x, i), [1, BP.nSamples, 1]) })
    outs.push(new Float32Array(r[output].data as Float32Array))
    onProgress?.((i + 1) / count)
  }
  return bpUnwrap(outs, nFrames)
}

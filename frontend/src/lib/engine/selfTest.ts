/** Prueba del motor de IA en ESTE dispositivo: carga el modelo, analiza 5 s de un acorde de Do mayor sintético y mide la velocidad. */
import { transcribeNotes } from './bpModel.ts'
import { BP, bpWindowCount, selfTestSignal } from './notes.ts'

export interface SelfTestResult {
  ok: boolean; error?: string; loadMs: number; msPerWindow: number; secPerAudioMinute: number
  foundPitchClasses: string[]; expected: string[]; simd: boolean; threads: number; cores: number | null; memoryGB: number | null
  userAgent: string; manifest: string
}
const PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const simdOk = () => {
  try { // módulo WASM mínimo con una instrucción SIMD (v128)
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]))
  } catch { return false }
}

export async function runModelSelfTest(base: string): Promise<SelfTestResult> {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const info = {
    simd: simdOk(), threads: 1, cores: nav.hardwareConcurrency ?? null, memoryGB: nav.deviceMemory ?? null, userAgent: nav.userAgent,
    manifest: await fetch(`${base}engine-manifest.json`).then((r) => (r.ok ? r.text() : 'sin manifiesto')).catch(() => 'sin manifiesto'),
    expected: ['C', 'E', 'G'],
  }
  const x = selfTestSignal(), { count } = bpWindowCount(x.length)
  const t0 = performance.now()
  let tFirst = 0
  try {
    const rows = await transcribeNotes(x, base, (p) => { if (!tFirst && p > 0) tFirst = performance.now() })
    const t1 = performance.now()
    const loadMs = tFirst - t0, msPerWindow = (t1 - tFirst) / Math.max(1, count - 1)
    const chroma = new Float64Array(12)
    for (let j = 86; j < Math.min(rows.length, 4 * 86); j++) for (let k = 0; k < BP.keys; k++) chroma[(BP.firstMidi + k) % 12] += rows[j][k]
    const found = [...chroma].map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, i]) => PC[i]).sort()
    const secPerAudioMinute = (msPerWindow / 1000) * (60 / ((BP.nSamples - BP.overlapFrames * BP.hop) / BP.sr))
    return { ok: found.join() === ['C', 'E', 'G'].join(), loadMs, msPerWindow, secPerAudioMinute, foundPitchClasses: found, ...info }
  } catch (e) {
    return { ok: false, error: (e as Error).message, loadMs: 0, msPerWindow: 0, secPerAudioMinute: 0, foundPitchClasses: [], ...info }
  }
}

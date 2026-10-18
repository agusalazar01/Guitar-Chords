import type { AnalysisOutput } from './analyze.ts'
import type { SelfTestResult } from './selfTest.ts'

const baseUrl = () => new URL(import.meta.env.BASE_URL, location.href).href

export const CANCELLED = 'cancelado'

export function startAnalysis(samples: Float32Array, sr: number, onProgress: (p: number) => void) {
  const w = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
  let fail: (e: Error) => void = () => undefined
  const promise = new Promise<AnalysisOutput>((resolve, reject) => {
    fail = reject
    w.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; value?: number; result?: AnalysisOutput; message?: string }
      if (m.type === 'progress') onProgress(m.value ?? 0)
      else if (m.type === 'done') { w.terminate(); resolve(m.result as AnalysisOutput) }
      else { w.terminate(); reject(new Error(m.message ?? 'Falló el análisis.')) }
    }
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'Falló el análisis.')) }
    w.postMessage({ samples, sr, base: baseUrl() }, [samples.buffer as ArrayBuffer])
  })
  return { promise, cancel: () => { w.terminate(); fail(new Error(CANCELLED)) } }
}

/** Ejecuta la prueba del motor de IA en el mismo worker que usa el análisis real. */
export function runSelfTest(): Promise<SelfTestResult> {
  const w = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
  return new Promise((resolve, reject) => {
    w.onmessage = (e: MessageEvent) => { const m = e.data as { type: string; result: SelfTestResult }; if (m.type === 'selftest') { w.terminate(); resolve(m.result) } }
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'No se pudo iniciar el worker.')) }
    w.postMessage({ kind: 'selftest', base: baseUrl() })
  })
}

import type { AnalysisOutput } from './analyze.ts'

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
    w.postMessage({ samples, sr }, [samples.buffer as ArrayBuffer])
  })
  return { promise, cancel: () => { w.terminate(); fail(new Error(CANCELLED)) } }
}

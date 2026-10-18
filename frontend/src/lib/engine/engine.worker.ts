import { analyzeHybrid, analyzeSamples } from './analyze.ts'
import { transcribeNotes } from './bpModel.ts'
import { runModelSelfTest } from './selfTest.ts'

// Worker: el análisis no bloquea la interfaz. Primero intenta el motor híbrido con IA; si el modelo no carga, usa el clásico y lo avisa.
const ctx = self as unknown as { postMessage: (m: unknown) => void; onmessage: ((e: MessageEvent) => void) | null }
ctx.onmessage = async (e: MessageEvent) => {
  if ((e.data as { kind?: string }).kind === 'selftest') {
    ctx.postMessage({ type: 'selftest', result: await runModelSelfTest((e.data as { base: string }).base) })
    return
  }
  const { samples, sr, base } = e.data as { samples: Float32Array; sr: number; base: string }
  const progress = (value: number) => ctx.postMessage({ type: 'progress', value })
  try {
    let rows: Float32Array[] | null = null, warning: string | undefined
    try {
      rows = await transcribeNotes(samples, base, (p) => progress(0.65 * p))
    } catch (err) {
      warning = `No se pudo usar el modelo de IA (${(err as Error).message}); se usó el motor clásico.`
    }
    const result = rows ? analyzeHybrid(samples, sr, rows, (p) => progress(0.65 + 0.35 * p)) : analyzeSamples(samples, sr, progress)
    ctx.postMessage({ type: 'done', result: { ...result, warning } })
  } catch (err) {
    ctx.postMessage({ type: 'error', message: (err as Error).message })
  }
}

import { analyzeSamples } from './analyze.ts'

// Worker: el análisis no bloquea la interfaz.
const ctx = self as unknown as { postMessage: (m: unknown) => void; onmessage: ((e: MessageEvent) => void) | null }
ctx.onmessage = (e: MessageEvent) => {
  try {
    const { samples, sr } = e.data as { samples: Float32Array; sr: number }
    const result = analyzeSamples(samples, sr, (value) => ctx.postMessage({ type: 'progress', value }))
    ctx.postMessage({ type: 'done', result })
  } catch (err) {
    ctx.postMessage({ type: 'error', message: (err as Error).message })
  }
}

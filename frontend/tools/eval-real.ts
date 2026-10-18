/**
 * Evaluación con canciones reales (el audio NO se incluye en el repositorio).
 * 1) Convertí cada MP3 a PCM mono 22,05 kHz:  ffmpeg -i "X.mp3" -ac 1 -ar 22050 -f f32le eval-audio/<nombre>.f32
 *    (los nombres esperados están en `file` dentro de eval-common.ts)
 * 2) node --experimental-strip-types tools/eval-real.ts      (o EVAL_DIR=/ruta node ...)
 * Métricas (aproximadas, el cancionero no trae tiempos):
 *  - en-partitura: % del tiempo con un acorde que aparece en el cancionero (a nivel tríada, con la afinación real).
 *  - F1sec: coincidencia entre la secuencia detectada y la del cancionero (LCS), sin tiempos.
 *  - |retraso|: distancia mediana entre cada cambio detectado y el golpe (inicio de nota) más cercano.
 */
import { existsSync } from 'node:fs'
import { analyzeBaseline, analyzeSamples } from '../src/lib/engine/analyze.ts'
import { SONGS, loadF32, score } from './eval-common.ts'

const f = (x: number) => (Number.isNaN(x) ? '-' : x.toFixed(0))
for (const k of Object.keys(SONGS)) {
  const path = `${process.env.EVAL_DIR ?? 'eval-audio'}/${SONGS[k].file}.f32`
  if (!existsSync(path)) { console.log(`(falta ${path}, se omite ${SONGS[k].name})`); continue }
  const x = loadF32(SONGS[k].file), o = analyzeSamples(x, 22050)
  console.log(`\n## ${SONGS[k].name}: tonalidad=${o.key} bpm=${o.bpm?.toFixed(0) ?? '-'}`)
  for (const [n, seg] of [['v0.1', analyzeBaseline(x, 22050)], ['simples', o.segments], ['avanzados', o.advanced]] as const) {
    const r = score(k, seg, x)
    console.log(`  ${n.padEnd(10)} en-partitura=${f(r.okShare * 100)}% F1sec=${f(r.f1 * 100)} acordes=${r.nDet}/${r.nRef} |retraso|=${f(r.absDelayMed * 1000)} ms`)
  }
}

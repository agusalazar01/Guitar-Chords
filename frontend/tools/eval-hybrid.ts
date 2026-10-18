/**
 * Compara el motor clásico y el híbrido (IA) con las referencias de Chordify con tiempos.
 * EVAL_DIR debe contener <id>.f32 (audio mono 22,05 kHz) y <id>.notes (de tools/basic_pitch_notes.py) para id = nueve, carta.
 *   node --experimental-strip-types tools/eval-hybrid.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { analyzeHybrid, analyzeSamples } from '../src/lib/engine/analyze.ts'
import { BP } from '../src/lib/engine/notes.ts'
import { REF_CARTA, REF_NUEVE, evaluate } from './refs-chordify.ts'
const dir = process.env.EVAL_DIR ?? 'eval-audio'
const f32 = (p: string) => { const b = readFileSync(p); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }
const pc = (x: number) => (x * 100).toFixed(0) + '%'
for (const [id, ref] of [['nueve', REF_NUEVE], ['carta', REF_CARTA]] as const) {
  if (!existsSync(`${dir}/${id}.f32`) || !existsSync(`${dir}/${id}.notes`)) { console.log(`(faltan ${dir}/${id}.f32 o .notes)`); continue }
  const x = f32(`${dir}/${id}.f32`), n = f32(`${dir}/${id}.notes`), rows: Float32Array[] = []
  for (let i = 0; i < n.length / BP.keys; i++) rows.push(n.subarray(i * BP.keys, (i + 1) * BP.keys))
  const c = analyzeSamples(x, 22050), h = analyzeHybrid(x, 22050, rows)
  for (const [name, s] of [['clásico simples', c.segments], ['clásico avanzados', c.advanced], ['híbrido simples', h.segments], ['híbrido avanzados', h.advanced]] as const) {
    const m = evaluate(s, ref)
    console.log(`${id} ${name.padEnd(18)} completo ${pc(m.exact)} raíz ${pc(m.root)} mayor/menor ${pc(m.majmin)} calidad ${pc(m.quality)} similitud ${pc(m.overlap)} cambios ${pc(m.changesFound)} retraso ${(m.delayMed * 1000).toFixed(0)} ms`)
  }
}

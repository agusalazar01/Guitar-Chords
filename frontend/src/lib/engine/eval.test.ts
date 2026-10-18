import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeBaseline, analyzeSamples } from './analyze.ts'
import { frameAccuracy, synthSong } from './synth.ts'

const TRIADS = [
  { name: 'Sol mayor G-D-Em-C 100 bpm', bpm: 100, bars: ['G', 'D', 'Em', 'C'], seed: 1 },
  { name: 'La menor Am-F-C-G 90 bpm', bpm: 90, bars: ['Am', 'F', 'C', 'G'], seed: 2 },
  { name: 'Mi mayor E-B-C#m-A 120 bpm', bpm: 120, bars: ['E', 'B', 'C#m', 'A'], seed: 3 },
  { name: 'Re mayor D-A-Bm-G 110 bpm', bpm: 110, bars: ['D', 'A', 'Bm', 'G'], seed: 4 },
]
const EXT = [
  { name: 'G-Em7-Cmaj7-D7 100 bpm', bpm: 100, bars: ['G', 'Em7', 'Cmaj7', 'D7'], seed: 5 },
  { name: 'D-Dsus4-A-Asus4 110 bpm', bpm: 110, bars: ['D', 'Dsus4', 'A', 'Asus4'], seed: 6 },
  { name: 'Am7-Dm7-G7-Cmaj7 90 bpm', bpm: 90, bars: ['Am7', 'Dm7', 'G7', 'Cmaj7'], seed: 7 },
]
const rootOf = (c: string) => /^[A-G]#?/.exec(c)?.[0] ?? c

function run(list: typeof TRIADS, label: string) {
  const rows: string[] = []
  const sum = { base: 0, tri: 0, all: 0, rootTri: 0, rootAll: 0 }
  for (const s of list) {
    const song = synthSong({ bpm: s.bpm, bars: s.bars, repeats: 3, seed: s.seed, noise: 0.08 })
    const base = frameAccuracy(song.truth, analyzeBaseline(song.samples, song.sr))
    const out = analyzeSamples(song.samples, song.sr)
    const tri = out.segments
    const all = out.advanced
    const rt = song.truth.map((t) => ({ ...t, chord: rootOf(t.chord) }))
    const r = (x: typeof tri) => frameAccuracy(rt, x.map((y) => ({ ...y, chord: rootOf(y.chord) })))
    sum.base += base; sum.tri += frameAccuracy(song.truth, tri); sum.all += frameAccuracy(song.truth, all); sum.rootTri += r(tri); sum.rootAll += r(all)
    rows.push(`${s.name}: v0.1=${(base * 100).toFixed(0)}% triadas=${(frameAccuracy(song.truth, tri) * 100).toFixed(0)}% extendido=${(frameAccuracy(song.truth, all) * 100).toFixed(0)}% | raiz: ${(r(tri) * 100).toFixed(0)}% / ${(r(all) * 100).toFixed(0)}%`)
  }
  const n = list.length, f = (x: number) => ((x / n) * 100).toFixed(1) + '%'
  console.log(`\n== ${label} ==\n` + rows.join('\n') + `\nPROMEDIO exacto: v0.1=${f(sum.base)} triadas=${f(sum.tri)} extendido=${f(sum.all)} | raiz triadas=${f(sum.rootTri)} extendido=${f(sum.rootAll)}`)
  return { tri: sum.tri / n, all: sum.all / n, base: sum.base / n }
}

test('evaluación sintética (banda completa): vocabulario extendido vs solo tríadas vs v0.1', () => {
  const a = run(TRIADS, 'Canciones de tríadas')
  const b = run(EXT, 'Canciones con séptimas y suspendidos')
  assert.ok(a.tri >= 0.9, `modo simple en canciones de tríadas: ${a.tri}`)
  assert.ok(b.all > b.tri, 'con séptimas/sus el modo avanzado debe mejorar la precisión exacta')
  assert.ok(a.base < a.tri, 'v0.3 simple debe superar a v0.1')
})

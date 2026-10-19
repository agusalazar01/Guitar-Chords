// Cifrados de cancionero («letra con acordes arriba»): lectura del texto y ubicación de cada acorde en el tiempo usando la letra
// sincronizada (LRCLIB). El cifrado dice sobre qué palabra va cada acorde; la letra dice cuándo se canta cada línea.
import { audioTime, norm } from './lyrics.ts'
import type { LyricAnchor, LyricLine } from './lyrics.ts'
import type { Segment } from './types.ts'

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const LATIN: Record<string, string> = { do: 'C', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' }
const FLAT: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E' }
const ROOT = '(?:[A-G]|Do|Re|Mi|Fa|Sol|La|Si)[#b]?'
const QUAL = '(?:maj7|maj9|M7|7M|m7b5|m7|m9|m6|m|min|dim7|dim|°|aug|\\+|sus2|sus4|sus|add9|add2|6|7|9|11|13|5)*'
const CHORD_RE = new RegExp(`^${ROOT}${QUAL}(?:\\/${ROOT})?$`)

function rootName(r: string): string | null {
  const m = /^([A-G]|Do|Re|Mi|Fa|Sol|La|Si)([#b]?)$/.exec(r)
  if (!m) return null
  let base = LATIN[m[1].toLowerCase()] ?? m[1]
  if (m[2] === '#') base = SHARP[(SHARP.indexOf(base) + 1) % 12]
  else if (m[2] === 'b') base = FLAT[base + 'b'] ?? SHARP[(SHARP.indexOf(base) + 11) % 12]
  return base
}

/** Normaliza un acorde de cancionero al formato de la app (raíz con #, calidades conocidas). null si no es un acorde. */
export function normalizeChord(tok: string): string | null {
  const t = tok.replace(/[()[\]*]/g, '')
  if (!CHORD_RE.test(t)) return null
  const m = new RegExp(`^(${ROOT})(${QUAL})(?:\\/(${ROOT}))?$`).exec(t)
  if (!m) return null
  const root = rootName(m[1]); if (!root) return null
  const q = m[2]
  let qual = ''
  if (/^(m7b5)/.test(q)) qual = 'm7'
  else if (/^(maj7|maj9|M7|7M)/.test(q)) qual = 'maj7'
  else if (/^(dim|°)/.test(q)) qual = 'dim'
  else if (/^(aug|\+)/.test(q)) qual = 'aug'
  else if (/^(m|min)/.test(q)) qual = /^(m7|m9|min7)/.test(q) ? 'm7' : 'm'
  else if (/^sus2/.test(q)) qual = 'sus2'
  else if (/^sus/.test(q)) qual = 'sus4'
  else if (/^(add9|add2)/.test(q)) qual = 'add9'
  else if (/^6/.test(q)) qual = '6'
  else if (/^(7|9|11|13)/.test(q)) qual = '7'
  const bass = m[3] ? rootName(m[3]) : null
  return root + qual + (bass && bass !== root ? `/${bass}` : '')
}

export interface CifradoLine { text: string; chords: { pos: number; chord: string }[] }

/** ¿Es una línea de acordes? (casi todas sus palabras son acordes; se ignoran «Intro:», «x2», barras «|»). */
function chordTokens(line: string): { pos: number; chord: string }[] | null {
  const toks = [...line.matchAll(/\S+/g)]
  if (!toks.length) return null
  const out: { pos: number; chord: string }[] = []
  let other = 0
  for (const t of toks) {
    const raw = t[0]
    if (/^(\||-+|x\d+|\(?x\d+\)?|\d+x)$/i.test(raw) || /^[A-Za-zÁÉÍÓÚáéíóúñ]+:$/.test(raw)) continue
    const c = normalizeChord(raw)
    if (c) out.push({ pos: t.index ?? 0, chord: c }); else other++
  }
  return out.length && out.length >= 2 * other ? out : null
}

/** Lee un cifrado: cada línea de acordes se une a la línea de letra que tiene debajo; si no hay letra, queda como línea instrumental. */
export function parseCifrado(text: string): CifradoLine[] {
  const lines = text.replace(/\t/g, '    ').split(/\r?\n/)
  const out: CifradoLine[] = []
  for (let i = 0; i < lines.length; i++) {
    const ch = chordTokens(lines[i])
    if (ch) {
      const next = lines[i + 1]
      if (next !== undefined && next.trim() && !chordTokens(next)) { out.push({ text: next, chords: ch }); i++ }
      else out.push({ text: '', chords: ch })
    } else if (lines[i].trim()) out.push({ text: lines[i], chords: [] })
  }
  return out
}

const words = (s: string) => norm(s).split(' ').filter((w) => w.length > 1)
function similarity(a: string, b: string): number {
  const A = new Set(words(a)), B = words(b)
  if (!A.size || !B.length) return 0
  const hit = B.filter((w) => A.has(w)).length
  return hit / Math.max(A.size, B.length)
}

export interface ChordEvent { l: number; chord: string } // l: tiempo en la escala de la letra (antes de ajustes)

/** Ubica los acordes en el tiempo de la letra. Cada línea con tiempo busca su línea del cifrado (en orden; si no, la más parecida
 *  de cualquier parte, para estribillos escritos una sola vez). Las líneas solo de acordes (intro, puentes) se reparten en el hueco
 *  anterior a la línea que las sigue. Sin letra con tiempos, se reparten 2 s por acorde. */
export function alignCifrado(cif: CifradoLine[], lrc: LyricLine[] | null): ChordEvent[] {
  const ev: ChordEvent[] = []
  const sung = (lrc ?? []).filter((l) => l.text.trim())
  const sequential = (t0: number) => { let t = t0; const out: ChordEvent[] = []; for (const c of cif) for (const x of c.chords) { out.push({ l: t, chord: x.chord }); t += 2 } return out }
  if (!sung.length) return sequential(0)
  let k = 0
  for (let j = 0; j < sung.length; j++) {
    const t0 = sung[j].t, t1 = j + 1 < sung.length ? sung[j + 1].t : t0 + 4, prevT = j > 0 ? sung[j - 1].t : 0
    let best = -1, bs = 0
    for (let i = k; i < Math.min(cif.length, k + 8); i++) if (cif[i].text) { const s = similarity(cif[i].text, sung[j].text); if (s > bs) { bs = s; best = i } }
    let line: CifradoLine | null = null
    if (best >= 0 && bs >= 0.4) {
      // líneas instrumentales entre la anterior y esta: en el hueco antes de cantar
      const instr = cif.slice(k, best).filter((c) => !c.text && c.chords.length).flatMap((c) => c.chords.map((x) => x.chord))
      if (instr.length) {
        const from = Math.max(j > 0 ? prevT + Math.min(4, (t0 - prevT) / 2) : 0, t0 - 2 * instr.length), step = (t0 - from) / instr.length
        instr.forEach((c, n) => ev.push({ l: from + n * step, chord: c }))
      }
      line = cif[best]; k = best + 1
    } else {
      let gb = -1, gs = 0
      for (let i = 0; i < cif.length; i++) if (cif[i].text) { const s = similarity(cif[i].text, sung[j].text); if (s > gs) { gs = s; gb = i } }
      if (gb >= 0 && gs >= 0.55) line = cif[gb]
    }
    if (!line || !line.chords.length) continue
    const len = Math.max(line.text.trimEnd().length, ...line.chords.map((c) => c.pos + 1), 1)
    const span = Math.min(t1 - t0, 8)
    for (const c of line.chords) ev.push({ l: t0 + (Math.min(c.pos, len) / len) * span, chord: c.chord })
  }
  // final instrumental (acordes después de la última línea cantada)
  const tail = cif.slice(k).filter((c) => !c.text && c.chords.length).flatMap((c) => c.chords.map((x) => x.chord))
  const last = sung[sung.length - 1].t + 4
  tail.forEach((c, n) => ev.push({ l: last + n * 2, chord: c }))
  ev.sort((a, b) => a.l - b.l)
  if (!ev.length) return sequential(Math.max(0, sung[0].t - 2)) // la letra no coincide con el cifrado: orden simple, 2 s por acorde
  const out: ChordEvent[] = []
  for (const e of ev) {
    const p = out[out.length - 1]
    if (p && p.chord === e.chord) continue
    if (p && e.l - p.l < 0.3) { out[out.length - 1] = { l: p.l, chord: e.chord }; continue }
    out.push(e)
  }
  return out
}

/** Segmentos en el tiempo del audio o video, aplicando los ajustes de la letra (intro, versiones en vivo). */
export function cifradoSegments(ev: ChordEvent[], duration: number, anchors: LyricAnchor[] = [], offset = 0): Segment[] {
  const pts = ev.map((e) => ({ t: Math.max(0, audioTime(e.l, anchors, offset)), chord: e.chord })).sort((a, b) => a.t - b.t)
  const segs: Segment[] = []
  const end = Math.max(duration, (pts[pts.length - 1]?.t ?? 0) + 2)
  if (pts.length && pts[0].t > 0.1) segs.push({ start: 0, end: pts[0].t, chord: 'N', confidence: null })
  pts.forEach((p, i) => {
    const e = i + 1 < pts.length ? pts[i + 1].t : end
    if (e - p.t < 0.05) return
    const r = (x: number) => Math.round(x * 100) / 100
    segs.push({ start: r(p.t), end: r(e), chord: p.chord, confidence: null })
  })
  return segs
}

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

interface CWord { w: string; chords: string[]; after: string[] } // after: acordes escritos después de la última palabra de la línea
type CTok = { kind: 'word'; i: number } | { kind: 'instr'; chords: string[] }
interface LWord { w: string; t: number; d: number; line: number }

/** Palabras normalizadas con su posición; «Uh-Oh-Oh» cuenta como tres palabras. */
const splitWords = (text: string) => [...text.matchAll(/[^\s\-–—,.;:!?¡¿"“”()]+/g)]
  .map((m) => ({ s: m.index ?? 0, e: (m.index ?? 0) + m[0].length, w: norm(m[0]) })).filter((x) => x.w && !x.w.includes(' '))

const isHeading = (t: string) => /^\s*[[(].*[\])]\s*$/.test(t) || /^\s*(intro|estribillo|coro|chorus|verso|puente|final|solo)\s*:?\s*$/i.test(t)

/** Palabras del cifrado con los acordes pegados a la palabra que tienen debajo (o a la siguiente). */
function cifradoWords(cif: CifradoLine[]): { words: CWord[]; toks: CTok[] } {
  const words: CWord[] = [], toks: CTok[] = []
  for (const line of cif) {
    if (!line.text.trim() || isHeading(line.text)) {
      if (line.chords.length) toks.push({ kind: 'instr', chords: line.chords.map((c) => c.chord) })
      continue
    }
    const ws = splitWords(line.text)
    if (!ws.length) { if (line.chords.length) toks.push({ kind: 'instr', chords: line.chords.map((c) => c.chord) }); continue }
    const base = words.length
    ws.forEach((x) => { words.push({ w: x.w, chords: [], after: [] }); toks.push({ kind: 'word', i: words.length - 1 }) })
    for (const c of line.chords) {
      let k = ws.findIndex((x) => c.pos < x.e)
      if (k < 0) { words[base + ws.length - 1].after.push(c.chord); continue }
      words[base + k].chords.push(c.chord)
    }
  }
  return { words, toks }
}

/** Palabras de la letra sincronizada con el momento estimado de cada una (reparto por caracteres dentro de la línea). */
function lyricWords(sung: LyricLine[]): LWord[] {
  const out: LWord[] = []
  sung.forEach((l, j) => {
    const span = Math.min((j + 1 < sung.length ? sung[j + 1].t : l.t + 4) - l.t, 8)
    const len = Math.max(1, l.text.length)
    const ms = splitWords(l.text)
    for (const m of ms) out.push({ w: m.w, t: l.t + (m.s / len) * span, d: Math.max(0.15, ((m.e - m.s) / len) * span), line: j })
  })
  return out
}

const near = (a: string, b: string) => a === b ? 3 : (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4)) ? 2 : (a.replace(/(.)\1+/g, '$1') === b.replace(/(.)\1+/g, '$1') ? 2 : -1)

/** Alineación global (Needleman–Wunsch) de las palabras del cifrado con las de la letra: no importa dónde corta cada uno las líneas. */
function alignWords(A: CWord[], B: LWord[]): Int32Array {
  const n = A.length, m = B.length, W = m + 1
  const S = new Float32Array((n + 1) * W), T = new Uint8Array((n + 1) * W)
  const GAP = -1
  for (let i = 1; i <= n; i++) { S[i * W] = i * GAP; T[i * W] = 1 }
  for (let j = 1; j <= m; j++) { S[j] = j * GAP * 0.5; T[j] = 2 } // saltear letra cuesta menos: estribillos repetidos
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const d = S[(i - 1) * W + j - 1] + near(A[i - 1].w, B[j - 1].w)
    const u = S[(i - 1) * W + j] + GAP
    const l = S[i * W + j - 1] + GAP * 0.5
    if (d >= u && d >= l) { S[i * W + j] = d; T[i * W + j] = 0 } else if (u >= l) { S[i * W + j] = u; T[i * W + j] = 1 } else { S[i * W + j] = l; T[i * W + j] = 2 }
  }
  const map = new Int32Array(n).fill(-1)
  let i = n, j = m
  while (i > 0 && j > 0) {
    const t = T[i * W + j]
    if (t === 0) { if (near(A[i - 1].w, B[j - 1].w) > 0) map[i - 1] = j - 1; i--; j-- } else if (t === 1) i--; else j--
  }
  return map
}

/** Ubica los acordes en el tiempo de la letra. Cada acorde va pegado a la palabra que tiene debajo; las palabras del cifrado se
 *  alinean con las de la letra sincronizada sin importar cómo corta cada uno las líneas. Las palabras que no coinciden toman un
 *  tiempo intermedio entre sus vecinas; las líneas solo de acordes (intro, puentes) se reparten en el hueco antes del canto; las
 *  líneas que el cifrado escribe una sola vez (estribillo) se repiten donde la letra las vuelve a cantar. */
export function alignCifrado(cif: CifradoLine[], lrc: LyricLine[] | null): ChordEvent[] {
  const sung = (lrc ?? []).filter((l) => l.text.trim())
  const sequential = (t0: number) => { let t = t0; const out: ChordEvent[] = []; for (const c of cif) for (const x of c.chords) { out.push({ l: t, chord: x.chord }); t += 2 } return out }
  if (!sung.length) return sequential(0)
  const { words, toks } = cifradoWords(cif)
  const lw = lyricWords(sung)
  if (!words.length || !lw.length) return sequential(Math.max(0, sung[0].t - 2))
  const map = alignWords(words, lw)
  const matched = [...map].filter((x) => x >= 0).length
  if (matched < Math.min(4, words.length * 0.2)) return sequential(Math.max(0, sung[0].t - 2)) // el cifrado no es de esta letra
  // tiempo de cada palabra del cifrado (interpolado si no coincidió)
  const wt = new Float64Array(words.length).fill(NaN), wd = new Float64Array(words.length).fill(0.4)
  map.forEach((k, i) => { if (k >= 0) { wt[i] = lw[k].t; wd[i] = lw[k].d } })
  for (let i = 0; i < words.length; i++) if (Number.isNaN(wt[i])) {
    let a = i - 1; while (a >= 0 && map[a] < 0) a--
    let b = i + 1; while (b < words.length && map[b] < 0) b++
    if (a >= 0 && b < words.length) wt[i] = wt[a] + ((i - a) / (b - a)) * (wt[b] - wt[a])
    else if (a >= 0) wt[i] = wt[a] + (i - a) * 0.4
    else if (b < words.length) wt[i] = wt[b] - (b - i) * 0.4
  }
  const ev: ChordEvent[] = []
  // recorrido en orden: palabras con acordes e instrumentales entre palabras
  let lastT = 0
  for (let x = 0; x < toks.length; x++) {
    const tk = toks[x]
    if (tk.kind === 'word') {
      const w = words[tk.i], t = wt[tk.i]
      w.chords.forEach((c, n) => ev.push({ l: t + n * 0.25, chord: c }))
      const nw = toks.slice(x + 1).find((q) => q.kind === 'word') as { kind: 'word'; i: number } | undefined
      const end = Math.min(t + wd[tk.i], nw ? wt[nw.i] - 0.05 : Infinity)
      w.after.forEach((c, n) => ev.push({ l: end + n * 0.3, chord: c }))
      lastT = t
      continue
    }
    const nx = toks.slice(x + 1).find((q) => q.kind === 'word') as { kind: 'word'; i: number } | undefined
    if (!nx) { tk.chords.forEach((c, n) => ev.push({ l: (sung[sung.length - 1].t + 4) + n * 2, chord: c })); continue } // final instrumental
    const nextT = wt[nx.i]
    const isFirst = !toks.slice(0, x).some((q) => q.kind === 'word')
    const from = Math.max(isFirst ? 0 : lastT + Math.min(4, (nextT - lastT) / 2), nextT - 2 * tk.chords.length)
    const step = (nextT - from) / tk.chords.length
    tk.chords.forEach((c, n) => ev.push({ l: from + n * step, chord: c }))
  }
  // líneas de la letra sin ninguna palabra alineada (estribillo escrito una sola vez): copiar los acordes de la línea más parecida
  const lineHit = new Set<number>(); map.forEach((k) => { if (k >= 0) lineHit.add(lw[k].line) })
  sung.forEach((l, j) => {
    if (lineHit.has(j) || lw.every((w) => w.line !== j)) return
    let gb = -1, gs = 0
    for (let i = 0; i < cif.length; i++) if (cif[i].text && cif[i].chords.length) { const s = similarity(cif[i].text, l.text); if (s > gs) { gs = s; gb = i } }
    if (gb < 0 || gs < 0.55) return
    const t0 = l.t, span = Math.min((j + 1 < sung.length ? sung[j + 1].t : t0 + 4) - t0, 8)
    const line = cif[gb], len = Math.max(line.text.trimEnd().length, ...line.chords.map((c) => c.pos + 1), 1)
    for (const c of line.chords) ev.push({ l: t0 + (Math.min(c.pos, len) / len) * span, chord: c.chord })
  })
  ev.sort((a, b) => a.l - b.l)
  const out: ChordEvent[] = []
  for (const e of ev) {
    const p = out[out.length - 1]
    if (p && p.chord === e.chord) continue
    if (p && e.l - p.l < 0.15) { out[out.length - 1] = { l: p.l, chord: e.chord }; continue }
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

/** Secuencia de acordes en orden (para el modo «Siguiente»): sirve con «Am F C G» o con un cifrado completo. */
export function chordSequence(text: string): string[] {
  return parseCifrado(text).flatMap((l) => l.chords.map((c) => c.chord))
}

// Cifrados de cancionero («letra con acordes arriba»): lectura del texto y ubicación de cada acorde en el tiempo usando la letra
// sincronizada (LRCLIB). El cifrado dice sobre qué palabra va cada acorde; la letra dice cuándo se canta cada línea.
import { audioTime, norm } from './lyrics.ts'
import type { LyricAnchor, LyricLine } from './lyrics.ts'
import type { Segment } from './types.ts'

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const LATIN: Record<string, string> = { do: 'C', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' }
const FLAT: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E' }
const ROOT = '(?:[A-G]|Do|Re|Mi|Fa|Sol|La|Si)[#b]?'
const QUAL = '(?:maj7|maj9|M7|7M|m7b5|m7|m9|m6|m|min|dim7|dim|°|º|aug|\\+|sus2|sus4|sus|add9|add2|6|7|9|11|13|5|4)*'
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
  // «A)RE», «B)mim»: marca de sección pegada al acorde. «Am.» o «G,»: algunos cancioneros ponen punto después del acorde.
  let t = tok.replace(/^[A-Za-z0-9]\)(?=\S)/, '').replace(/[()[\]*]/g, '').replace(/[.,;:]+$/, '')
  // Notación latina en mayúsculas o minúsculas («RE», «SOL5», «MIm», «mim»). En minúsculas y sin nada más («la», «mi», «si»)
  // es una palabra de la letra, no un acorde.
  const lat = /^(do|re|mi|fa|sol|la|si)(.*)$/i.exec(t)
  if (lat) {
    if (lat[1] === lat[1].toLowerCase() && !lat[2]) return null
    t = lat[1][0].toUpperCase() + lat[1].slice(1).toLowerCase() + lat[2]
  }
  if (!CHORD_RE.test(t)) return null
  const m = new RegExp(`^(${ROOT})(${QUAL})(?:\\/(${ROOT}))?$`).exec(t)
  if (!m) return null
  const root = rootName(m[1]); if (!root) return null
  const q = m[2]
  let qual = ''
  if (/^(m7b5)/.test(q)) qual = 'm7'
  else if (/^(maj7|maj9|M7|7M)/.test(q)) qual = 'maj7'
  else if (/^(dim|°|º)/.test(q)) qual = 'dim'
  else if (/^(aug|\+)/.test(q)) qual = 'aug'
  else if (/^(m|min)/.test(q)) qual = /^(m7|m9|min7)/.test(q) ? 'm7' : 'm'
  else if (/^sus2/.test(q)) qual = 'sus2'
  else if (/^(sus|4)/.test(q)) qual = 'sus4'
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

/** Línea de tablatura («E|---0---3--|»): no es letra ni acordes; se ignora. */
export const isTabLine = (l: string) => /^\s*(?:[EBGDAe]|[Mm][Ii]|[Ss][Ii]|[Ss][Oo][Ll]|[Rr][Ee]|[Ll][Aa])\s*[|:]?[-|0-9hpbrsx/\\~^().\s]{6,}$/.test(l) && /-{3,}/.test(l)

/** Datos de la página: «Tono: G», «Tonalidad: Re menor», «Tom: Am» (Cifra Club) y «Capo en 2», «Cejilla en el 3er traste»,
 *  «Capotraste na 2ª casa». */
const META_KEY = /^\s*(?:tono|tonalidad|tom|key)\s*[:=]?\s*(\S+)(?:\s+(menor|mayor|minor|major))?/i
const META_CAPO = /^\s*(?:capo|cejilla|capotraste)\b\D{0,25}?(\d{1,2})/i
const metaKey = (l: string) => { const k = META_KEY.exec(l); if (!k) return null; const t = k[1].replace(/[.,;]$/, ''); return normalizeChord(t[0].toUpperCase() + t.slice(1)) }
const isMetaLine = (l: string) => !!metaKey(l) || META_CAPO.test(l) || /^\s*(?:sin capo|sin cejilla)\b/i.test(l)
export function cifradoMeta(text: string): { key?: string; capo?: number } {
  const out: { key?: string; capo?: number } = {}
  for (const l of text.split(/\r?\n/).slice(0, 40)) {
    const c0 = !out.key ? metaKey(l) : null
    if (c0) out.key = /^(menor|minor)$/i.test(META_KEY.exec(l)?.[2] ?? '') && !c0.includes('m') ? c0 + 'm' : c0
    const c = META_CAPO.exec(l)
    if (c && out.capo === undefined) { const n = Number(c[1]); if (n >= 1 && n <= 12) out.capo = n }
  }
  return out
}

/** Letra sin tiempos sacada del cifrado (para cuando LRCLIB no la tiene): sin acordes, títulos ni datos de la página, y
 *  uniendo las líneas que la página cortó por el ancho del celular. */
export function cifradoLyrics(lines: CifradoLine[]): string {
  const txt = lines.map((l) => l.text.replace(/\s+$/, '').replace(/^\s+/, '')).filter((t) => t && !isHeading(t) && !isMetaLine(t))
  const max = Math.max(1, ...txt.map((t) => t.length))
  const out: string[] = []
  for (const t of txt) {
    const prev = out[out.length - 1]
    if (prev && prev.length >= 0.75 * max && !/[.,;:!?…)]$/.test(prev) && /^[a-záéíóúñü]/.test(t) && t.length < 0.5 * max) out[out.length - 1] = `${prev} ${t}`
    else out.push(t)
  }
  return out.join('\n')
}

/** Letra con tiempos sacada de los ACORDES (cuando no hay letra sincronizada de LRCLIB): cada línea del cifrado aparece cuando
 *  suena el primer acorde que tiene encima; las líneas sin acordes se reparten entre sus vecinas. starts: inicio de cada cambio
 *  de acorde, en el mismo orden que los acordes del cifrado. */
export function lyricsFromChords(lines: CifradoLine[], starts: number[]): LyricLine[] {
  const out: { t: number; text: string }[] = []
  let k = 0, prev = NaN
  for (const l of lines) {
    const text = l.text.trim()
    let t = NaN
    if (l.chords.length && k < starts.length) {
      const c = starts[k]
      const len = Math.max(1, l.text.trimEnd().length)
      // si el primer acorde cae a mitad de la línea, el canto empezó un poco antes
      t = l.chords[0].pos / len > 0.3 && Number.isFinite(prev) ? prev + (c - prev) * 0.5 : Math.max(0, c - 0.2)
      prev = starts[Math.min(starts.length - 1, k + l.chords.length - 1)]
      k += l.chords.length
    }
    if (!text || isHeading(text) || isMetaLine(text)) continue
    out.push({ t, text })
  }
  // líneas sin acordes: repartidas entre la anterior y la siguiente con tiempo; al final, 3 s cada una
  for (let i = 0; i < out.length; i++) if (!Number.isFinite(out[i].t)) {
    let a = i - 1; while (a >= 0 && !Number.isFinite(out[a].t)) a--
    let b = i + 1; while (b < out.length && !Number.isFinite(out[b].t)) b++
    const ta = a >= 0 ? out[a].t : 0
    out[i].t = b < out.length ? ta + ((i - a) / (b - a)) * (out[b].t - ta) : ta + (i - a) * 3
  }
  for (let i = 1; i < out.length; i++) if (out[i].t < out[i - 1].t) out[i].t = out[i - 1].t
  return out
}

/** Lee un cifrado: cada línea de acordes se une a la línea de letra que tiene debajo; si no hay letra, queda como línea instrumental. */
export function parseCifrado(text: string): CifradoLine[] {
  const lines = text.replace(/\t/g, '    ').split(/\r?\n/).filter((l) => !isTabLine(l) && !isMetaLine(l))
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

/** Vuelve a armar el texto de un cifrado ya leído (acordes arriba de su línea), para leerlo de nuevo con reglas mejoradas. */
export function cifradoText(lines: CifradoLine[]): string {
  return lines.map((l) => {
    if (!l.chords.length) return l.text
    let row = ''
    for (const c of l.chords) { if (row.length && row.length >= c.pos) row += ' '; row = row.padEnd(c.pos, ' ') + c.chord }
    return l.text ? `${row}\n${l.text}` : row
  }).join('\n')
}
const countChords = (lines: CifradoLine[]) => lines.reduce((a, l) => a + l.chords.length, 0)
/** Canciones guardadas con una versión anterior: si al leer de nuevo su cifrado aparecen más acordes, devuelve el cifrado nuevo. */
export function upgradeCifrado(lines: CifradoLine[]): CifradoLine[] | null {
  const again = parseCifrado(cifradoText(lines))
  return countChords(again) > countChords(lines) ? again : null
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
  // La letra que sobra al final no cuesta: así una estrofa que se repite más adelante se une a su PRIMERA aparición
  // (antes se unía a la última y la primera quedaba casi sin acordes). Las repeticiones se completan después.
  let jEnd = m
  for (let j = 0; j <= m; j++) if (S[n * W + j] > S[n * W + jEnd] || (S[n * W + j] === S[n * W + jEnd] && j < jEnd)) jEnd = j
  let i = n, j = jEnd
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
  ev.push(...fillSections(ev, sung, lrc ?? []))
  ev.sort((a, b) => a.l - b.l)
  const out: ChordEvent[] = []
  for (const e of ev) {
    const p = out[out.length - 1]
    if (p && p.chord === e.chord) continue
    out.push({ ...e })
  }
  return spreadEvents(out)
}

/** Estrofas de la letra sincronizada: se cortan en las líneas vacías de LRCLIB o en un silencio largo entre líneas. */
export function lyricSections(sung: LyricLine[], raw: LyricLine[]): number[][] {
  if (!sung.length) return []
  const gaps = sung.slice(1).map((l, j) => l.t - sung[j].t).sort((a, b) => a - b)
  const med = gaps.length ? gaps[gaps.length >> 1] : 4
  const out: number[][] = [[0]]
  for (let j = 1; j < sung.length; j++) {
    const a = sung[j - 1].t, b = sung[j].t
    const blank = raw.some((l) => !l.text.trim() && l.t > a && l.t < b)
    if (blank || b - a > Math.max(4, 1.8 * med)) out.push([j]); else out[out.length - 1].push(j)
  }
  // Sin separaciones (todas las líneas parejas): una «estrofa» de más de 8 líneas se parte en cuartetas (o de 5 o 6 si encaja justo).
  return out.flatMap((sec) => {
    if (sec.length <= 8) return [sec]
    const k = sec.length % 4 === 0 ? 4 : sec.length % 6 === 0 ? 6 : sec.length % 5 === 0 ? 5 : 4
    const parts: number[][] = []
    for (let i = 0; i < sec.length; i += k) parts.push(sec.slice(i, i + k))
    return parts
  })
}

/** Los cancioneros suelen escribir los acordes solo la primera vez de cada estrofa o estribillo. Si una estrofa de la letra quedó
 *  casi sin cambios de acorde, se copian los de la estrofa anterior más parecida (por el texto y por la cantidad de líneas),
 *  línea por línea y en la misma posición relativa dentro de cada línea. Las líneas que ya tienen acordes no se tocan. */
function fillSections(ev: ChordEvent[], sung: LyricLine[], raw: LyricLine[]): ChordEvent[] {
  const span = (j: number) => Math.min((j + 1 < sung.length ? sung[j + 1].t : sung[j].t + 4) - sung[j].t, 8)
  const lineEv = sung.map((l, j) => {
    const end = j + 1 < sung.length ? sung[j + 1].t : l.t + 4
    return ev.filter((e) => e.l >= l.t - 0.25 && e.l < end - 0.25).map((e) => ({ f: (e.l - l.t) / span(j), chord: e.chord }))
  })
  const secs = lyricSections(sung, raw)
  const chorded = (sec: number[]) => sec.filter((j) => lineEv[j].length).length / sec.length
  const added: ChordEvent[] = []
  secs.forEach((T, ti) => {
    if (chorded(T) >= 0.5) return
    let best: number[] | null = null, bestScore = 0.5
    for (let pi = 0; pi < ti; pi++) {
      const P = secs[pi]
      if (chorded(P) < 0.6) continue
      const sim = T.filter((j) => P.some((k) => similarity(sung[k].text, sung[j].text) >= 0.6)).length
      const len = T.length === P.length ? 1 : T.length % P.length === 0 || P.length % T.length === 0 ? 0.5 : 0
      const score = 2 * sim + len
      if (score > bestScore) { bestScore = score; best = P }
    }
    if (!best) return
    T.forEach((j, i) => {
      if (lineEv[j].length) return
      const src = best![i % best!.length]
      for (const e of lineEv[src]) added.push({ l: sung[j].t + Math.max(-0.25, e.f) * span(j), chord: e.chord })
    })
  })
  return added
}

/** Partes de la letra que quedaron sin ningún acorde (la página no las trae): primera línea de cada una, para avisar. */
export function uncoveredParts(ev: ChordEvent[], lrc: LyricLine[] | null): string[] {
  const raw = lrc ?? [], sung = raw.filter((l) => l.text.trim())
  if (!sung.length || !ev.length) return []
  const has = (j: number) => { const end = j + 1 < sung.length ? sung[j + 1].t : sung[j].t + 4; return ev.some((e) => e.l >= sung[j].t - 0.25 && e.l < end - 0.25) }
  return lyricSections(sung, raw).filter((sec) => sec.length >= 2 && !sec.some(has)).map((sec) => sung[sec[0]].text.trim())
}

/** Separación mínima entre dos acordes seguidos (s): ningún acorde se descarta por caer pegado a otro (p. ej. el último de una línea
 *  y el primero de la siguiente); el anterior se corre hacia atrás, que es donde el cifrado lo pone «un poco antes». */
export const MIN_CHORD_GAP = 0.5
export function spreadEvents(ev: ChordEvent[]): ChordEvent[] {
  const out = ev.map((e) => ({ ...e }))
  for (let i = out.length - 2; i >= 0; i--) if (out[i + 1].l - out[i].l < MIN_CHORD_GAP) out[i].l = out[i + 1].l - MIN_CHORD_GAP
  if (out.length && out[0].l < 0) out[0].l = 0
  for (let i = 1; i < out.length; i++) if (out[i].l - out[i - 1].l < MIN_CHORD_GAP) out[i].l = out[i - 1].l + MIN_CHORD_GAP
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

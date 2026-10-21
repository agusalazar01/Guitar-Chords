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
  let t = tok.replace(/^[A-Za-z0-9]\)(?=\S)/, '').replace(/[()[\]*]/g, '').replace(/[.,;:]+$/, '').replace(/(\d)\/(\d{1,2})$/, '$1$2') // «F#7/9», «6/9»: extensión, no bajo
  // Notación latina en mayúsculas o minúsculas («RE», «SOL5», «MIm», «mim»). En minúsculas y sin nada más («la», «mi», «si»)
  // es una palabra de la letra, no un acorde.
  const lat = /^(do|re|mi|fa|sol|la|si)(.*)$/i.exec(t)
  if (lat) {
    if (lat[1] === lat[1].toLowerCase() && !lat[2]) return null
    t = lat[1][0].toUpperCase() + lat[1].slice(1).toLowerCase() + lat[2]
  }
  if (!CHORD_RE.test(t)) {
    // Notaciones propias de algunos cancioneros: «B7.9», «F7.13», «E(s3)6», «C#7[4-», «F#m7*». Se toma el acorde del comienzo.
    const pre = /^([A-G][#b]?(?:m(?!aj))?(?:maj7|7M|dim|aug|sus4|sus2|°|º|7|6|9|4)?)[.([*]/.exec(tok.replace(/[.,;:]+$/, ''))
    return pre && pre[1] !== tok ? normalizeChord(pre[1]) : null
  }
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
    if (/^(\||-+|x\d+|\(?x\d+\)?|\d+x|x|\d+|bis)$/i.test(raw) || /^[A-Za-zÁÉÍÓÚáéíóúñ]+:$/.test(raw) || /^[\d\-[\]().]+$/.test(raw)) continue
    if (/^(intro|introducci[oó]n|coro|estribillo|puente|solo|final|interludio|outro|riff|verso|estrofa|pre-?coro)$/i.test(raw)) continue // etiqueta sin «:»
    const c = normalizeChord(raw)
    if (c) { out.push({ pos: t.index ?? 0, chord: c }); continue }
    // «Bm-G-D-A» o «(Bm-G-D-A)»: varios acordes unidos con guiones
    const parts = raw.replace(/^\(|\)$/g, '').split('-')
    const pc = parts.length > 1 ? parts.map((x) => normalizeChord(x)) : []
    if (pc.length && pc.every(Boolean)) { let off = (t.index ?? 0) + (raw.startsWith('(') ? 1 : 0); parts.forEach((x, i) => { out.push({ pos: off, chord: pc[i]! }); off += x.length + 1 }); continue }
    other++
  }
  // casi todo acordes; con 3 o más acordes alcanza con que haya tantos acordes como otras palabras («FA#m RE LA  Tablatura abajo»)
  return out.length && (out.length >= 2 * other || (out.length >= 3 && out.length >= other)) ? out : null
}

/** Línea de tablatura («E|---0---3--|»): no es letra ni acordes; se ignora. */
export const isTabLine = (l: string) => {
  const t = l.replace(/^\s*\d+\)\s*/, '') // «1)  G|--4---»
  if (/^\s*(?:[EBGDAe]|[Mm][Ii]|[Ss][Ii]|[Ss][Oo][Ll]|[Rr][Ee]|[Ll][Aa])\s*[|:]?[-|0-9hpbrsx/\\~^().\s]{6,}$/.test(t) && /-{3,}/.test(t)) return true
  // cuerda + mayoría de guiones y números («e-0-0-2-2-3», «B-3-(8 veces)-1-0---»)
  const m = /^\s*(?:[EBGDAe]|[Mm][Ii]|[Ss][Ii]|[Ss][Oo][Ll]|[Rr][Ee]|[Ll][Aa])\s*[|:-](.*)$/.exec(t)
  if (!m || m[1].length < 8) return false
  const tab = (m[1].match(/[-|0-9]/g) ?? []).length
  return /-{2,}/.test(m[1]) && tab >= 0.7 * m[1].replace(/\s/g, '').length
}

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
export function alignCifrado(cif: CifradoLine[], lrc: LyricLine[] | null, opts: { fill?: boolean; sungOnly?: boolean; quantize?: number } = {}): ChordEvent[] {
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
  if (opts.fill !== false) ev.push(...fillSections(ev, sung, lrc ?? [])) // fill: false → solo lo que trae la página (para avisar qué falta)
  ev.sort((a, b) => a.l - b.l)
  const out: ChordEvent[] = []
  for (const e of ev) {
    const p = out[out.length - 1]
    if (p && p.chord === e.chord) continue
    out.push({ ...e })
  }
  let res = opts.sungOnly === false ? spreadEvents(out) : compressToSung(spreadEvents(out), sung)
  if (opts.quantize) res = quantizeInLines(res, sung, opts.quantize)
  return spreadEvents(res)
}

/** Los acordes cambian en tiempos regulares del compás, no según la cantidad de letras: dentro de cada línea (desde que empieza
 *  hasta la siguiente) cada acorde se lleva a la fracción más cercana de la línea en «parts» partes iguales (4: cuartos), sin
 *  cambiar el orden. Así en «Am · · Dm G» el Am dura dos partes y el Dm y el G una cada uno. */
export function quantizeInLines(ev: ChordEvent[], sung: LyricLine[], parts: number): ChordEvent[] {
  if (sung.length < 2) return ev
  const out = ev.map((e) => ({ ...e }))
  for (let j = 0; j < sung.length; j++) {
    const t0 = sung[j].t, t1 = j + 1 < sung.length ? sung[j + 1].t : t0 + 4
    const span = Math.min(t1 - t0, 8)
    const idx = out.map((e, i) => [e, i] as const).filter(([e]) => e.l >= t0 - 0.06 && e.l < t0 + span - 0.06).map(([, i]) => i)
    if (!idx.length) continue
    const n = idx.length
    if (n > parts) continue // más acordes que partes: se dejan como están
    const f = idx.map((i) => Math.max(0, Math.min(1, (out[i].l - t0) / span)) * parts)
    // reparto óptimo: lugares crecientes 0..parts-1 lo más cerca posible de donde caían (programación dinámica)
    const INF = 1e9, cost: number[][] = [], from: number[][] = []
    for (let k = 0; k < n; k++) {
      cost.push(new Array(parts).fill(INF)); from.push(new Array(parts).fill(-1))
      for (let q = 0; q < parts; q++) {
        const c = Math.abs(q - f[k]) + (k === 0 && f[0] < 0.05 && q !== 0 ? INF : 0) // el acorde del comienzo de la línea se queda en 0
        if (k === 0) { cost[0][q] = c; continue }
        for (let p = 0; p < q; p++) if (cost[k - 1][p] + c < cost[k][q]) { cost[k][q] = cost[k - 1][p] + c; from[k][q] = p }
      }
    }
    let q = cost[n - 1].indexOf(Math.min(...cost[n - 1]))
    if (cost[n - 1][q] >= INF) continue
    for (let k = n - 1; k >= 0; k--) { out[idx[k]].l = t0 + (q / parts) * span; q = from[k][q] }
  }
  return out.sort((a, b) => a.l - b.l)
}

/** La letra sincronizada dice cuándo empieza cada línea, no cuánto dura el canto: si después viene un silencio, repartir los
 *  acordes por letras hasta la línea siguiente los atrasa. Se estima el ritmo del canto de la canción (segundos por letra en
 *  las líneas más «apretadas») y cada acorde de dentro de la línea se ubica en la parte cantada. El acorde del comienzo de la
 *  línea no se mueve. Medido con 80+ canciones con referencia exacta (ChoCo): acierto 56,8 % → 61,5 %, error típico 0,65 → 0,50 s. */
export function compressToSung(ev: ChordEvent[], sung: LyricLine[]): ChordEvent[] {
  if (sung.length < 2) return ev
  const lines = sung.map((l, j) => ({ t: l.t, span: Math.min((j + 1 < sung.length ? sung[j + 1].t : l.t + 4) - l.t, 8), len: Math.max(1, l.text.length) }))
  const rates = lines.map((L) => L.span / L.len).sort((a, b) => a - b)
  const alpha = rates[rates.length >> 1] // s/letra típico de la canción (mediana): solo se comprimen las líneas seguidas de una pausa
  return ev.map((e) => {
    let L: (typeof lines)[number] | null = null
    for (const x of lines) { if (x.t <= e.l + 0.01) L = x; else break }
    if (!L || Math.abs(e.l - L.t) < 0.06) return e // antes del canto o comienzo de línea
    const f = Math.min(1, (e.l - L.t) / L.span)
    const sungDur = Math.min(L.span, Math.max(0.5, alpha * L.len * 1.15))
    return { ...e, l: L.t + f * sungDur }
  }).sort((a, b) => a.l - b.l)
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
  // Modelos posibles: estrofas con acordes, o un tramo de una estrofa más larga del mismo tamaño (la mitad de una de 8 líneas).
  const cands: { P: number[]; o: number }[] = []
  let prevEnd = -2 // última línea del modelo usado antes: la parte que le sigue en la canción tiene preferencia (estribillo en dos mitades)
  const len = (j: number) => Math.max(1, sung[j].text.trim().length)
  secs.forEach((T, ti) => {
    if (chorded(T) >= 0.5) { prevEnd = T[T.length - 1]; return }
    cands.length = 0
    for (let pi = 0; pi < ti; pi++) {
      const P = secs[pi]
      if (chorded(P) < 0.6) continue
      if (P.length > T.length && P.length % T.length === 0) for (let o = 0; o < P.length; o += T.length) cands.push({ P: P.slice(o, o + T.length), o })
      else cands.push({ P, o: 0 })
    }
    let best: number[] | null = null, bestScore = 0.5
    for (const { P, o } of cands) {
      const sim = T.filter((j) => P.some((k) => similarity(sung[k].text, sung[j].text) >= 0.75)).length
      const lenScore = T.length === P.length ? 1 : T.length % P.length === 0 || P.length % T.length === 0 ? 0.5 : 0
      // forma: largo parecido de cada línea (las estrofas se parecen entre sí más que a un estribillo)
      const shape = T.reduce((acc, j, i) => { const k = P[i % P.length]; return acc + 1 - Math.abs(len(j) - len(k)) / Math.max(len(j), len(k)) }, 0) / T.length
      // tramo del comienzo de una estrofa: leve preferencia (lo que sigue lo decide la continuidad)
      const score = 2 * sim + lenScore + 1.5 * shape + (P[0] === prevEnd + 1 ? 1 : 0) + (o === 0 ? 0.4 : 0)
      if (score > bestScore) { bestScore = score; best = P }
    }
    prevEnd = best ? best[best.length - 1] : -2
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
/** Compases marcados por el usuario («Marcar compás»): el momento de cada «uno» (en segundos del audio o video) y los tiempos
 *  por compás. */
export interface BarTaps { bars: number[]; bpb: number; meter?: string }

/** Compases para elegir al marcar el pulso: tiempos por compás y tiempo fuerte intermedio (0 = ninguno). */
// pulses: golpes que se sienten (y se marcan) por compás; en 6/8 y 12/8 el golpe es la negra con puntillo.
export const METERS: Record<string, { bpb: number; mid: number; pulses: number }> = {
  '2/4': { bpb: 2, mid: 0, pulses: 2 }, '3/4': { bpb: 3, mid: 0, pulses: 3 }, '4/4': { bpb: 4, mid: 3, pulses: 4 },
  '5/4': { bpb: 5, mid: 4, pulses: 5 }, '6/8': { bpb: 6, mid: 4, pulses: 2 }, '12/8': { bpb: 12, mid: 7, pulses: 4 },
}
export const midBeat = (t: BarTaps) => (t.meter && METERS[t.meter] ? METERS[t.meter].mid : t.bpb === 4 ? 3 : 0)

/** Las marcas del usuario pueden ser cada golpe (el pulso) o solo el «uno» de cada compás. Si parecen golpes (marcas muy
 *  seguidas para ser compases), la primera marca es un «uno» y se toma una de cada `pulses`. Devuelve los «uno».
 *  (No se puede deducir el «uno» de los acordes: con los tiempos de la letra caen en cualquier golpe por igual.)
 *  El dedo no es exacto: cada «uno» sale de promediar las marcas vecinas (recta local, que sigue los cambios de tempo de la
 *  grabación), una marca muy desviada pesa poco y los golpes salteados se completan. */
export function barsFromTaps(taps: number[], pulses: number): number[] {
  const t = [...taps].sort((a, b) => a - b)
  if (t.length < 2) return t
  const gaps = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b)
  const med = gaps[gaps.length >> 1]
  if (!(med > 0.05)) return t
  const beats = pulses >= 2 && (med < 0.8 || (med < 1.2 && pulses >= 3)) // un compás de 3 o más golpes en menos de 1,2 s sería rapidísimo
  if (beats && t.length < 2 * pulses) return t
  // número de cada marca contando golpes (o compases) por tiempo: un golpe salteado o un toque doble no corre la cuenta
  const K = [0], T = [t[0]] // toque doble (menos de medio golpe después del anterior que quedó): queda el primero
  for (let i = 1; i < t.length; i++) {
    // dónde «debería» estar el último golpe contado y cuánto dura un golpe, según las últimas marcas (recta): así un toque
    // desviado no suma ni resta un golpe a la cuenta
    const n0 = Math.max(0, K.length - 8), kk = K.slice(n0), tt = T.slice(n0), m = kk.length
    let per = med, last = T[T.length - 1]
    if (m >= 4) {
      const mk = kk.reduce((a, b) => a + b, 0) / m, mt = tt.reduce((a, b) => a + b, 0) / m
      let num = 0, den = 0
      for (let j = 0; j < m; j++) { num += (kk[j] - mk) * (tt[j] - mt); den += (kk[j] - mk) ** 2 }
      if (den > 0 && num / den > 0.5 * med && num / den < 2 * med) { per = num / den; last = mt + per * (K[K.length - 1] - mk) }
    }
    const g = Math.round((t[i] - last) / per)
    if (g >= 1) { K.push(K[K.length - 1] + g); T.push(t[i]) }
  }
  const H = beats ? 8 : 3 // ventana: ±8 golpes o ±3 compases
  let rw = K.map(() => 1) // pesos por marca (bajan para las muy desviadas)
  const fit = (q: number) => {
    let sw = 0, sk = 0, st = 0, skk = 0, skt = 0
    for (let i = 0; i < K.length; i++) {
      const d = Math.abs(K[i] - q) / (H + 1)
      if (d >= 1) continue
      const w = (1 - d * d * d) ** 3 * rw[i]
      sw += w; sk += w * K[i]; st += w * T[i]; skk += w * K[i] * K[i]; skt += w * K[i] * T[i]
    }
    if (sw <= 0) return NaN
    const den = sw * skk - sk * sk
    const b = Math.abs(den) > 1e-9 ? (sw * skt - sk * st) / den : 0
    return (st - b * sk) / sw + b * q
  }
  if (K.length >= 4) {
    const res = K.map((q, i) => T[i] - fit(q)), mad = [...res].map(Math.abs).sort((a, b) => a - b)[res.length >> 1] || 0.01
    rw = res.map((r) => { const u = r / (6 * mad); return Math.abs(u) < 1 ? (1 - u * u) ** 2 : 0 })
  }
  const step = beats ? pulses : 1, out: number[] = []
  for (let q = 0; q <= K[K.length - 1]; q += step) { const v = K.length >= 3 ? fit(q) : NaN; out.push(+(Number.isFinite(v) ? v : T[0] + q * med).toFixed(3)) }
  return out
}

/** Pulsos a partir de los «unos» marcados: cada compás se divide en bpb tiempos iguales. Devuelve [segundo, nº de tiempo]. */
export function gridFromBars(bars: number[], bpb: number): [number, number][] {
  const b = [...bars].sort((x, y) => x - y), out: [number, number][] = []
  for (let i = 0; i + 1 < b.length; i++) { const d = (b[i + 1] - b[i]) / bpb; for (let k = 0; k < bpb; k++) out.push([b[i] + k * d, k + 1]) }
  if (b.length) out.push([b[b.length - 1], 1])
  return out
}

/** Ubica los acordes de cada línea sobre los pulsos marcados: mantienen el orden, ocupan tiempos completos y prefieren el «uno»
 *  del compás (y algo el tiempo fuerte intermedio: el 3.º en 4/4, el 4.º en 6/8). Las líneas fuera de la parte marcada no se tocan. Medido con 145 canciones con
 *  referencia exacta marcando el «uno» en toda la canción: acierto 54,7 % → 58,1 %, error típico de cada cambio 0,64 → 0,13 s. */
export function placeOnBeats(pts: { t: number; chord: string }[], lines: { t: number; end: number }[], beats: [number, number][], lam = 5, pre = 1, mid = 3): { t: number; chord: string }[] {
  if (beats.length < 2) return pts
  const out = pts.map((p) => ({ ...p }))
  const step = (beats[beats.length - 1][0] - beats[0][0]) / (beats.length - 1)
  let used = -Infinity // último golpe ocupado: dos líneas no pueden poner acordes en el mismo golpe (uno desaparecería)
  for (const L of lines) {
    const idx = out.map((p, i) => [p, i] as const).filter(([p]) => p.t >= L.t - 0.06 && p.t < L.end - 0.06).map(([, i]) => i)
    if (!idx.length) continue
    const slots = beats.filter((b) => b[0] >= L.t - pre * step && b[0] > used + 0.01 && b[0] < L.end - 0.3 * step)
    if (slots.length < idx.length) continue
    const n = idx.length, m = slots.length, INF = 1e9
    const cost: number[][] = [], from: number[][] = []
    for (let k = 0; k < n; k++) {
      cost.push(new Array(m).fill(INF)); from.push(new Array(m).fill(-1))
      for (let q = 0; q < m; q++) {
        const [bt, bn] = slots[q]
        const c = Math.abs(bt - out[idx[k]].t) / step - (bn === 1 ? lam : mid && bn === mid ? lam / 2 : 0)
        if (k === 0) { cost[0][q] = c; continue }
        for (let p = 0; p < q; p++) if (cost[k - 1][p] + c < cost[k][q]) { cost[k][q] = cost[k - 1][p] + c; from[k][q] = p }
      }
    }
    let q = cost[n - 1].indexOf(Math.min(...cost[n - 1]))
    used = slots[q][0]
    for (let k = n - 1; k >= 0; k--) { out[idx[k]].t = slots[q][0]; q = from[k][q] }
  }
  return out.sort((a, b) => a.t - b.t)
}

export function cifradoSegments(ev: ChordEvent[], duration: number, anchors: LyricAnchor[] = [], offset = 0, grid?: BarTaps & { lines: LyricLine[] }): Segment[] {
  let pts = ev.map((e) => ({ t: Math.max(0, audioTime(e.l, anchors, offset)), chord: e.chord })).sort((a, b) => a.t - b.t)
  if (grid && grid.bars.length >= 2) {
    const sung = grid.lines.filter((l) => l.text.trim()).map((l) => audioTime(l.t, anchors, offset))
    const lines = sung.map((t, j) => ({ t, end: j + 1 < sung.length ? sung[j + 1] : t + 4 }))
    pts = placeOnBeats(pts, lines, gridFromBars(grid.bars, grid.bpb), 5, 1, midBeat(grid))
  }
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

/** MP3 analizado + «Marcar pulso»: cada cambio de acorde se corre al golpe marcado más cercano (si está a menos de ~⅓ de golpe),
 *  sin juntar dos cambios en el mismo golpe. No cambia la cantidad de acordes (los índices siguen valiendo). */
export function snapToBeats(segs: Segment[], beats: number[], tol = 0.35): Segment[] {
  if (beats.length < 2 || segs.length < 2) return segs
  const starts = segs.map((s) => s.start)
  for (let i = 1; i < segs.length; i++) {
    const t = segs[i].start
    let lo = 0, hi = beats.length - 1
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (beats[m] <= t) lo = m; else hi = m }
    const b = Math.abs(beats[lo] - t) <= Math.abs(beats[hi] - t) ? beats[lo] : beats[hi]
    const step = beats[hi] - beats[lo] || 0.5
    if (Math.abs(b - t) <= tol * step && b > starts[i - 1] + 0.05 && (i + 1 >= segs.length || b < segs[i + 1].start - 0.05)) starts[i] = Math.round(b * 100) / 100
  }
  return segs.map((s, i) => ({ ...s, start: starts[i], end: i + 1 < segs.length ? starts[i + 1] : s.end }))
}

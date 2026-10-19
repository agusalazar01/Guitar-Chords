/** Posiciones de guitarra. frets/fingers van de la 6ª cuerda (Mi grave) a la 1ª; -1 = no tocar, 0 = al aire. */
import type { Barre, Diagram } from './types.ts'

export const TUNING = [4, 9, 2, 7, 11, 4] // E A D G B E (clases de altura)
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' }
const SUFFIX = 'maj7|m7|sus2|sus4|dim|aug|add9|m|7|6|9'
const TONES: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], aug: [0, 4, 8], '6': [0, 4, 7, 9], add9: [0, 2, 4, 7], '9': [0, 2, 4, 7, 10] }

const OPEN: Record<string, [number[], number[]]> = {
  C: [[-1, 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0]], D: [[-1, -1, 0, 2, 3, 2], [0, 0, 0, 1, 3, 2]],
  E: [[0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0]], G: [[3, 2, 0, 0, 0, 3], [2, 1, 0, 0, 0, 3]],
  A: [[-1, 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0]], Am: [[-1, 0, 2, 2, 1, 0], [0, 0, 2, 3, 1, 0]],
  Dm: [[-1, -1, 0, 2, 3, 1], [0, 0, 0, 2, 3, 1]], Em: [[0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0]],
  C7: [[-1, 3, 2, 3, 1, 0], [0, 3, 2, 4, 1, 0]], D7: [[-1, -1, 0, 2, 1, 2], [0, 0, 0, 2, 1, 3]],
  E7: [[0, 2, 0, 1, 0, 0], [0, 2, 0, 1, 0, 0]], G7: [[3, 2, 0, 0, 0, 1], [3, 2, 0, 0, 0, 1]],
  A7: [[-1, 0, 2, 0, 2, 0], [0, 0, 2, 0, 3, 0]], B7: [[-1, 2, 1, 2, 0, 2], [0, 2, 1, 3, 0, 4]],
  Cmaj7: [[-1, 3, 2, 0, 0, 0], [0, 3, 2, 0, 0, 0]], Dmaj7: [[-1, -1, 0, 2, 2, 2], [0, 0, 0, 1, 1, 1]],
  Emaj7: [[0, 2, 1, 1, 0, 0], [0, 3, 1, 2, 0, 0]], Fmaj7: [[-1, -1, 3, 2, 1, 0], [0, 0, 3, 2, 1, 0]],
  Gmaj7: [[3, 2, 0, 0, 0, 2], [3, 2, 0, 0, 0, 1]], Amaj7: [[-1, 0, 2, 1, 2, 0], [0, 0, 3, 1, 2, 0]],
  Am7: [[-1, 0, 2, 0, 1, 0], [0, 0, 2, 0, 1, 0]], Dm7: [[-1, -1, 0, 2, 1, 1], [0, 0, 0, 2, 1, 1]],
  Em7: [[0, 2, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0]], Bm7: [[-1, 2, 0, 2, 0, 2], [0, 1, 0, 2, 0, 3]],
  Asus2: [[-1, 0, 2, 2, 0, 0], [0, 0, 1, 2, 0, 0]], Asus4: [[-1, 0, 2, 2, 3, 0], [0, 0, 1, 2, 3, 0]],
  Dsus2: [[-1, -1, 0, 2, 3, 0], [0, 0, 0, 1, 3, 0]], Dsus4: [[-1, -1, 0, 2, 3, 3], [0, 0, 0, 1, 2, 3]],
  Esus4: [[0, 2, 2, 2, 0, 0], [0, 2, 3, 4, 0, 0]], Bdim: [[-1, 2, 3, 4, 3, -1], [0, 1, 2, 4, 3, 0]],
  Caug: [[-1, 3, 2, 1, 1, 0], [0, 4, 3, 1, 2, 0]],
}

export function normalize(name: string): [string, string] | null {
  const m = new RegExp(`^([A-G][#b]?)(${SUFFIX})?$`).exec((name ?? '').replace(/\/.*$/, '')) // «G/B» usa la forma de G
  if (!m) return null
  const root = FLATS[m[1]] ?? m[1]
  return NOTES.includes(root) ? [root, m[2] ?? ''] : null
}

export function chordTones(name: string): Set<number> | null {
  const n = normalize(name)
  if (!n) return null
  const r = NOTES.indexOf(n[0])
  return new Set(TONES[n[1]].map((i) => (r + i) % 12))
}

function diagram(chord: string, label: string, frets: number[], fingers: number[], barre: Barre | null = null,
  source = 'Tabla estándar de acordes'): Diagram {
  const pos = frets.filter((f) => f > 0)
  const base = !pos.length || Math.max(...pos) <= 4 ? 1 : Math.min(...pos)
  return { chord, label, frets, fingers, base_fret: base, barre, source }
}

/** Formas móviles (cejilla) para acordes sin posición abierta. off: trastes relativos a la raíz (null = no tocar).
 *  Cada forma se comprueba nota por nota en los tests (solo notas del acorde, las obligatorias presentes y la raíz en el bajo). */
interface Shape { q: string; on: 6 | 5; off: (number | null)[]; fingers: number[]; barre: [number, number, number] | null; minFret?: number }
const SHAPES: Shape[] = [
  { q: '7', on: 6, off: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1], barre: [0, 0, 5] },
  { q: 'm7', on: 6, off: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1], barre: [0, 0, 5] },
  { q: 'maj7', on: 6, off: [0, null, 1, 1, 0, null], fingers: [1, 0, 3, 4, 2, 0], barre: null },
  { q: 'sus4', on: 6, off: [0, 2, 2, 2, 0, 0], fingers: [1, 2, 3, 4, 1, 1], barre: [0, 0, 5] },
  { q: '7', on: 5, off: [null, 0, 2, 0, 2, 0], fingers: [0, 1, 3, 1, 4, 1], barre: [0, 1, 5] },
  { q: 'm7', on: 5, off: [null, 0, 2, 0, 1, 0], fingers: [0, 1, 3, 1, 2, 1], barre: [0, 1, 5] },
  { q: 'maj7', on: 5, off: [null, 0, 2, 1, 2, 0], fingers: [0, 1, 3, 2, 4, 1], barre: [0, 1, 5] },
  { q: 'sus4', on: 5, off: [null, 0, 2, 2, 3, 0], fingers: [0, 1, 2, 3, 4, 1], barre: [0, 1, 5] },
  { q: 'sus2', on: 5, off: [null, 0, 2, 2, 0, 0], fingers: [0, 1, 3, 4, 1, 1], barre: [0, 1, 5] },
  { q: 'dim', on: 5, off: [null, 0, 1, 2, 1, null], fingers: [0, 1, 2, 4, 3, 0], barre: null },
  { q: 'aug', on: 5, off: [null, 0, -1, -2, -2, null], fingers: [0, 4, 3, 1, 1, 0], barre: [-2, 3, 4], minFret: 3 },
  { q: '6', on: 5, off: [null, 0, 2, 2, 2, 2], fingers: [0, 1, 3, 3, 3, 3], barre: [2, 2, 5] },
  { q: '9', on: 5, off: [null, 0, -1, 0, 0, 0], fingers: [0, 2, 1, 3, 3, 3], barre: [0, 3, 5], minFret: 2 },
]

export function getDiagrams(name: string): Diagram[] {
  const n = normalize(name)
  if (!n) return []
  const [root, q] = n
  const chord = root + q, out: Diagram[] = []
  if (OPEN[chord]) out.push(diagram(chord, 'Abierto', OPEN[chord][0], OPEN[chord][1]))
  // Orden convencional: abierta → cejilla más cercana a la cejuela (F = cejilla traste 1, Bm = forma de La traste 2) →
  // variantes simplificadas → formas móviles de menor a mayor traste.
  const barres: { fret: number; d: Diagram }[] = []
  if (q === '' || q === 'm') {
    const r = NOTES.indexOf(root), eF = (r - 4 + 12) % 12, aF = (r - 9 + 12) % 12
    const src = 'Forma de cejilla desplazada'
    if (eF) {
      const b = q === '' ? [0, 2, 2, 1, 0, 0] : [0, 2, 2, 0, 0, 0]
      barres.push({ fret: eF, d: diagram(chord, `Cejilla (forma de Mi, traste ${eF})`, b.map((x) => eF + x), q === '' ? [1, 3, 4, 2, 1, 1] : [1, 3, 4, 1, 1, 1], { fret: eF, from_string: 0, to_string: 5 }, src) })
    }
    if (aF) {
      const b = q === '' ? [0, 2, 2, 2, 0] : [0, 2, 2, 1, 0]
      barres.push({ fret: aF, d: diagram(chord, `Cejilla (forma de La, traste ${aF})`, [-1, ...b.map((x) => aF + x)], q === '' ? [0, 1, 3, 3, 3, 1] : [0, 1, 3, 4, 2, 1], { fret: aF, from_string: 1, to_string: 5 }, src) })
    }
  }
  barres.sort((a, b) => a.fret - b.fret)
  out.push(...barres.map((x) => x.d))
  if (chord === 'F') out.splice(out.length - barres.length + 1, 0, diagram('F', 'Simplificado', [-1, -1, 3, 2, 1, 1], [0, 0, 3, 2, 1, 1], { fret: 1, from_string: 4, to_string: 5 }))
  const r = NOTES.indexOf(root), moves: { fret: number; d: Diagram }[] = []
  for (const sh of SHAPES.filter((x) => x.q === q)) {
    let f = (r - (sh.on === 6 ? 4 : 9) + 12) % 12
    if (f < (sh.minFret ?? 1)) f += 12 // traste 0 = forma abierta (ya cubierta o no aplicable): se usa la octava
    const real = sh.off.map((o) => (o === null ? -1 : f + o))
    const barre = sh.barre ? { fret: f + sh.barre[0], from_string: sh.barre[1], to_string: sh.barre[2] } : null
    moves.push({ fret: f, d: diagram(chord, `Forma móvil (raíz en la ${sh.on}ª, traste ${f})`, real, sh.fingers, barre, 'Forma móvil comprobada por notas') })
  }
  moves.sort((a, b) => a.fret - b.fret)
  out.push(...moves.map((x) => x.d))
  return out
}

/** Posiciones ordenadas para mostrar: con `easyOnly`, primero las abiertas o simplificadas (sin cejilla completa). */
export function diagramsFor(name: string, easyOnly: boolean): Diagram[] {
  const ds = getDiagrams(name)
  if (!easyOnly) return ds
  const easy = ds.filter((d) => !d.barre || d.label === 'Simplificado')
  return [...easy, ...ds.filter((d) => !easy.includes(d))]
}

/** Posiciones de guitarra. frets/fingers van de la 6ª cuerda (Mi grave) a la 1ª; -1 = no tocar, 0 = al aire. */
import type { Barre, Diagram } from './types.ts'

export const TUNING = [4, 9, 2, 7, 11, 4] // E A D G B E (clases de altura)
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' }
const SUFFIX = 'maj7|m7|sus2|sus4|dim|aug|m|7'
const TONES: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], aug: [0, 4, 8] }

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
  const m = new RegExp(`^([A-G][#b]?)(${SUFFIX})?$`).exec(name ?? '')
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

export function getDiagrams(name: string): Diagram[] {
  const n = normalize(name)
  if (!n) return []
  const [root, q] = n
  const chord = root + q, out: Diagram[] = []
  if (OPEN[chord]) out.push(diagram(chord, 'Abierto', OPEN[chord][0], OPEN[chord][1]))
  if (chord === 'F') out.push(diagram('F', 'Simplificado', [-1, -1, 3, 2, 1, 1], [0, 0, 3, 2, 1, 1], { fret: 1, from_string: 4, to_string: 5 }))
  if (q === '' || q === 'm') {
    const r = NOTES.indexOf(root), eF = (r - 4 + 12) % 12, aF = (r - 9 + 12) % 12
    const src = 'Forma de cejilla desplazada'
    if (eF) {
      const b = q === '' ? [0, 2, 2, 1, 0, 0] : [0, 2, 2, 0, 0, 0]
      out.push(diagram(chord, `Cejilla (forma de Mi, traste ${eF})`, b.map((x) => eF + x), q === '' ? [1, 3, 4, 2, 1, 1] : [1, 3, 4, 1, 1, 1], { fret: eF, from_string: 0, to_string: 5 }, src))
    }
    if (aF) {
      const b = q === '' ? [0, 2, 2, 2, 0] : [0, 2, 2, 1, 0]
      out.push(diagram(chord, `Cejilla (forma de La, traste ${aF})`, [-1, ...b.map((x) => aF + x)], q === '' ? [0, 1, 3, 3, 3, 1] : [0, 1, 3, 4, 2, 1], { fret: aF, from_string: 1, to_string: 5 }, src))
    }
  }
  return out
}

/** Posiciones ordenadas para mostrar: con `easyOnly`, primero las abiertas o simplificadas (sin cejilla completa). */
export function diagramsFor(name: string, easyOnly: boolean): Diagram[] {
  const ds = getDiagrams(name)
  if (!easyOnly) return ds
  const easy = ds.filter((d) => !d.barre || d.label === 'Simplificado')
  return [...easy, ...ds.filter((d) => !easy.includes(d))]
}

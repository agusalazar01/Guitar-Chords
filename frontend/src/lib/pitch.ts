/** Afinador: detección de la altura (frecuencia fundamental) con el método YIN y nota más cercana en cifrado americano. */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
/** Cuerdas al aire de la guitarra en afinación estándar (número MIDI): E2 A2 D3 G3 B3 E4. */
export const GUITAR_STRINGS = [40, 45, 50, 55, 59, 64]

/** Frecuencia fundamental (Hz) de un trozo de audio, o null si no hay una nota clara (silencio, ruido, varias notas).
 *  Rango pensado para guitarra y voz: ~60 a 1200 Hz. */
export function detectPitch(buf: Float32Array, sampleRate: number, minHz = 60, maxHz = 1200): number | null {
  const n = buf.length
  let rms = 0
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / n)
  if (rms < 0.01) return null // silencio
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz)), tauMax = Math.min(Math.floor(n / 2), Math.ceil(sampleRate / minHz))
  if (tauMax <= tauMin + 2) return null
  const w = n - tauMax
  const d = new Float32Array(tauMax + 1)
  for (let tau = 1; tau <= tauMax; tau++) { // diferencia entre la señal y la misma corrida tau muestras
    let s = 0
    for (let i = 0; i < w; i++) { const x = buf[i] - buf[i + tau]; s += x * x }
    d[tau] = s
  }
  // diferencia normalizada acumulada (YIN) y primer mínimo por debajo del umbral
  const cm = new Float32Array(tauMax + 1); cm[0] = 1
  let run = 0
  for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; cm[tau] = run > 0 ? (d[tau] * tau) / run : 1 }
  let tau = -1
  for (let t = tauMin; t <= tauMax; t++) {
    if (cm[t] < 0.15) { while (t + 1 <= tauMax && cm[t + 1] < cm[t]) t++; tau = t; break }
  }
  if (tau < 0) return null
  // interpolación parabólica para afinar entre muestras
  const a = cm[tau - 1] ?? cm[tau], b = cm[tau], c = cm[tau + 1] ?? cm[tau]
  const den = a - 2 * b + c
  const shift = den !== 0 ? (0.5 * (a - c)) / den : 0
  const f = sampleRate / (tau + (Math.abs(shift) < 1 ? shift : 0))
  return f >= minHz && f <= maxHz ? f : null
}

/** Nota más cercana a una frecuencia, con La de referencia `a4` (440 Hz por defecto): nombre americano (A, C#…), octava,
 *  desvío en cents (−50 a +50; negativo = baja, hay que tensar) y la frecuencia exacta de esa nota. */
export function noteOf(freq: number, a4 = 440) {
  const m = 69 + 12 * Math.log2(freq / a4)
  const midi = Math.round(m)
  return { name: NOTE_NAMES[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1, midi, cents: (m - midi) * 100, target: a4 * 2 ** ((midi - 69) / 12) }
}

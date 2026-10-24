/** Metrónomo con Web Audio: los golpes se programan con anticipación en el reloj de audio (no dependen de la pantalla), así
 *  sigue sonando parejo mientras se usa el resto de la app. Dos modos: libre (bpm) o siguiendo los golpes de la canción. */

export type ClickSound = 'clic' | 'madera' | 'pitido'
export const SOUNDS: Record<ClickSound, string> = { clic: 'Clic', madera: 'Madera', pitido: 'Pitido' }

/** Pulso de una lista de golpes (segundos): mediana de los intervalos, en golpes por minuto. null si no alcanza. */
export function bpmFromBeats(beats: number[]): number | null {
  if (beats.length < 4) return null
  const d = beats.slice(1).map((b, i) => b - beats[i]).filter((x) => x > 0.2 && x < 2).sort((a, b) => a - b)
  if (d.length < 3) return null
  return Math.round(60 / d[d.length >> 1])
}

/** Golpes de la canción que caen en (t0, t1] (tiempo de la canción), con su número dentro del compás (0 = «uno»). */
export function beatsBetween(beats: number[], t0: number, t1: number, downbeat: number, bpb: number): { t: number; k: number }[] {
  const out: { t: number; k: number }[] = []
  let lo = 0, hi = beats.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (beats[m] <= t0) lo = m + 1; else hi = m }
  for (let i = lo; i < beats.length && beats[i] <= t1; i++) out.push({ t: beats[i], k: ((((i - downbeat) % bpb) + bpb) % bpb) })
  return out
}

export interface FollowSource { time: () => number; playing: () => boolean; rate: () => number; beats: number[]; downbeat: number }

export class Metronome {
  bpm = 100; bpb = 4; mid = 3; sound: ClickSound = 'clic'; volume = 0.8
  follow: FollowSource | null = null // si está, los golpes salen de la canción (cuando suena) en vez del bpm
  onBeat: ((k: number) => void) | null = null
  running = false
  private ctx: AudioContext | null = null
  private timer = 0
  private next = 0 // próximo golpe (reloj de audio) en modo libre
  private k = 0 // número de golpe dentro del compás
  private lastSong = -1 // último golpe de la canción ya programado

  start() {
    this.ctx ??= new AudioContext()
    void this.ctx.resume()
    this.running = true; this.k = 0; this.next = this.ctx.currentTime + 0.08; this.lastSong = -1
    clearInterval(this.timer)
    this.timer = window.setInterval(() => this.tick(), 25)
  }
  stop() { this.running = false; clearInterval(this.timer) }

  private tick() {
    const ctx = this.ctx!, now = ctx.currentTime, ahead = 0.12
    const f = this.follow
    if (f && f.playing() && f.beats.length > 1) {
      const t = f.time(), r = f.rate() || 1
      const from = Math.max(t, this.lastSong)
      for (const b of beatsBetween(f.beats, from, t + ahead * r, f.downbeat, this.bpb)) {
        this.click(now + (b.t - t) / r, b.k); this.lastSong = b.t
      }
      this.next = now + 0.05
      return
    }
    if (f && !f.playing()) { this.lastSong = -1 }
    while (this.next < now + ahead) {
      this.click(this.next, this.k)
      this.next += 60 / Math.max(20, Math.min(300, this.bpm)); this.k = (this.k + 1) % this.bpb
    }
  }

  private click(at: number, k: number) {
    const ctx = this.ctx!
    const strong = k === 0, half = !strong && this.mid > 0 && k === this.mid - 1
    const o = ctx.createOscillator(), g = ctx.createGain()
    const [type, hi, lo, len] = this.sound === 'madera' ? ['triangle', 1250, 850, 0.05] as const : this.sound === 'pitido' ? ['sine', 1320, 880, 0.09] as const : ['square', 2200, 1500, 0.03] as const
    o.type = type; o.frequency.value = strong ? hi : half ? (hi + lo) / 2 : lo
    const v = this.volume * (strong ? 1 : half ? 0.75 : 0.55) * (type === 'square' ? 0.35 : 1)
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), at + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, at + len)
    o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + len + 0.02)
    const cb = this.onBeat
    if (cb) window.setTimeout(() => cb(k), Math.max(0, (at - ctx.currentTime) * 1000))
  }
}

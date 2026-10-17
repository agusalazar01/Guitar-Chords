/** FFT radix-2 iterativa in situ (sin dependencias). */
export class FFT {
  n: number
  private cosT: Float64Array
  private sinT: Float64Array
  private rev: Uint32Array

  constructor(n: number) {
    if (n < 2 || (n & (n - 1)) !== 0) throw new Error('El tamaño de la FFT debe ser potencia de 2.')
    this.n = n
    this.cosT = new Float64Array(n / 2)
    this.sinT = new Float64Array(n / 2)
    for (let i = 0; i < n / 2; i++) { this.cosT[i] = Math.cos((2 * Math.PI * i) / n); this.sinT[i] = -Math.sin((2 * Math.PI * i) / n) }
    this.rev = new Uint32Array(n)
    const bits = Math.log2(n)
    for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b); this.rev[i] = r }
  }

  transform(re: Float64Array, im: Float64Array): void {
    const n = this.n
    for (let i = 0; i < n; i++) {
      const j = this.rev[i]
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size
      for (let start = 0; start < n; start += size) {
        for (let k = 0, t = 0; k < half; k++, t += step) {
          const a = start + k, b = a + half
          const xr = re[b] * this.cosT[t] - im[b] * this.sinT[t]
          const xi = re[b] * this.sinT[t] + im[b] * this.cosT[t]
          re[b] = re[a] - xr; im[b] = im[a] - xi
          re[a] += xr; im[a] += xi
        }
      }
    }
  }
}

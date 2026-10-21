/** Artista y título escritos dentro del MP3 (etiquetas ID3v2 al principio o ID3v1 al final), para buscar la letra aunque el
 *  archivo tenga un nombre cualquiera. */
export interface AudioTags { artist?: string; title?: string }

function text(b: Uint8Array, enc: number): string {
  const strip = (s: string) => s.replace(/\0+$/g, '').replace(/\0/g, ' ').trim()
  try {
    if (enc === 0) return strip(new TextDecoder('latin1').decode(b))
    if (enc === 3) return strip(new TextDecoder('utf-8').decode(b))
    if (enc === 1) { // UTF-16 con marca de orden
      const le = b[0] === 0xff && b[1] === 0xfe, be = b[0] === 0xfe && b[1] === 0xff
      return strip(new TextDecoder(be ? 'utf-16be' : 'utf-16le').decode(le || be ? b.subarray(2) : b))
    }
    if (enc === 2) return strip(new TextDecoder('utf-16be').decode(b))
  } catch { /* codificación rara: se ignora */ }
  return ''
}

/** head: los primeros bytes del archivo (con 256 KB alcanza casi siempre); tail: los últimos 128 bytes (ID3v1). */
export function readId3(head: Uint8Array, tail?: Uint8Array): AudioTags {
  const out: AudioTags = {}
  if (head.length > 10 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) { // «ID3»
    const ver = head[3]
    const size = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f)
    const end = Math.min(head.length, 10 + size)
    let p = 10
    if (head[5] & 0x40 && ver >= 3) { // encabezado extendido
      const ext = ver === 4 ? ((head[10] & 0x7f) << 21) | ((head[11] & 0x7f) << 14) | ((head[12] & 0x7f) << 7) | (head[13] & 0x7f) : ((head[10] << 24) | (head[11] << 16) | (head[12] << 8) | head[13]) + 4
      p += ext
    }
    const idLen = ver === 2 ? 3 : 4, hdr = ver === 2 ? 6 : 10
    while (p + hdr <= end) {
      const id = String.fromCharCode(...head.subarray(p, p + idLen))
      if (!/^[A-Z0-9]+$/.test(id)) break
      const sz = ver === 2 ? (head[p + 3] << 16) | (head[p + 4] << 8) | head[p + 5]
        : ver === 4 ? ((head[p + 4] & 0x7f) << 21) | ((head[p + 5] & 0x7f) << 14) | ((head[p + 6] & 0x7f) << 7) | (head[p + 7] & 0x7f)
        : (head[p + 4] << 24) | (head[p + 5] << 16) | (head[p + 6] << 8) | head[p + 7]
      const body = head.subarray(p + hdr, Math.min(end, p + hdr + sz))
      if (sz <= 0) break
      if ((id === 'TIT2' || id === 'TT2') && !out.title) out.title = text(body.subarray(1), body[0]) || undefined
      if ((id === 'TPE1' || id === 'TP1') && !out.artist) out.artist = text(body.subarray(1), body[0]) || undefined
      p += hdr + sz
    }
  }
  if ((!out.title || !out.artist) && tail && tail.length >= 128) {
    const t = tail.subarray(tail.length - 128)
    if (t[0] === 0x54 && t[1] === 0x41 && t[2] === 0x47) { // «TAG»
      out.title ||= text(t.subarray(3, 33), 0) || undefined
      out.artist ||= text(t.subarray(33, 63), 0) || undefined
    }
  }
  return out
}

export const MAX_BYTES = 40 * 1024 * 1024
export const MAX_SECONDS = 15 * 60

export function validateAudioFile(name: string, size: number, head: Uint8Array): '.mp3' | '.wav' {
  const m = /\.([A-Za-z0-9]+)$/.exec(name)
  const ext = m ? '.' + m[1].toLowerCase() : ''
  if (ext !== '.mp3' && ext !== '.wav') throw new Error('Formato no admitido. Usá un archivo MP3 o WAV.')
  if (size <= 0) throw new Error('El archivo está vacío.')
  if (size > MAX_BYTES) throw new Error(`El archivo supera el máximo de ${MAX_BYTES / 1024 / 1024} MB.`)
  const ascii = (a: number, b: number) => String.fromCharCode(...head.slice(a, b))
  const ok = ext === '.wav' ? ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE'
    : ascii(0, 3) === 'ID3' || (head.length > 1 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0)
  if (!ok) throw new Error('El contenido del archivo no coincide con un MP3 o WAV válido.')
  return ext
}

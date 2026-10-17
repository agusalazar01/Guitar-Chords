import { MAX_SECONDS } from './audioFile.ts'

/** Decodifica MP3/WAV en el dispositivo (Web Audio) a mono 22,05 kHz. El audio no sale del teléfono. */
export async function decodeToMono(file: Blob, targetRate = 22050): Promise<{ samples: Float32Array; sampleRate: number; duration: number }> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx({ sampleRate: targetRate })
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer())
    if (buf.duration > MAX_SECONDS) throw new Error(`La canción dura más de ${MAX_SECONDS / 60} minutos; es demasiado larga para analizarla en el teléfono.`)
    const out = new Float32Array(buf.length)
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const ch = buf.getChannelData(c)
      for (let i = 0; i < out.length; i++) out[i] += ch[i] / buf.numberOfChannels
    }
    return { samples: out, sampleRate: buf.sampleRate, duration: buf.duration }
  } catch (e) {
    if (e instanceof DOMException) throw new Error('No se pudo decodificar el audio. El archivo puede estar dañado.')
    throw e
  } finally { void ctx.close() }
}

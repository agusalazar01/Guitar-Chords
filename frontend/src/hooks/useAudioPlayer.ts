import { useCallback, useEffect, useRef, useState } from 'react'

/** Reproductor del archivo de audio local. Mismo contrato que useYouTubePlayer. */
export function useAudioPlayer(url: string | null) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const rate = useRef(1)
  const volume = useRef(1)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!url) return
    setError(null); setTime(0); setDuration(0); setPlaying(false)
    const a = new Audio(url)
    a.preload = 'auto'
    a.playbackRate = rate.current
    a.volume = volume.current
    ;(a as unknown as { preservesPitch: boolean }).preservesPitch = true // velocidad lenta sin cambiar el tono
    a.onloadedmetadata = () => setDuration(a.duration)
    a.onplay = () => setPlaying(true)
    a.onpause = () => setPlaying(false)
    a.onended = () => setPlaying(false)
    a.onerror = () => setError('Este navegador no pudo reproducir el archivo de audio.')
    ref.current = a
    // Se lee la posición en cada cuadro de pantalla (~16 ms) en lugar de cada 100 ms: el acorde cambia sin esperar al siguiente sondeo.
    let raf = 0
    const tick = () => { setTime((p) => (Math.abs(p - a.currentTime) > 0.04 ? a.currentTime : p)); raf = requestAnimationFrame(tick) } // ≤ 25 renders por segundo
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); a.pause(); a.removeAttribute('src'); a.load(); ref.current = null }
  }, [url])

  const seek = useCallback((t: number) => {
    const a = ref.current
    if (!a) return
    const c = Math.max(0, a.duration ? Math.min(t, a.duration) : t)
    a.currentTime = c; setTime(c)
  }, [])

  return {
    time, duration, playing, error, seek,
    play: () => { ref.current?.play().catch(() => setError('No se pudo iniciar la reproducción.')) },
    pause: () => ref.current?.pause(),
    skip: (d: number) => seek((ref.current?.currentTime ?? 0) + d),
    setVolume: (v: number) => { volume.current = v / 100; if (ref.current) ref.current.volume = v / 100 },
    setRate: (r: number) => { rate.current = r; if (ref.current) ref.current.playbackRate = r },
  }
}

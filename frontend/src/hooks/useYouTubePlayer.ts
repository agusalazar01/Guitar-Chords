import { useCallback, useEffect, useRef, useState } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void } }

let apiPromise: Promise<void> | null = null
function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      window.onYouTubeIframeAPIReady = () => resolve()
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(s)
    })
  }
  return apiPromise
}

const ERRORS: Record<number, string> = {
  2: 'El identificador del video no es válido.',
  5: 'El reproductor de YouTube no pudo cargar este video.',
  100: 'El video no existe o es privado.',
  101: 'El dueño del video no permite reproducirlo fuera de YouTube. Elegí otro resultado.',
  150: 'El dueño del video no permite reproducirlo fuera de YouTube. Elegí otro resultado.',
}

export function useYouTubePlayer(videoId: string | null) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!videoId) return
    let cancelled = false
    setError(null); setTime(0); setDuration(0); setPlaying(false)
    loadApi().then(() => {
      if (cancelled || !hostRef.current) return
      const el = document.createElement('div')
      hostRef.current.replaceChildren(el)
      playerRef.current = new window.YT.Player(el, {
        videoId, width: '100%', height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e: any) => setDuration(e.target.getDuration()),
          onStateChange: (e: any) => {
            setPlaying(e.data === 1)
            if (e.data === 1 || e.data === 5) setDuration(e.target.getDuration())
          },
          onError: (e: any) => setError(ERRORS[e.data] ?? 'No se pudo reproducir este video.'),
        },
      })
    })
    // El tiempo SIEMPRE se lee del reproductor (no hay temporizador propio que avance acordes).
    const poll = setInterval(() => {
      const p = playerRef.current
      if (p?.getCurrentTime) { const t = p.getCurrentTime(); setTime((prev) => (Math.abs(prev - t) > 0.01 ? t : prev)) }
    }, 100)
    return () => { cancelled = true; clearInterval(poll); playerRef.current?.destroy?.(); playerRef.current = null }
  }, [videoId])

  const seek = useCallback((t: number) => {
    const p = playerRef.current
    if (!p?.seekTo) return
    const clamped = Math.max(0, duration ? Math.min(t, duration) : t)
    p.seekTo(clamped, true); setTime(clamped)
  }, [duration])

  return {
    hostRef, time, duration, playing, error, seek,
    play: () => playerRef.current?.playVideo?.(),
    pause: () => playerRef.current?.pauseVideo?.(),
    skip: (d: number) => seek((playerRef.current?.getCurrentTime?.() ?? time) + d),
    setVolume: (v: number) => playerRef.current?.setVolume?.(v),
    setRate: (r: number) => playerRef.current?.setPlaybackRate?.(r),
  }
}

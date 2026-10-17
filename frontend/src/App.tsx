import { useEffect, useMemo, useRef, useState } from 'react'
import Controls from './components/Controls.tsx'
import DiagramView from './components/Diagram.tsx'
import { AudioPanel, HistoryPanel, SearchPanel } from './components/Panels.tsx'
import type { Job } from './components/Panels.tsx'
import Timeline from './components/Timeline.tsx'
import { useAudioPlayer } from './hooks/useAudioPlayer.ts'
import { useYouTubePlayer } from './hooks/useYouTubePlayer.ts'
import { findActiveIndex, loopTarget, transposeChord, transposeSegments } from './lib/chords.ts'
import { DEMO_SEGMENTS } from './lib/demo.ts'
import { moveEnd, moveStart, removeAt, setChordAt, splitAt } from './lib/segments.ts'
import { getDiagrams } from './lib/chordLibrary.ts'
import { validateAudioFile } from './lib/audioFile.ts'
import { decodeToMono } from './lib/decodeAudio.ts'
import { CANCELLED, startAnalysis } from './lib/engine/runWorker.ts'
import { deleteSong, listSongs, requestPersistence, saveSong } from './lib/songs.ts'
import type { Song } from './lib/songs.ts'
import type { Segment } from './lib/types.ts'

type Source = 'none' | 'demo' | 'analysis'
const YT_RATES = [0.5, 0.75, 1, 1.25]
const AUDIO_RATES = [0.5, 0.6, 0.75, 0.9, 1, 1.25]
const CHORD_OK = /^(N|[A-G][#b]?(m|7)?)$/
const store = {
  get: <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? '') as T } catch { return d } },
  set: (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ } },
}

export default function App() {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioName, setAudioName] = useState('')
  const [mode, setMode] = useState<'youtube' | 'audio'>('youtube')
  const yt = useYouTubePlayer(videoId)
  const au = useAudioPlayer(audioUrl)
  const player = mode === 'audio' ? au : yt

  const [base, setBase] = useState<Segment[]>([])
  const [undo, setUndo] = useState<Segment[][]>([])
  const [source, setSource] = useState<Source>('none')
  const [song, setSong] = useState<Song | null>(null)
  const songRef = useRef<Song | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [job, setJob] = useState<Job | null>(null)
  const [jobErr, setJobErr] = useState<string | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const [ytKey, setYtKey] = useState(() => store.get('ytKey', ''))
  const [transpose, setTranspose] = useState(0)
  const [offset, setOffset] = useState(0)
  const [hideNames, setHideNames] = useState(false)
  const [loop, setLoop] = useState<{ start: number; end: number } | null>(null)
  const [rate, setRate] = useState(1)
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const [pos, setPos] = useState(0)
  const [dark, setDark] = useState(() => store.get('dark', window.matchMedia('(prefers-color-scheme: dark)').matches))
  const [settings, setSettings] = useState(false)
  const [easyOnly, setEasyOnly] = useState(() => store.get('easyOnly', false))
  const [recent, setRecent] = useState(() => store.get<{ id: string; title: string }[]>('recent', []))
  const [notice, setNotice] = useState<string | null>(null)
  const [installEvt, setInstallEvt] = useState<Event & { prompt?: () => Promise<void> } | null>(null)

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; store.set('dark', dark) }, [dark])
  useEffect(() => store.set('easyOnly', easyOnly), [easyOnly])
  useEffect(() => store.set('ytKey', ytKey), [ytKey])
  const original = song?.original ?? null
  const refreshSongs = () => listSongs().then(setSongs).catch((e: Error) => setNotice(e.message))
  useEffect(() => { void refreshSongs(); void requestPersistence() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  function persist(patch: Partial<Song>) {
    const cur = songRef.current
    if (!cur) return
    const next = { ...cur, ...patch }
    songRef.current = next; setSong(next)
    saveSong(next).then(refreshSongs).catch((e: Error) => setNotice(e.message))
  }
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])
  useEffect(() => { (mode === 'audio' ? yt : au).pause() }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // El desfase solo tiene sentido cuando los acordes de un archivo se muestran sobre un video.
  const eo = mode === 'youtube' && source === 'analysis' ? offset : 0
  const segments = useMemo(() => transposeSegments(base, transpose), [base, transpose])
  const activeIndex = findActiveIndex(segments, player.time, eo)
  const shownIdx = activeIndex >= 0 ? activeIndex : focusIdx !== null && focusIdx < segments.length ? focusIdx : null
  const seg = shownIdx !== null ? segments[shownIdx] : null
  const chordName = seg ? seg.chord : null
  const nextSeg = shownIdx !== null ? segments[shownIdx + 1] : undefined

  useEffect(() => { // bucle: se decide con el tiempo real del reproductor
    const t = loopTarget(player.time, loop)
    if (t !== null && player.playing) player.seek(t)
  }, [player.time, loop, player.playing]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { // guardar transposición, desfase y video asociado en el teléfono
    if (!songRef.current) return
    const t = setTimeout(() => persist({ settings: { videoId, transpose, offset } }), 600)
    return () => clearTimeout(t)
  }, [song?.id, transpose, offset, videoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const diagrams = useMemo(() => (chordName && chordName !== 'N' ? getDiagrams(chordName) : null), [chordName])
  useEffect(() => setPos(0), [chordName])
  const diagErr = chordName && chordName !== 'N' && diagrams && !diagrams.length ? `No se encontró una posición verificada para ${chordName}.` : null

  const shownDiagrams = useMemo(() => {
    if (!diagrams) return null
    const easy = diagrams.filter((d) => !d.barre || d.label === 'Simplificado')
    return easyOnly && easy.length ? easy : diagrams
  }, [diagrams, easyOnly])

  function commit(next: Segment[]) {
    setUndo((u) => [...u.slice(-19), base]); setBase(next); setNotice(null)
    persist({ corrections: next })
  }
  function undoLast() {
    const prev = undo[undo.length - 1]
    if (!prev) return
    setUndo((u) => u.slice(0, -1)); setBase(prev); persist({ corrections: prev })
  }
  function restore() {
    if (!original) return
    setUndo((u) => [...u.slice(-19), base]); setBase(original); persist({ corrections: null })
  }
  function pickVideo(v: { id: string; title?: string }) {
    setVideoId(v.id); setFocusIdx(null); setLoop(null); setRate(1)
    if (!audioUrl || !songRef.current) setMode('youtube')
    if (source === 'demo') { setBase([]); setSource('none') }
    if (v.title) {
      const next = [{ id: v.id, title: v.title }, ...recent.filter((r) => r.id !== v.id)].slice(0, 6)
      setRecent(next); store.set('recent', next)
    }
  }
  function showAudio(blob: Blob, name: string) {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(URL.createObjectURL(blob)); setAudioName(name); setMode('audio'); setLoop(null)
  }
  async function pickFile(f: File) {
    setNotice(null); setJobErr(null)
    try { validateAudioFile(f.name, f.size, new Uint8Array(await f.slice(0, 12).arrayBuffer())) } catch (e) { setJobErr((e as Error).message); return }
    showAudio(f, f.name)
    setJob({ filename: f.name, stage: 'decoding', progress: 0 })
    try {
      const dec = await decodeToMono(f)
      setJob({ filename: f.name, stage: 'analyzing', progress: 0 })
      const run = startAnalysis(dec.samples, dec.sampleRate, (p) => setJob((j) => (j ? { ...j, progress: p } : j)))
      cancelRef.current = run.cancel
      const out = await run.promise
      const conf = out.segments.map((x) => x.confidence).filter((c): c is number => c !== null)
      const s: Song = {
        id: crypto.randomUUID(), filename: f.name, createdAt: Date.now(), duration: out.duration, method: out.method,
        lowConfidence: conf.length > 0 && conf.reduce((a, b) => a + b, 0) / conf.length < 0.6,
        original: out.segments, corrections: null, settings: { videoId, transpose: 0, offset: 0 }, audio: f,
      }
      songRef.current = s; setSong(s)
      setBase(s.original); setUndo([]); setSource('analysis'); setTranspose(0); setOffset(0); setFocusIdx(null)
      await saveSong(s); void refreshSongs()
    } catch (e) {
      const m = (e as Error).message
      if (m === CANCELLED) setNotice('Análisis cancelado.'); else setJobErr(m)
    } finally { cancelRef.current = null; setJob(null) }
  }
  function openSong(s: Song) {
    songRef.current = s; setSong(s); showAudio(s.audio, s.filename)
    setBase(s.corrections ?? s.original); setUndo([]); setSource('analysis'); setFocusIdx(null)
    setTranspose(s.settings.transpose); setOffset(s.settings.offset)
    if (s.settings.videoId) setVideoId(s.settings.videoId)
    setNotice(null)
  }
  async function removeSong(s: Song) {
    if (!window.confirm(`¿Borrar «${s.filename}», sus acordes y el audio guardado en este teléfono?`)) return
    try {
      await deleteSong(s.id)
      if (songRef.current?.id === s.id) { songRef.current = null; setSong(null); setBase([]); setSource('none') }
      void refreshSongs()
    } catch (e) { setNotice((e as Error).message) }
  }
  function selectChord(i: number) { setFocusIdx(i); player.seek(segments[i].start + eo); player.play() }
  const fileNow = () => Math.max(0, player.time - eo)

  function applyChord(raw: string) {
    if (shownIdx === null) return
    const name = raw.trim()
    if (!CHORD_OK.test(name)) { setNotice(`«${name}» no es un acorde admitido (mayor, menor, séptima o N).`); return }
    commit(setChordAt(base, shownIdx, name === 'N' ? 'N' : transposeChord(name, -transpose)))
  }
  const num = (v: string, f: (t: number) => Segment[]) => { const t = Number(v.replace(',', '.')); if (Number.isFinite(t)) commit(f(t)) }

  const d = shownDiagrams?.[pos % (shownDiagrams.length || 1)]
  const sec = 'rounded-2xl border border-line bg-panel p-4'
  const small = 'min-h-10 px-3 rounded-lg border border-line text-sm'
  return (
    <div className="min-h-screen pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold">Guitar Chords</h1>
          <div className="flex gap-2">
            {installEvt && <button className={small} onClick={() => installEvt.prompt?.()}>Instalar</button>}
            <button onClick={() => setSettings((s) => !s)} className={small} aria-expanded={settings}>Ajustes</button>
          </div>
        </div>
        {settings && (
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Tema oscuro</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={easyOnly} onChange={(e) => setEasyOnly(e.target.checked)} /> Priorizar posiciones sin cejilla completa</label>
            <label className="w-full">Clave propia de YouTube Data API v3 (opcional, solo para buscar; se guarda solo en este teléfono)
              <input value={ytKey} onChange={(e) => setYtKey(e.target.value.trim())} autoComplete="off" className="mt-1 w-full min-h-11 rounded-lg border border-line bg-panel px-3" /></label>
          </div>
        )}
        <SearchPanel onPick={pickVideo} recent={recent} apiKey={ytKey} />
      </header>

      <main className="mx-auto max-w-6xl p-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4 min-w-0">
          {(videoId || audioUrl) ? (
            <section className={sec}>
              {videoId && audioUrl && (
                <div className="mb-3 flex gap-2 text-sm" role="group" aria-label="Fuente de reproducción">
                  <button className={`${small} ${mode === 'audio' ? 'bg-accent text-accent-fg' : ''}`} onClick={() => setMode('audio')}>Mi archivo</button>
                  <button className={`${small} ${mode === 'youtube' ? 'bg-accent text-accent-fg' : ''}`} onClick={() => setMode('youtube')}>Video de YouTube</button>
                </div>
              )}
              <div className={`aspect-video w-full overflow-hidden rounded-lg bg-black ${mode === 'audio' || !videoId ? 'hidden' : ''}`} ref={yt.hostRef} />
              {mode === 'audio' && audioUrl && <div className="rounded-lg bg-bg p-4 text-center"><p className="font-semibold truncate">{audioName}</p><p className="text-sm text-mute">Reproducción local del archivo</p></div>}
              {player.error && <p role="alert" className="mt-2 text-red-500">{player.error}{mode === 'youtube' && videoId && <> <a className="underline" href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer">Abrir en YouTube</a></>}</p>}
              <div className="mt-4">
                <Controls time={player.time} duration={player.duration} playing={player.playing}
                  onPlay={player.play} onPause={player.pause} onSeek={player.seek} onSkip={player.skip}
                  onVolume={player.setVolume} rate={rate} rates={mode === 'audio' ? AUDIO_RATES : YT_RATES}
                  onRate={(r) => { setRate(r); player.setRate(r) }}
                  loop={loop} onLoopStart={() => setLoop({ start: player.time, end: loop?.end ?? player.time })}
                  onLoopEnd={() => setLoop({ start: loop?.start ?? 0, end: player.time })} onLoopClear={() => setLoop(null)}
                  onLoopRestart={() => loop && player.seek(loop.start)} />
              </div>
            </section>
          ) : (
            <section className={sec}><h2 className="text-lg font-semibold">Empezá con una canción</h2>
              <p className="text-mute">Buscá en YouTube o pegá un enlace arriba. También podés elegir un MP3 o WAV propio para analizarlo y escucharlo acá.</p></section>
          )}

          <section className={sec} aria-live="polite">
            {source === 'demo' && <p className="mb-2 rounded bg-accent/20 p-2 text-sm font-semibold">DEMOSTRACIÓN: estos acordes son de ejemplo y no corresponden al video ni a un análisis real.</p>}
            {source === 'analysis' && song && (
              <p className="mb-2 text-sm text-mute">Acordes de «{song.filename}» ({song.method}).
                {mode === 'youtube' && ' Si el video es otra versión, con cortes o tempos distintos, habrá desincronización: ajustá el desfase.'}
                {song.lowConfidence && ' Confianza media baja: revisá los acordes marcados como dudosos.'}</p>
            )}
            {notice && <p role="alert" className="mb-2 text-sm text-red-500">{notice}</p>}
            {segments.length ? (
              <>
                <Timeline segments={segments} activeIndex={activeIndex} time={player.time} offset={eo} hideNames={hideNames} onSelect={selectChord} />
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-2">Transponer
                    <button className="min-h-10 min-w-10 rounded border border-line" onClick={() => setTranspose((t) => Math.max(-11, t - 1))} aria-label="Bajar un semitono">−</button>
                    <b className="w-8 text-center tabular-nums">{transpose > 0 ? `+${transpose}` : transpose}</b>
                    <button className="min-h-10 min-w-10 rounded border border-line" onClick={() => setTranspose((t) => Math.min(11, t + 1))} aria-label="Subir un semitono">+</button>
                  </span>
                  {mode === 'youtube' && source === 'analysis' && (
                    <span className="flex items-center gap-2">Desfase
                      <button className="min-h-10 px-2 rounded border border-line" onClick={() => setOffset((o) => Math.round((o - 0.1) * 10) / 10)}>−0,1 s</button>
                      <b className="w-14 text-center tabular-nums">{offset.toFixed(1)} s</b>
                      <button className="min-h-10 px-2 rounded border border-line" onClick={() => setOffset((o) => Math.round((o + 0.1) * 10) / 10)}>+0,1 s</button>
                    </span>)}
                  <label className="flex items-center gap-2"><input type="checkbox" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} /> Ocultar nombres</label>
                </div>
                <p className="mt-2 text-xs text-mute">La transposición solo cambia nombres y diagramas, no el audio.</p>
              </>
            ) : (
              <div><h2 className="font-semibold">Todavía no hay acordes</h2>
                <p className="text-mute text-sm">No se inventan resultados: elegí un MP3 o WAV de la canción para analizarlo, o abrí una canción guardada. Si querés ver cómo funciona la interfaz, usá la demostración.</p>
                {(videoId || audioUrl) && <button className={`mt-2 ${small}`} onClick={() => { setBase(DEMO_SEGMENTS); setSource('demo'); songRef.current = null; setSong(null); setUndo([]) }}>Ver secuencia de demostración</button>}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4 min-w-0">
          <section className={sec}>
            <p className="text-5xl font-extrabold leading-tight">{hideNames && chordName ? '?' : chordName && chordName !== 'N' ? chordName : chordName === 'N' ? '—' : 'Acorde'}</p>
            {nextSeg && <p className="text-sm text-mute">Siguiente: <b className="text-next">{hideNames ? '?' : nextSeg.chord === 'N' ? '—' : nextSeg.chord}</b></p>}
            {!chordName && <p className="text-mute text-sm">Cuando suene un acorde, o al tocar uno de la secuencia, aparece su diagrama.</p>}
            {chordName === 'N' && <p className="text-mute text-sm">Sin acorde (silencio o pasaje no armónico).</p>}
            {diagErr && <p role="alert" className="text-sm text-mute">{diagErr}</p>}
            {d && (
              <>
                <DiagramView d={d} />
                <p className="mt-1 text-center text-sm">{d.label}</p>
                <p className="text-center text-xs text-mute">{d.source}</p>
                {shownDiagrams && shownDiagrams.length > 1 && (
                  <button className={`mt-2 w-full ${small}`} onClick={() => setPos((p) => p + 1)}>Otra posición ({(pos % shownDiagrams.length) + 1}/{shownDiagrams.length})</button>
                )}
              </>
            )}
            {seg && shownIdx !== null && (
              <button className={`mt-2 w-full ${small}`} onClick={() => { setLoop({ start: seg.start + eo, end: seg.end + eo }); player.seek(seg.start + eo); player.play() }}>Repetir este acorde</button>
            )}
          </section>

          {seg && shownIdx !== null && source !== 'none' && (
            <section className={sec}>
              <h2 className="text-lg font-semibold mb-2">Editar acorde {shownIdx + 1}</h2>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <label className="col-span-3">Acorde (ej. Am, F#, E7, N)
                  <input key={`c${shownIdx}${seg.chord}`} defaultValue={seg.chord} onBlur={(e) => e.target.value.trim() !== seg.chord && applyChord(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className="mt-1 w-full min-h-11 rounded-lg border border-line bg-bg px-3" /></label>
                <label>Inicio (s)
                  <input key={`s${shownIdx}${seg.start}`} inputMode="decimal" defaultValue={seg.start} onBlur={(e) => num(e.target.value, (t) => moveStart(base, shownIdx, t))} className="mt-1 w-full min-h-11 rounded-lg border border-line bg-bg px-2" /></label>
                <label>Fin (s)
                  <input key={`e${shownIdx}${seg.end}`} inputMode="decimal" defaultValue={seg.end} onBlur={(e) => num(e.target.value, (t) => moveEnd(base, shownIdx, t))} className="mt-1 w-full min-h-11 rounded-lg border border-line bg-bg px-2" /></label>
                <span />
                <button className={small} onClick={() => commit(moveStart(base, shownIdx, fileNow()))}>Inicio = ahora</button>
                <button className={small} onClick={() => commit(moveEnd(base, shownIdx, fileNow()))}>Fin = ahora</button>
                <button className={small} onClick={() => commit(splitAt(base, shownIdx, fileNow()))}>Dividir aquí</button>
                <button className={small} onClick={() => commit(removeAt(base, shownIdx))}>Eliminar</button>
                <button className={small} onClick={undoLast} disabled={!undo.length}>Deshacer</button>
                {original && <button className={small} onClick={restore}>Restaurar original</button>}
              </div>
              <p className="mt-2 text-xs text-mute">Los tiempos son los del archivo analizado. Las correcciones se guardan aparte del resultado del motor.</p>
            </section>
          )}

          <section className={sec}>
            <h2 className="text-lg font-semibold mb-2">Analizar un archivo de audio</h2>
            <AudioPanel job={job} error={jobErr} onFile={pickFile} onCancel={() => cancelRef.current?.()} />
          </section>
          <section className={sec}>
            <h2 className="text-lg font-semibold mb-2">Canciones guardadas</h2>
            <HistoryPanel items={songs} onOpen={openSong} onDelete={removeSong} />
          </section>
        </aside>
      </main>
    </div>
  )
}

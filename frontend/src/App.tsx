import { useEffect, useMemo, useRef, useState } from 'react'
import Controls from './components/Controls.tsx'
import DiagramView from './components/Diagram.tsx'
import { AudioPanel, MarkPanel, SearchPanel } from './components/Panels.tsx'
import Songbook from './components/Songbook.tsx'
import LyricsView from './components/LyricsView.tsx'
import type { Job } from './components/Panels.tsx'
import BeatGrid from './components/BeatGrid.tsx'
import ChordStrip from './components/ChordStrip.tsx'
import { useAudioPlayer } from './hooks/useAudioPlayer.ts'
import { useYouTubePlayer } from './hooks/useYouTubePlayer.ts'
import { findActiveIndex, loopTarget, transposeChord, transposeSegments } from './lib/chords.ts'
import { DEMO_SEGMENTS } from './lib/demo.ts'
import { markChordAt, moveEnd, moveStart, removeAt, setChordAt, splitAt } from './lib/segments.ts'
import { beatPosition } from './lib/engine/beats.ts'
import { validateAudioFile } from './lib/audioFile.ts'
import { decodeToMono } from './lib/decodeAudio.ts'
import { CANCELLED, runSelfTest, startAnalysis } from './lib/engine/runWorker.ts'
import { deleteSong, listSongs, requestPersistence, saveOrder, saveSong, topOrder } from './lib/songs.ts'
import { searchLyrics } from './lib/lrclib.ts'
import { cleanTitle, pickAuto, rankResults, toSongLyrics } from './lib/lyrics.ts'
import type { LyricResult } from './lib/lyrics.ts'
import { parseYouTubeId } from './lib/youtube.ts'
import type { Song } from './lib/songs.ts'
import type { Segment } from './lib/types.ts'

type Source = 'none' | 'demo' | 'analysis'
const APP_VERSION = '0.6.1'
const YT_RATES = [0.5, 0.75, 1, 1.25]
const AUDIO_RATES = [0.5, 0.6, 0.75, 0.9, 1, 1.25]
const CHORD_OK = /^(N|[A-G][#b]?(maj7|m7|sus2|sus4|dim|aug|add9|m|7|6|9)?(\/[A-G][#b]?)?)$/
const store = {
  get: <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? '') as T } catch { return d } },
  set: (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ } },
}

function Stepper({ label, value, onDec, onInc, fmt }: { label: string; value: number; onDec: () => void; onInc: () => void; fmt: (v: number) => string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-2">
      <span className="text-xs text-mute">{label}</span>
      <div className="flex items-center justify-between">
        <button className="min-h-10 min-w-10 rounded border border-line" onClick={onDec} aria-label={`${label}: menos`}>−</button>
        <b className="tabular-nums">{fmt(value)}</b>
        <button className="min-h-10 min-w-10 rounded border border-line" onClick={onInc} aria-label={`${label}: más`}>+</button>
      </div>
    </div>
  )
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
  const [capo, setCapo] = useState(0)
  const [advanced, setAdvanced] = useState(false)
  const [alt, setAlt] = useState<Record<string, number>>({})
  const [offset, setOffset] = useState(0)
  const [hideNames, setHideNames] = useState(false)
  const [loop, setLoop] = useState<{ start: number; end: number } | null>(null)
  const [rate, setRate] = useState(1)
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const [dark, setDark] = useState(() => store.get('dark', window.matchMedia('(prefers-color-scheme: dark)').matches))
  const [settings, setSettings] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testReport, setTestReport] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(true) // se cierra al elegir un video; la lupa lo reabre
  const [easyOnly, setEasyOnly] = useState(() => store.get('easyOnly', false))
  const [recent, setRecent] = useState(() => store.get<{ id: string; title: string }[]>('recent', []))
  const [notice, setNotice] = useState<string | null>(null)
  const [toolsOpen, setToolsOpen] = useState(true) // panel «Analizar un archivo…»
  const [markOpen, setMarkOpen] = useState(false) // marcar acordes sobre el video
  const [markKey, setMarkKey] = useState('C')
  const [ahead, setAhead] = useState(() => store.get('ahead', 0)) // adelantar en pantalla los cambios (s)
  const [drawer, setDrawer] = useState(false) // menú «Mi cancionero»
  const [lyricCands, setLyricCands] = useState<LyricResult[] | null>(null) // letras sugeridas para la canción o el video actual
  const lyricAsked = useRef('')
  const [installEvt, setInstallEvt] = useState<Event & { prompt?: () => Promise<void> } | null>(null)

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; store.set('dark', dark) }, [dark])
  useEffect(() => store.set('easyOnly', easyOnly), [easyOnly])
  useEffect(() => { // ?selftest=1: prueba automática del motor (la usan los tests de navegador en GitHub Actions)
    if (!new URLSearchParams(location.search).has('selftest')) return
    runSelfTest().then((r) => { (window as unknown as { __selftest: unknown }).__selftest = r }, (e: Error) => { (window as unknown as { __selftest: unknown }).__selftest = { ok: false, error: e.message } })
  }, [])
  useEffect(() => store.set('ytKey', ytKey), [ytKey])
  useEffect(() => store.set('ahead', ahead), [ahead])
  const original = song ? (advanced && song.advanced ? song.advanced : song.original) : null
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
  const pickRef = useRef<(v: { id: string; title?: string }) => void>(() => undefined)
  useEffect(() => { // APK: «Compartir → Mi Cancionero» desde YouTube llega acá (lo llama MainActivity)
    const w = window as unknown as { __shareText?: (t: string) => void }
    w.__shareText = (t: string) => {
      const url = /https?:\/\/\S+/.exec(t)?.[0] ?? t
      const id = parseYouTubeId(url)
      if (id) { pickRef.current({ id }); setSearchOpen(false); setDrawer(false) } else setNotice('Lo que compartiste no es un enlace de un video de YouTube.')
    }
    return () => { delete w.__shareText }
  }, [])

  // El desfase solo tiene sentido cuando los acordes de un archivo se muestran sobre un video.
  const eo = mode === 'youtube' && source === 'analysis' ? offset : 0
  const segments = useMemo(() => transposeSegments(base, transpose - capo), [base, transpose, capo]) // con cejilla se muestran las formas a tocar
  const activeIndex = findActiveIndex(segments, player.time + ahead, eo)
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
    const t = setTimeout(() => persist({ settings: { videoId, transpose, offset, capo, advanced } }), 600)
    return () => clearTimeout(t)
  }, [song?.id, transpose, offset, videoId, capo, advanced]) // eslint-disable-line react-hooks/exhaustive-deps


  function commit(next: Segment[]) {
    setUndo((u) => [...u.slice(-19), base]); setBase(next); setNotice(null)
    persist(songRef.current?.kind === 'manual' ? { original: next } : { corrections: next })
  }
  function undoLast() {
    const prev = undo[undo.length - 1]
    if (!prev) return
    setUndo((u) => u.slice(0, -1)); setBase(prev); persist(songRef.current?.kind === 'manual' ? { original: prev } : { corrections: prev })
  }
  function restore() {
    if (!original) return
    setUndo((u) => [...u.slice(-19), base]); setBase(original); persist({ corrections: null })
  }
  function clearSong() {
    songRef.current = null; setSong(null); setBase([]); setUndo([]); setSource('none'); setFocusIdx(null); setLyricCands(null)
    setTranspose(0); setCapo(0); setOffset(0); setAdvanced(false); setAlt({})
  }
  /** «Nueva canción»: vuelve al estado inicial sin recargar la página (lo guardado sigue en «Canciones guardadas»). */
  function newSong() {
    if (job) { setNotice('Esperá a que termine (o cancelá) el análisis en curso.'); return }
    yt.pause(); au.pause(); clearSong()
    setVideoId(null); if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioUrl(null); setAudioName(''); setMode('youtube')
    setLoop(null); setRate(1); setNotice(null); setJobErr(null); setMarkOpen(false); setSearchOpen(true); setToolsOpen(true); setLyricCands(null)
  }
  function pickVideo(v: { id: string; title?: string }) {
    setVideoId(v.id); setFocusIdx(null); setLoop(null); setRate(1)
    const cur = songRef.current, linked = songs.find((s) => s.settings.videoId === v.id)
    if (linked) { // ya hay acordes guardados para este video (analizados o marcados): se abren solos
      if (cur?.id !== linked.id) openSong(linked, true); else setMode('youtube')
    } else {
      if (cur && cur.kind === 'manual' && cur.settings.videoId && cur.settings.videoId !== v.id) clearSong() // los acordes marcados pertenecen a otro video
      else if (cur && !cur.settings.videoId) persist({ settings: { ...cur.settings, videoId: v.id } }) // se une a la canción abierta
      if (!audioUrl || !songRef.current) setMode('youtube')
      if (source === 'demo') { setBase([]); setSource('none') }
      setMarkOpen(false)
    }
    if (v.title) {
      const next = [{ id: v.id, title: v.title }, ...recent.filter((r) => r.id !== v.id)].slice(0, 6)
      setRecent(next); store.set('recent', next)
    }
  }
  pickRef.current = pickVideo
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
        id: crypto.randomUUID(), kind: 'analysis', filename: f.name, createdAt: Date.now(), duration: out.duration, method: out.method,
        lowConfidence: conf.length > 0 && conf.reduce((a, b) => a + b, 0) / conf.length < 0.6,
        original: out.segments, corrections: null, settings: { videoId, transpose: 0, offset: 0, capo: 0, advanced: false }, audio: f,
        beats: out.beats, bpm: out.bpm, downbeat: out.downbeat, beatsPerBar: out.beatsPerBar, key: out.key, advanced: out.advanced,
        order: topOrder(songs),
      }
      const prev = songRef.current
      if (prev && !prev.audio && !prev.original.length) { // canción creada desde la letra o un video, todavía sin acordes: se completa
        Object.assign(s, { id: prev.id, order: prev.order, createdAt: prev.createdAt, lyrics: prev.lyrics, lyricsOffset: prev.lyricsOffset, filename: prev.filename, settings: { ...s.settings, videoId: prev.settings.videoId ?? videoId } })
      }
      songRef.current = s; setSong(s)
      setBase(s.original); setUndo([]); setSource('analysis'); setTranspose(0); setCapo(0); setAdvanced(false); setOffset(0); setFocusIdx(null)
      setToolsOpen(false); setMarkOpen(false)
      await saveSong(s); void refreshSongs()
      if (out.warning) setNotice(out.warning)
    } catch (e) {
      const m = (e as Error).message
      if (m === CANCELLED) setNotice('Análisis cancelado.'); else setJobErr(m)
    } finally { cancelRef.current = null; setJob(null) }
  }
  function openSong(s: Song, preferVideo = false) {
    const adv = !!s.settings.advanced && !!s.advanced
    songRef.current = s; setSong(s)
    if (s.audio) { showAudio(s.audio, s.filename); if (preferVideo && s.settings.videoId) setMode('youtube') }
    else { if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioUrl(null); setAudioName(''); setMode('youtube') }
    setMarkOpen(s.kind === 'manual' && !!s.settings.videoId); setAlt({}); setToolsOpen(false); setLyricCands(null)
    setAdvanced(adv); setBase(s.corrections ?? (adv ? (s.advanced as Segment[]) : s.original)); setUndo([]); setSource('analysis'); setFocusIdx(null)
    setTranspose(s.settings.transpose); setCapo(s.settings.capo ?? 0); setOffset(s.settings.offset)
    setVideoId(s.settings.videoId ?? null) // cada canción abre su propio video (o ninguno)
    setNotice(null)
  }
  /** Guarda una letra en la canción abierta; si no hay ninguna, crea una entrada nueva en el cancionero (todavía sin acordes). */
  function attachLyrics(r: LyricResult) {
    const ly = toSongLyrics(r), nice = `${ly.trackName} — ${ly.artistName}`
    const cur = songRef.current
    if (cur) {
      const generic = /^Video [\w-]{11}$/.test(cur.filename) || /\.(mp3|wav)$/i.test(cur.filename)
      persist({ lyrics: ly, lyricsOffset: 0, ...(generic ? { filename: nice } : {}) })
    } else {
      const s: Song = { id: crypto.randomUUID(), kind: 'manual', filename: nice, createdAt: Date.now(), duration: ly.duration ?? 0, method: 'letra de LRCLIB (todavía sin acordes)',
        lowConfidence: false, original: [], corrections: null, settings: { videoId, transpose, offset: 0, capo, advanced: false }, audio: null,
        order: topOrder(songs), lyrics: ly, lyricsOffset: 0 }
      songRef.current = s; setSong(s); setBase([]); setUndo([]); setSource('analysis'); setOffset(0); setAdvanced(false); setFocusIdx(null)
      saveSong(s).then(refreshSongs).catch((e: Error) => setNotice(e.message))
    }
    setLyricCands(null)
  }
  async function reorderSongs(list: Song[]) {
    try {
      const latest = new Map((await listSongs()).map((x) => [x.id, x]))
      const saved = await saveOrder(list.map((x) => latest.get(x.id) ?? x))
      const cur = songRef.current, mine = cur && saved.find((x) => x.id === cur.id)
      if (cur && mine) songRef.current = { ...cur, order: mine.order }
      void refreshSongs()
    } catch (e) { setNotice((e as Error).message) }
  }
  function renameSong(s: Song, name: string) {
    if (songRef.current?.id === s.id) { persist({ filename: name }); return }
    saveSong({ ...s, filename: name }).then(refreshSongs).catch((e: Error) => setNotice(e.message))
  }
  function toggleAdvanced(on: boolean) {
    const cur = songRef.current
    if (!cur || on === advanced) return
    if (on && !cur.advanced) { setNotice('Esta canción se analizó antes de existir el modo avanzado. Volvé a analizarla.'); return }
    if (cur.corrections) { setNotice('Tenés correcciones guardadas: tocá «Restaurar original» antes de cambiar de modo.'); return }
    setAdvanced(on); setBase(on ? (cur.advanced as Segment[]) : cur.original); setUndo([]); setFocusIdx(null); setNotice(null)
  }
  function loopCycle() {
    if (!loop) setLoop({ start: player.time, end: player.time })
    else if (loop.end <= loop.start) setLoop({ start: loop.start, end: Math.max(player.time, loop.start + 0.5) })
    else setLoop(null)
  }
  function alignToVideo() { // el usuario marca en el video el instante en que empieza el acorde elegido
    if (shownIdx === null) return
    setOffset(Math.round((player.time - segments[shownIdx].start) * 10) / 10); setNotice(null)
  }
  async function removeSong(s: Song) {
    if (!window.confirm(`¿Borrar «${s.filename}», sus acordes y el audio guardado en este teléfono?`)) return
    try {
      await deleteSong(s.id)
      if (songRef.current?.id === s.id) { songRef.current = null; setSong(null); setBase([]); setSource('none') }
      void refreshSongs()
    } catch (e) { setNotice((e as Error).message) }
  }
  function markChord(raw: string) {
    if (!videoId) return
    const name = raw.trim()
    if (!CHORD_OK.test(name)) { setNotice(`«${name}» no es un acorde admitido.`); return }
    const chord = name === 'N' ? 'N' : transposeChord(name, capo - transpose) // se guarda en el tono real
    const t = yt.time, dur = yt.duration || t + 1
    let cur = songRef.current
    if (cur && cur.kind === 'manual' && !cur.settings.videoId) { cur = { ...cur, settings: { ...cur.settings, videoId } }; songRef.current = cur } // canción de la letra: se une a este video
    if (!cur || cur.kind !== 'manual' || cur.settings.videoId !== videoId) {
      const title = yt.title || recent.find((r) => r.id === videoId)?.title || `Video ${videoId}`
      cur = { id: crypto.randomUUID(), kind: 'manual', filename: title, createdAt: Date.now(), duration: dur, method: 'acordes marcados a mano sobre el video',
        lowConfidence: false, original: [], corrections: null, settings: { videoId, transpose, offset: 0, capo, advanced: false }, audio: null, order: topOrder(songs) }
      songRef.current = cur; setSong(cur); setUndo([]); setSource('analysis'); setOffset(0); setAdvanced(false)
      saveSong(cur).then(refreshSongs).catch((e: Error) => setNotice(e.message))
    }
    const prevBase = cur.original
    const next = markChordAt(prevBase, t, chord, dur)
    if (next === prevBase) return
    setUndo((u) => [...u.slice(-49), prevBase]); setBase(next); setNotice(null)
    persist({ original: next, duration: dur })
  }
  function selectChord(i: number) { setFocusIdx(i); player.seek(segments[i].start + eo); player.play() }
  const fileNow = () => Math.max(0, player.time - eo)

  function applyChord(raw: string) {
    if (shownIdx === null) return
    const name = raw.trim()
    if (!CHORD_OK.test(name)) { setNotice(`«${name}» no es un acorde admitido (mayor, menor, séptima o N).`); return }
    commit(setChordAt(base, shownIdx, name === 'N' ? 'N' : transposeChord(name, capo - transpose)))
  }
  const num = (v: string, f: (t: number) => Segment[]) => { const t = Number(v.replace(',', '.')); if (Number.isFinite(t)) commit(f(t)) }

  const hasMedia = !!(videoId || audioUrl)
  // Letra automática: con el título del video (o el nombre del archivo analizado) se busca en LRCLIB. Si una versión coincide en
  // título y duración (±3 s) se guarda sola en la canción abierta; si no, se ofrecen hasta 3 para elegir. Nunca pisa una letra elegida.
  const lyrName = mode === 'youtube' && videoId ? yt.title : song?.audio ? song.filename : ''
  const lyrDur = mode === 'youtube' && videoId ? yt.duration : song?.duration ?? 0
  const wantsLyrics = !!lyrName && lyrDur > 0 && (!song || song.lyrics === undefined) && (mode !== 'youtube' || !song || !song.settings.videoId || song.settings.videoId === videoId)
  useEffect(() => {
    if (!wantsLyrics) return
    const key = `${song?.id ?? '-'}|${lyrName}`
    if (lyricAsked.current === key) return
    lyricAsked.current = key
    const q = cleanTitle(lyrName)
    if (q.length < 3) return
    searchLyrics(q).then((res) => {
      if (lyricAsked.current !== key) return
      const auto = pickAuto(res, q, lyrDur)
      if (auto && songRef.current) attachLyrics(auto)
      else { const r = rankResults(res, q, lyrDur).slice(0, 3); setLyricCands(r.length ? r : null) }
    }, () => undefined) // sin conexión: no se insiste; se puede buscar a mano
  }, [wantsLyrics, lyrName, lyrDur, song?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const small = 'min-h-10 px-3 rounded-lg border border-line text-sm'
  const box = 'rounded-2xl border border-line bg-panel p-3'
  const fileTime = player.time - eo
  const viewTime = fileTime + ahead // lo que se muestra (con anticipación opcional)
  const bpb = song?.beatsPerBar ?? 4
  const bpos = song?.beats?.length ? beatPosition(song.beats, viewTime, song.downbeat ?? 0, bpb) : null
  const info = [song?.key && `Tonalidad: ${song.key}`, song?.bpm && `≈ ${Math.round(song.bpm)} bpm`, bpos && `compás ${bpos.bar}, tiempo ${bpos.inBar + 1} (estimado, 4/4)`].filter(Boolean).join(' · ')
  return (
    <div className="flex h-[100dvh] flex-col">
      <Songbook open={drawer} songs={songs} currentId={song?.id ?? null} onClose={() => setDrawer(false)} onOpen={(x) => openSong(x)} onNew={newSong}
        onDelete={removeSong} onRename={renameSong} onReorder={reorderSongs} />
      <header className="max-h-[40vh] shrink-0 space-y-2 overflow-y-auto border-b border-line bg-bg px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setDrawer(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line" aria-label="Abrir Mi cancionero">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
            <h1 className="truncate text-lg font-extrabold">Mi Cancionero</h1>
          </div>
          <div className="flex gap-2">
            {installEvt && <button className={small} onClick={() => installEvt.prompt?.()}>Instalar</button>}
            <button className={small} onClick={newSong} disabled={!!job} title="Empezar otra canción sin recargar">+ Nueva</button>
            <button onClick={() => setSearchOpen((x) => !x)} className="grid h-10 w-10 place-items-center rounded-lg border border-line" aria-label="Buscar canción" aria-expanded={searchOpen}>
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></svg></button>
            <button onClick={() => setSettings((x) => !x)} className={small} aria-expanded={settings}>Ajustes</button>
          </div>
        </div>
        {settings && (
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Tema oscuro</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={easyOnly} onChange={(e) => setEasyOnly(e.target.checked)} /> Priorizar posiciones sin cejilla completa</label>
            <div className="flex items-center gap-2">
              <span>Mostrar los cambios antes:</span>
              <button className={small} onClick={() => setAhead((a) => Math.max(0, Math.round((a - 0.05) * 100) / 100))}>−</button>
              <span className="w-14 text-center">{ahead.toFixed(2)} s</span>
              <button className={small} onClick={() => setAhead((a) => Math.min(0.5, Math.round((a + 0.05) * 100) / 100))}>+</button>
            </div>
            <p className="w-full text-xs text-mute">Versión {APP_VERSION}</p>
            <div className="w-full space-y-1">
              <button className={small} disabled={testing} onClick={async () => {
                setTesting(true); setTestReport(null)
                try {
                  const r = await runSelfTest()
                  const est = (min: number) => Math.round(r.secPerAudioMinute * min)
                  setTestReport([
                    r.ok ? 'Motor de IA: FUNCIONA en este dispositivo (detectó Do-Mi-Sol).' : `Motor de IA: FALLÓ${r.error ? ` (${r.error})` : ''}. Detectó: ${r.foundPitchClasses.join(' ') || 'nada'}. La app usará el motor clásico.`,
                    r.ok ? `Carga del modelo: ${(r.loadMs / 1000).toFixed(1)} s · ${Math.round(r.msPerWindow)} ms por ventana · ≈ ${r.secPerAudioMinute.toFixed(1)} s por minuto de audio (canción de 3 min ≈ ${est(3)} s + análisis).` : '',
                    `WASM SIMD: ${r.simd ? 'sí' : 'no'} · núcleos: ${r.cores ?? '?'} · memoria: ${r.memoryGB ?? '?'} GB`,
                    `Navegador: ${r.userAgent}`,
                    `Huella del motor (debe ser igual en la web y en la APK): ${r.manifest.replace(/\s+/g, ' ').slice(0, 400)}`,
                  ].filter(Boolean).join('\n'))
                } catch (e) { setTestReport(`No se pudo ejecutar la prueba: ${(e as Error).message}`) } finally { setTesting(false) }
              }}>{testing ? 'Probando…' : 'Probar motor de IA en este dispositivo'}</button>
              {testReport && <>
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-panel p-2 text-xs">{testReport}</pre>
                <button className={small} onClick={() => navigator.clipboard?.writeText(testReport).catch(() => undefined)}>Copiar resultados</button>
              </>}
            </div>
            <label className="w-full">Clave propia de YouTube Data API v3 (opcional, solo para buscar; se guarda solo en este teléfono)
              <input value={ytKey} onChange={(e) => setYtKey(e.target.value.trim())} autoComplete="off" className="mt-1 min-h-11 w-full rounded-lg border border-line bg-panel px-3" /></label>
          </div>
        )}
        {searchOpen && <SearchPanel onPick={(v) => { pickVideo(v); setSearchOpen(false) }} onLyrics={attachLyrics} recent={recent} apiKey={ytKey} />}
      </header>

      <main className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {source === 'demo' && <p className="rounded bg-accent/20 p-2 text-sm font-semibold">DEMOSTRACIÓN: acordes de ejemplo, no corresponden al video ni a un análisis real.</p>}
        {notice && <p role="alert" className="text-sm text-red-500">{notice}</p>}
        {mode === 'youtube' && videoId && (markOpen || song?.kind === 'manual') && (source !== 'analysis' || song?.kind === 'manual') && (
          <section className={box}>
            <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Marcar acordes en este video</h2>
              <button className={small} onClick={() => setMarkOpen(false)}>Ocultar</button></div>
            {markOpen ? <MarkPanel time={yt.time} used={[...new Set(segments.map((x) => x.chord))]} onMark={markChord} onUndo={undoLast} canUndo={!!undo.length} keyName={markKey} onKey={setMarkKey} />
              : <button className={small} onClick={() => setMarkOpen(true)}>Seguir marcando</button>}
          </section>)}
        {segments.length ? (
          <>
            <BeatGrid segments={segments} beats={song?.beats ?? []} downbeat={song?.downbeat ?? 0} bpb={bpb} time={viewTime} hideNames={hideNames} />
            {info && <p className="text-xs text-mute">{info}</p>}
            {song?.lyrics && <LyricsView lyrics={song.lyrics} time={viewTime} offset={song.lyricsOffset ?? 0} onOffset={(o) => persist({ lyricsOffset: o })}
              onSeek={(t) => { if (hasMedia) player.seek(Math.max(0, t + eo)) }} onRemove={() => persist({ lyrics: null })} />}
            {lyricCands && !song?.lyrics && (
              <section className={box}>
                <h2 className="text-sm font-semibold">¿Es alguna de estas letras?</h2>
                <ul className="mt-1 space-y-1">{lyricCands.map((r) => (
                  <li key={r.id}><button className="w-full rounded-lg border border-line bg-bg p-2 text-left text-sm" onClick={() => attachLyrics(r)}>
                    <b>{r.trackName}</b> · {r.artistName}{r.duration ? ` · ${Math.floor(r.duration / 60)}:${String(Math.round(r.duration % 60)).padStart(2, '0')}` : ''}{r.syncedLyrics ? '' : ' · sin tiempos'}</button></li>))}
                </ul>
                <button className={`mt-2 ${small}`} onClick={() => { setLyricCands(null); if (songRef.current) persist({ lyrics: null }) }}>Ninguna</button>
              </section>)}
            <ChordStrip segments={segments} activeIndex={activeIndex} time={viewTime} hideNames={hideNames} easyOnly={easyOnly}
              alt={alt} onAlt={(c) => setAlt((a) => ({ ...a, [c]: (a[c] ?? 0) + 1 }))} onSelect={selectChord} />
            <section className={box}>
              <h2 className="mb-2 font-semibold">Opciones</h2>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-lg border border-line bg-panel p-2">
                <span className="text-xs text-mute">Acordes</span>
                <div className="grid grid-cols-2 gap-1">
                  <button className={`${small} ${!advanced ? 'bg-accent text-accent-fg' : ''}`} onClick={() => toggleAdvanced(false)} disabled={source !== 'analysis' || song?.kind === 'manual'}>Simples</button>
                  <button className={`${small} ${advanced ? 'bg-accent text-accent-fg' : ''}`} onClick={() => toggleAdvanced(true)} disabled={source !== 'analysis' || song?.kind === 'manual'}>Avanzados</button>
                </div>
              </div>
              <Stepper label="Transponer" value={transpose} fmt={(v) => (v > 0 ? `+${v}` : `${v}`)} onDec={() => setTranspose((t) => Math.max(-11, t - 1))} onInc={() => setTranspose((t) => Math.min(11, t + 1))} />
              <Stepper label="Cejilla (traste)" value={capo} fmt={(v) => (v ? `${v}` : 'sin')} onDec={() => setCapo((c) => Math.max(0, c - 1))} onInc={() => setCapo((c) => Math.min(11, c + 1))} />
              <label className="flex items-center gap-2 rounded-lg border border-line bg-panel p-2"><input type="checkbox" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} /> Ocultar nombres</label>
            </div>
            {capo > 0 && <p className="text-xs text-mute">Con cejilla en el traste {capo} se muestran las formas a tocar; el sonido sigue siendo el de la canción.</p>}
            {mode === 'youtube' && source === 'analysis' && song?.kind !== 'manual' && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Desfase {offset.toFixed(1)} s</span>
                <button className={small} onClick={() => setOffset((o) => Math.round((o - 0.1) * 10) / 10)}>−0,1</button>
                <button className={small} onClick={() => setOffset((o) => Math.round((o + 0.1) * 10) / 10)}>+0,1</button>
                <button className={small} disabled={shownIdx === null} onClick={alignToVideo}>Alinear: este acorde empieza ahora</button>
              </div>)}
              {source === 'analysis' && song && <p className="text-xs text-mute">«{song.filename}» · {song.method}.{song.kind !== 'manual' && advanced && ' Modo avanzado (experimental): reconoce más tipos de acordes pero se equivoca más.'}{mode === 'youtube' && song.kind !== 'manual' && ' Con otra versión del video habrá desincronización: usá «Alinear».'}{song.lowConfidence && ' Confianza media baja: revisá los acordes marcados con ≈.'}</p>}
            </section>
          </>
        ) : (<>
          {song?.lyrics && <LyricsView lyrics={song.lyrics} time={viewTime} offset={song.lyricsOffset ?? 0} onOffset={(o) => persist({ lyricsOffset: o })}
            onSeek={(t) => { if (hasMedia) player.seek(Math.max(0, t + eo)) }} onRemove={() => persist({ lyrics: null })} />}
          {lyricCands && !song?.lyrics && (
            <section className={box}>
              <h2 className="text-sm font-semibold">¿Es alguna de estas letras?</h2>
              <ul className="mt-1 space-y-1">{lyricCands.map((r) => (
                <li key={r.id}><button className="w-full rounded-lg border border-line bg-bg p-2 text-left text-sm" onClick={() => attachLyrics(r)}>
                  <b>{r.trackName}</b> · {r.artistName}{r.duration ? ` · ${Math.floor(r.duration / 60)}:${String(Math.round(r.duration % 60)).padStart(2, '0')}` : ''}{r.syncedLyrics ? '' : ' · sin tiempos'}</button></li>))}
              </ul>
              <button className={`mt-2 ${small}`} onClick={() => { setLyricCands(null); if (songRef.current) persist({ lyrics: null }) }}>Ninguna</button>
            </section>)}
          <section className={box}>
            <h2 className="font-semibold">Todavía no hay acordes</h2>
            <p className="text-sm text-mute">No se inventan resultados. Con un video de YouTube podés: <b>(1)</b> analizar con la IA tu propio MP3/WAV de la misma canción (abajo): los acordes quedan unidos a este video y se abren solos la próxima vez que lo elijas; o <b>(2)</b> marcar los acordes tocándolos mientras suena el video. La app no capta ni descarga el audio de YouTube (lo prohíben sus condiciones) y nunca usa el micrófono.</p>
            {mode === 'youtube' && videoId && !markOpen && <button className={`mt-2 ${small}`} onClick={() => setMarkOpen(true)}>Marcar los acordes de este video</button>}
            {hasMedia && !song && <button className={`mt-2 ${small}`} onClick={() => { setBase(DEMO_SEGMENTS); setSource('demo'); songRef.current = null; setSong(null); setUndo([]) }}>Ver secuencia de demostración</button>}
          </section>
        </>)}

        <details className={box} open={toolsOpen} onToggle={(e: { currentTarget: HTMLDetailsElement }) => setToolsOpen(e.currentTarget.open)}>
          <summary className="flex min-h-10 cursor-pointer items-center font-semibold">Analizar un archivo y editar acordes</summary>
          <div className="space-y-4 pt-2">
            <div><h3 className="mb-1 font-semibold">Analizar un archivo de audio</h3>
              <AudioPanel job={job} error={jobErr} onFile={pickFile} onCancel={() => cancelRef.current?.()} /></div>
            {seg && shownIdx !== null && source !== 'none' && (
              <div><h3 className="mb-2 font-semibold">Editar acorde {shownIdx + 1}</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <label className="col-span-3">Acorde (ej. Am, F#, E7, Dsus4, N)
                    <input key={`c${shownIdx}${seg.chord}`} defaultValue={seg.chord} onBlur={(e) => e.target.value.trim() !== seg.chord && applyChord(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-bg px-3" /></label>
                  <label>Inicio (s)
                    <input key={`s${shownIdx}${seg.start}`} inputMode="decimal" defaultValue={seg.start} onBlur={(e) => num(e.target.value, (t) => moveStart(base, shownIdx, t))} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-bg px-2" /></label>
                  <label>Fin (s)
                    <input key={`e${shownIdx}${seg.end}`} inputMode="decimal" defaultValue={seg.end} onBlur={(e) => num(e.target.value, (t) => moveEnd(base, shownIdx, t))} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-bg px-2" /></label>
                  <span />
                  <button className={small} onClick={() => commit(moveStart(base, shownIdx, fileTime))}>Inicio = ahora</button>
                  <button className={small} onClick={() => commit(moveEnd(base, shownIdx, fileTime))}>Fin = ahora</button>
                  <button className={small} onClick={() => commit(splitAt(base, shownIdx, fileTime))}>Dividir aquí</button>
                  <button className={small} onClick={() => commit(removeAt(base, shownIdx))}>Eliminar</button>
                  <button className={small} onClick={undoLast} disabled={!undo.length}>Deshacer</button>
                  {original && song?.kind !== 'manual' && <button className={small} onClick={restore}>Restaurar original</button>}
                </div>
                <p className="mt-2 text-xs text-mute">Los tiempos son los del archivo analizado. Las correcciones se guardan aparte del resultado del motor. La edición muestra el acorde con la transposición y cejilla actuales.</p>
              </div>)}
            <button className={small} onClick={() => setDrawer(true)}>Ver Mi cancionero ({songs.length})</button>
          </div>
        </details>
      </main>

      <footer className="shrink-0 border-t border-line bg-panel px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {videoId && audioUrl && (
          <div className="mb-2 flex gap-2" role="group" aria-label="Fuente de reproducción">
            <button className={`${small} ${mode === 'audio' ? 'bg-accent text-accent-fg' : ''}`} onClick={() => setMode('audio')}>Mi archivo</button>
            <button className={`${small} ${mode === 'youtube' ? 'bg-accent text-accent-fg' : ''}`} onClick={() => setMode('youtube')}>Video de YouTube</button>
          </div>
        )}
        {player.error && <p role="alert" className="text-sm text-red-500">{player.error}{mode === 'youtube' && videoId && <> <a className="underline" href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer">Abrir en YouTube</a></>}</p>}
        {hasMedia ? (
          <Controls time={player.time} duration={player.duration} playing={player.playing}
            onPlay={player.play} onPause={player.pause} onSeek={player.seek} onSkip={player.skip}
            onVolume={player.setVolume} rate={rate} rates={mode === 'audio' ? AUDIO_RATES : YT_RATES}
            onRate={(r) => { setRate(r); player.setRate(r) }} loop={loop} onLoopCycle={loopCycle}>
            <div className={`aspect-video w-full overflow-hidden rounded-lg bg-black ${mode === 'audio' || !videoId ? 'hidden' : ''}`} ref={yt.hostRef} />
            {(mode === 'audio' || !videoId) && audioUrl && <p className="rounded-lg bg-bg p-2 text-center text-xs text-mute">Reproduciendo tu archivo: {audioName}</p>}
          </Controls>
        ) : <p className="py-2 text-center text-sm text-mute">Buscá una canción o elegí un MP3/WAV para empezar.</p>}
      </footer>
    </div>
  )
}

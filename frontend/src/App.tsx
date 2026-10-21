import { useEffect, useMemo, useRef, useState } from 'react'
import Controls, { PlayExtras } from './components/Controls.tsx'
import LyricsSearch from './components/LyricsSearch.tsx'
import DiagramView from './components/Diagram.tsx'
import { AudioPanel, SearchPanel } from './components/Panels.tsx'
import Songbook from './components/Songbook.tsx'
import LyricsView from './components/LyricsView.tsx'
import type { Job } from './components/Panels.tsx'
import BeatGrid from './components/BeatGrid.tsx'
import ChordStrip from './components/ChordStrip.tsx'
import { useAudioPlayer } from './hooks/useAudioPlayer.ts'
import { useYouTubePlayer } from './hooks/useYouTubePlayer.ts'
import { findActiveIndex, loopTarget, transposeChord, transposeSegments } from './lib/chords.ts'
import { moveEnd, moveStart, nextChange, removeAt, retimeAt, setChordAt, splitAt } from './lib/segments.ts'
import { beatPosition } from './lib/engine/beats.ts'
import { validateAudioFile } from './lib/audioFile.ts'
import { decodeToMono } from './lib/decodeAudio.ts'
import { CANCELLED, runSelfTest, startAnalysis } from './lib/engine/runWorker.ts'
import { NMETHOD } from './lib/engine/analyzeNotes.ts'
import { deleteSong, listSongs, requestPersistence, saveOrder, saveSong, topOrder } from './lib/songs.ts'
import { searchLyrics, searchPlainLyrics } from './lib/lrclib.ts'
import { cleanTitle, fitAnchors, parseVideoTitle, songbookText, pastedLyrics, pickConfident, rankResults, toSongLyrics } from './lib/lyrics.ts'
import type { LyricAnchor, LyricLine, LyricResult as LR } from './lib/lyrics.ts'
import { METERS, alignCifrado, barsFromTaps, gridFromBars, chordSequence, cifradoLyrics, cifradoMeta, cifradoSegments, lyricsFromChords, parseCifrado, uncoveredParts, upgradeCifrado } from './lib/cifrado.ts'
import { estimateBeats, simplifyChord } from './lib/grid.ts'
import { hasWebPicker, importFromSongbook, pickYouTube, saveFile, shareFile, songbookSearchUrl } from './lib/webPicker.ts'
import { FILE_EXT, decodeSongs, encodeSongs, safeName, songsToAdd } from './lib/songfile.ts'
import { APP_VERSION } from './lib/version.ts'
import { Icon, Notebook } from './components/Art.tsx'
import Splash from './components/Splash.tsx'
import type { LyricResult } from './lib/lyrics.ts'
import { parseYouTubeId } from './lib/youtube.ts'
import { isEmptyDraft } from './lib/draft.ts'
import type { Song } from './lib/songs.ts'
import type { Segment } from './lib/types.ts'

type Source = 'none' | 'demo' | 'analysis'
const YT_RATES = [0.5, 0.75, 1, 1.25]
const AUDIO_RATES = [0.5, 0.6, 0.75, 0.9, 1, 1.25]
const CHORD_OK = /^(N|[A-G][#b]?(maj7|m7|sus2|sus4|dim|aug|add9|m|7|6|9)?(\/[A-G][#b]?)?)$/
const store = {
  get: <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? '') as T } catch { return d } },
  set: (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ } },
}

function Stepper({ label, value, onDec, onInc, fmt }: { label: string; value: number; onDec: () => void; onInc: () => void; fmt: (v: number) => string }) {
  return (
    <div className="rounded-xl bg-panel p-2">
      <span className="text-xs text-mute">{label}</span>
      <div className="flex items-center justify-between">
        <button className="btn min-w-10" onClick={onDec} aria-label={`${label}: menos`}>−</button>
        <b className="tabular-nums">{fmt(value)}</b>
        <button className="btn min-w-10" onClick={onInc} aria-label={`${label}: más`}>+</button>
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
  const [optsOpen, setOptsOpen] = useState(false) // «⋯ Opciones»: todo lo que no es acordes, compás y letra
  const [lyricsNote, setLyricsNote] = useState<string | null>(null) // aviso cuando no se encontró la letra
  const [lyricsOpen, setLyricsOpen] = useState(false) // búsqueda de letra (solo letras)
  const [lyricsWeb, setLyricsWeb] = useState(false) // abrir la búsqueda de letra directo en una página web
  const [chordsOpen, setChordsOpen] = useState(false) // menú «Acordes»
  const [searchKey, setSearchKey] = useState(0) // «+ Nueva» vuelve a crear el buscador (limpio)
  const [ahead, setAhead] = useState(() => store.get('ahead', 0)) // adelantar en pantalla los cambios (s)
  const [drawer, setDrawer] = useState(false) // menú «Mi cancionero»
  const [lyricCands, setLyricCands] = useState<LyricResult[] | null>(null) // letras sugeridas para la canción o el video actual
  const lyricAsked = useRef('')
  const [searchHint, setSearchHint] = useState('') // lo que se escribió en el buscador (ayuda a encontrar la letra del video elegido)
  const [wantChords, setWantChords] = useState(false) // APK: después de elegir el video, abrir el cancionero para importar acordes
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [importing, setImporting] = useState(false)
  const [lyricsTried, setLyricsTried] = useState(false)
  const [retimeOpen, setRetimeOpen] = useState(false) // «Marcar cambios»: tocar en cada cambio de acorde
  const [held, setHeld] = useState(-1) // «Marcar cambios»: el acorde que queda quieto en pantalla hasta el próximo toque
  const heldStack = useRef<number[]>([])
  const [barsOpen, setBarsOpen] = useState(false) // «Marcar pulso»: tocar en cada «uno» mientras suena
  const [barTaps, setBarTaps] = useState<number[]>([])
  const [barMeter, setBarMeter] = useState('4/4')
  const [stepMode, setStepMode] = useState(false) // modo «Siguiente»: avanzar acorde por acorde con un toque
  const [stepIdx, setStepIdx] = useState(0)
  const [seqOpen, setSeqOpen] = useState(false) // escribir una secuencia de acordes
  const [seqText, setSeqText] = useState('')
  const [seqName, setSeqName] = useState('')
  const [fileBusy, setFileBusy] = useState<string | null>(null) // guardando / importando archivos
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
  const importRef = useRef<(f: File) => void>(() => undefined)
  useEffect(() => { // APK: un archivo de Mi Cancionero compartido o abierto desde WhatsApp, Descargas… (lo llama MainActivity)
    const w = window as unknown as { __importFile?: (b64: string, name: string) => void }
    w.__importFile = (b64: string, name: string) => {
      try {
        const bin = atob(b64), bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        setDrawer(true)
        importRef.current(new File([bytes], name || 'cancion.cancionero'))
      } catch { setNotice('No se pudo leer el archivo que abriste.') }
    }
    return () => { delete w.__importFile }
  }, [])

  // El desfase solo tiene sentido cuando los acordes de un archivo se muestran sobre un video.
  const eo = mode === 'youtube' && source === 'analysis' ? offset : 0
  const segments = useMemo(() => {
    const t = transposeSegments(base, transpose - capo)
    return !advanced && !(song?.audio && song.kind === 'analysis') ? t.map((x) => ({ ...x, chord: simplifyChord(x.chord) })) : t
  }, [base, transpose, capo, advanced, song?.audio, song?.kind]) // con cejilla se muestran las formas a tocar
  // Sin letra sincronizada: la letra de la página de acordes sigue a los acordes (si los tiempos de los acordes están bien —p. ej.
  // marcados con «Marcar los cambios a mano»— la letra también).
  const chordLyrics = useMemo(() => {
    if (song?.kind !== 'cifrado' || !song.cifrado?.lines || song.lyrics?.synced) return null
    if (song.lyrics && song.lyrics.artistName !== 'letra de la página de acordes') return null // letra pegada por el usuario: se respeta
    const starts = base.filter((x) => x.chord !== 'N').map((x) => x.start)
    const synced = lyricsFromChords(song.cifrado.lines, starts)
    return synced.length >= 3 ? { source: 'manual' as const, trackName: song.filename, artistName: 'letra de la página, al ritmo de los acordes', synced, plain: null } : null
  }, [song?.kind, song?.cifrado?.lines, song?.lyrics, song?.filename, base])
  const shownLyrics = chordLyrics ?? song?.lyrics ?? null
  const activeIndex = stepMode && segments.length ? Math.min(stepIdx, segments.length - 1)
    : retimeOpen && held >= 0 && held < segments.length ? held // marcando a mano: el acorde no se va hasta que se toque el cambio
    : findActiveIndex(segments, player.time + ahead, eo)
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
    const t = setTimeout(() => persist({ settings: { videoId, transpose, offset, capo, advanced, simplified: !advanced } }), 600)
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
    setLoop(null); setRate(1); setNotice(null); setJobErr(null); setSearchOpen(true); setOptsOpen(false); setLyricCands(null); setLyricsNote(null)
    setSearchKey((k) => k + 1); setLyricsOpen(false); setChordsOpen(false); setPasteOpen(false); setPasteText(''); setSearchHint('')
    setRetimeOpen(false); setStepMode(false); setStepIdx(0); setSeqOpen(false); setSeqText(''); setSeqName('')
  }
  /** Deja la pantalla principal en blanco para una canción nueva (lo anterior sigue guardado en el cancionero). */
  function resetScreenForNew(keepVideo: string) {
    au.pause(); clearSong()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null); setAudioName(''); setMode('youtube'); setVideoId(keepVideo)
    lyricAsked.current = ''
    setNotice(null); setJobErr(null); setOptsOpen(false); setLyricCands(null); setLyricsNote(null); setLyricsTried(false)
    setLyricsOpen(false); setChordsOpen(false); setPasteOpen(false); setPasteText(''); setRetimeOpen(false); setStepMode(false); setStepIdx(0)
    setSeqOpen(false); setSeqText(''); setSeqName('')
  }
  function pickVideo(v: { id: string; title?: string }) {
    setVideoId(v.id); setFocusIdx(null); setLoop(null); setRate(1)
    const cur = songRef.current, linked = songs.find((s) => s.settings.videoId === v.id)
    if (linked) { // ya hay acordes guardados para este video (analizados o marcados): se abren solos
      if (cur?.id !== linked.id) openSong(linked, true); else setMode('youtube')
    } else {
      // Un borrador (solo letra, sin acordes, sin audio y sin video) se une al video elegido. Cualquier otra canción abierta
      // ya quedó guardada en «Mi cancionero»: la pantalla principal se limpia para dejarla lista para la canción nueva.
      if (cur && isEmptyDraft(cur)) persist({ settings: { ...cur.settings, videoId: v.id } })
      else if (cur && !job) resetScreenForNew(v.id)
      if (!audioUrl || !songRef.current) setMode('youtube')
      if (source === 'demo') { setBase([]); setSource('none') }
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
  async function pickFile(f: File, redo?: Song) {
    setNotice(null); setJobErr(null)
    try { validateAudioFile(f.name, f.size, new Uint8Array(await f.slice(0, 12).arrayBuffer())) } catch (e) { setJobErr((e as Error).message); return }
    showAudio(f, redo?.filename ?? f.name)
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
        original: out.segments, corrections: null, settings: { videoId, transpose: 0, offset: 0, capo: 0, advanced: true, simplified: false }, audio: f,
        beats: out.beats, bpm: out.bpm, downbeat: out.downbeat, beatsPerBar: out.beatsPerBar, key: out.key, advanced: out.advanced,
        order: topOrder(songs),
      }
      const prev = redo ?? songRef.current
      if (redo) Object.assign(s, { id: redo.id, order: redo.order, createdAt: redo.createdAt, lyrics: redo.lyrics, lyricsOffset: redo.lyricsOffset, lyricsAnchors: redo.lyricsAnchors, filename: redo.filename, settings: { ...redo.settings, advanced: true, simplified: false } })
      else if (prev && !prev.audio && !prev.original.length) { // canción creada desde la letra o un video, todavía sin acordes: se completa
        Object.assign(s, { id: prev.id, order: prev.order, createdAt: prev.createdAt, lyrics: prev.lyrics, lyricsOffset: prev.lyricsOffset, filename: prev.filename, settings: { ...s.settings, videoId: prev.settings.videoId ?? videoId } })
      }
      songRef.current = s; setSong(s)
      const full = !!s.advanced
      setBase(full ? (s.advanced as Segment[]) : s.original); setUndo([]); setSource('analysis'); setAdvanced(full); setFocusIdx(null)
      setTranspose(s.settings.transpose); setCapo(s.settings.capo ?? 0); setOffset(s.settings.offset)
      await saveSong(s); void refreshSongs()
      if (out.warning) setNotice(out.warning)
    } catch (e) {
      const m = (e as Error).message
      if (m === CANCELLED) setNotice('Análisis cancelado.'); else setJobErr(m)
    } finally { cancelRef.current = null; setJob(null) }
  }
  function openSong(s0: Song, preferVideo = false) {
    const s = refreshCifrado(s0)
    if (s !== s0) saveSong(s).then(refreshSongs).catch(() => undefined)
    const adv = s.kind !== 'analysis' && !s.audio ? !s.settings.simplified : !!s.advanced && (s.settings.simplified !== undefined ? !s.settings.simplified : !s.corrections) // por defecto, los acordes completos
    songRef.current = s; setSong(s)
    if (s.audio) { showAudio(s.audio, s.filename); if (preferVideo && s.settings.videoId) setMode('youtube') }
    else { if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioUrl(null); setAudioName(''); setMode('youtube') }
    setAlt({}); setLyricCands(null); setLyricsNote(null); setRetimeOpen(false); setStepIdx(0); setStepMode(!s.audio && !s.settings.videoId && s.original.length > 0)
    setAdvanced(adv); setBase(s.corrections ?? (adv && s.advanced ? (s.advanced as Segment[]) : s.original)); setUndo([]); setSource('analysis'); setFocusIdx(null)
    setTranspose(s.settings.transpose); setCapo(s.settings.capo ?? 0); setOffset(s.settings.offset)
    setVideoId(s.settings.videoId ?? null) // cada canción abre su propio video (o ninguno)
    setNotice(null)
  }
  /** Canción de cancionero guardada con una versión anterior: se vuelve a leer el cifrado y a ubicar los acordes con las reglas
   *  actuales (acordes con punto, tablaturas, estrofas repetidas). Si el usuario corrigió acordes a mano, no se toca. */
  /** Compases marcados («Marcar pulso») listos para ubicar los acordes; sin marcas o sin letra sincronizada, nada. */
  /** Los «uno» marcados (las marcas guardadas por la 0.8.5 pueden ser cada golpe: se pasan a compases acá también). */
  function tapOnes(t?: Song['taps']) {
    if (!t || t.bars.length < 2) return undefined
    const bars = barsFromTaps(t.bars, (t.meter && METERS[t.meter]?.pulses) || t.bpb)
    return bars.length >= 2 ? { ...t, bars } : undefined
  }
  function gridOf(s: Song, synced?: LyricLine[] | null) {
    const lines = synced ?? s.lyrics?.synced, t = tapOnes(s.taps)
    return t && lines ? { ...t, lines } : undefined
  }
  /** Guarda los compases marcados y vuelve a ubicar los acordes del cifrado sobre ellos (sin marcas: como antes). */
  function applyBars(bars: number[], meter: string) {
    const cur = songRef.current
    if (!cur?.cifrado) return
    const bpb = METERS[meter]?.bpb ?? 4
    const ones = barsFromTaps(bars, METERS[meter]?.pulses ?? bpb)
    const taps = ones.length >= 2 ? { bars: ones, bpb, meter } : undefined
    const next = { ...cur, taps }
    const segs = cifradoSegments(cur.cifrado.events, cur.duration, cur.lyricsAnchors ?? [], cur.lyricsOffset ?? 0, gridOf(next))
    persist({ taps, original: segs })
    if (!cur.corrections) { setBase(segs); setUndo([]) }
    setNotice(cur.corrections ? 'Compases guardados. Tenés acordes corregidos a mano: tocá «Restaurar original» para ver los acordes acomodados al compás.' : taps ? `Listo: acordes acomodados a ${taps.bars.length} compases${taps.bars.length < bars.length ? ` (marcaste ${bars.length} golpes)` : ''}.` : 'Se borraron las marcas de pulso.')
  }
  function refreshCifrado(s: Song): Song {
    if (s.kind !== 'cifrado' || !s.cifrado?.lines || s.corrections) return s
    const lines = upgradeCifrado(s.cifrado.lines) ?? s.cifrado.lines
    const events = alignCifrado(lines, s.lyrics?.synced ?? null)
    if (JSON.stringify(events) === JSON.stringify(s.cifrado.events)) return s
    return { ...s, cifrado: { ...s.cifrado, lines, events }, original: cifradoSegments(events, s.duration, s.lyricsAnchors ?? [], s.lyricsOffset ?? 0, gridOf(s)) }
  }
  /** Guarda una letra en la canción abierta; si no hay ninguna, crea una entrada nueva en el cancionero (todavía sin acordes). */
  function attachLyrics(r: LyricResult) {
    const ly = toSongLyrics(r), nice = `${ly.trackName} — ${ly.artistName}`
    const cur = songRef.current
    if (cur) {
      const generic = /^Video [\w-]{11}$/.test(cur.filename) || /\.(mp3|wav)$/i.test(cur.filename)
      const re: Partial<Song> = {}
      if (cur.kind === 'cifrado' && cur.cifrado?.lines) { // los acordes del cancionero se vuelven a ubicar con la letra nueva
        const events = alignCifrado(cur.cifrado.lines, ly.synced)
        re.cifrado = { ...cur.cifrado, events }; re.original = cifradoSegments(events, cur.duration, [], 0, gridOf(cur, ly.synced)); re.corrections = null
        re.method = ly.synced ? 'acordes del cancionero ubicados con la letra' : cur.method
        setBase(re.original)
      }
      persist({ lyrics: ly, lyricsOffset: 0, lyricsAnchors: [], ...re, ...(generic ? { filename: nice } : {}) })
    } else {
      const s: Song = { id: crypto.randomUUID(), kind: 'manual', filename: nice, createdAt: Date.now(), duration: ly.duration ?? 0, method: 'letra de LRCLIB (todavía sin acordes)',
        lowConfidence: false, original: [], corrections: null, settings: { videoId, transpose, offset: 0, capo, advanced: false }, audio: null,
        order: topOrder(songs), lyrics: ly, lyricsOffset: 0 }
      songRef.current = s; setSong(s); setBase([]); setUndo([]); setSource('analysis'); setOffset(0); setAdvanced(false); setFocusIdx(null)
      saveSong(s).then(refreshSongs).catch((e: Error) => setNotice(e.message))
    }
    setLyricCands(null); setLyricsNote(null); setLyricsOpen(false)
  }
  /** Letra pegada a mano. */
  function pasteLyrics(text: string) {
    const cur = songRef.current ?? ensureVideoSong()
    if (!cur) { setNotice('Primero elegí un video o un archivo para esta canción.'); return }
    persist({ lyrics: pastedLyrics(text, cur.filename), lyricsOffset: 0, lyricsAnchors: [] })
    setLyricCands(null); setLyricsNote(null); setLyricsOpen(false)
  }
  /** Canción para el video abierto (la actual si corresponde, o una nueva sin acordes todavía). */
  function ensureVideoSong(): Song | null {
    const cur = songRef.current
    if (cur && (!videoId || !cur.settings.videoId || cur.settings.videoId === videoId)) return cur
    if (!videoId) return null
    const s: Song = { id: crypto.randomUUID(), kind: 'manual', filename: yt.title || searchHint || `Video ${videoId}`, createdAt: Date.now(), duration: yt.duration || 0,
      method: 'video de YouTube', lowConfidence: false, original: [], corrections: null, settings: { videoId, transpose, offset: 0, capo, advanced: false }, audio: null, order: topOrder(songs) }
    songRef.current = s; setSong(s); setBase([]); setUndo([]); setSource('analysis'); setOffset(0)
    saveSong(s).then(refreshSongs).catch((e: Error) => setNotice(e.message))
    return s
  }
  /** Acordes de un cifrado (letra con acordes arriba) ubicados en el tiempo con la letra sincronizada de la canción. */
  function importCifrado(text: string) {
    const cif = parseCifrado(text)
    if (!cif.some((c) => c.chords.length)) { setNotice('No encontré acordes en ese texto. Tiene que ser la letra con los acordes arriba (como en un cancionero).'); return false }
    const cur = ensureVideoSong()
    if (!cur) { setNotice('Primero elegí un video o una letra para esta canción.'); return false }
    if (cur.audio) { setNotice('Esta canción ya tiene acordes sacados de tu audio; el cifrado no los reemplaza.'); return false }
    const events = alignCifrado(cif, cur.lyrics?.synced ?? null)
    const dur = yt.duration || cur.duration || (events[events.length - 1]?.l ?? 0) + 10
    const segs = cifradoSegments(events, dur, cur.lyricsAnchors ?? [], cur.lyricsOffset ?? 0, gridOf(cur))
    const meta = cifradoMeta(text)
    // Sin letra de LRCLIB: se usa la letra de la propia página de acordes (sin tiempos).
    const ownLyrics = !cur.lyrics ? cifradoLyrics(cif) : ''
    persist({ kind: 'cifrado', cifrado: { events, lines: cif, capo: meta.capo, key: meta.key }, original: segs, corrections: null, duration: dur,
      ...(meta.key ? { key: meta.key } : {}),
      ...(ownLyrics ? { lyrics: { ...pastedLyrics(ownLyrics, cur.filename), source: 'manual' as const, artistName: 'letra de la página de acordes' } } : {}),
      method: cur.lyrics?.synced ? 'acordes del cancionero ubicados con la letra' : 'acordes del cancionero sin letra con tiempos (2 s por acorde: ajustalos)' })
    // Partes de la letra sin ningún acorde: la página no las trae (versión incompleta) → avisar para probar otra versión.
    // Partes que la página no trae: se avisa cuáles quedaron sin acordes y cuáles se completaron copiando una estrofa parecida.
    const synced = cur.lyrics?.synced ?? null
    const missRaw = [...new Set(uncoveredParts(alignCifrado(cif, synced, { fill: false }), synced))]
    const missNow = new Set(uncoveredParts(events, synced))
    const guessed = missRaw.filter((m) => !missNow.has(m)), empty = missRaw.filter((m) => missNow.has(m))
    const q = (xs: string[]) => xs.slice(0, 3).map((m) => `«${m.slice(0, 40)}»`).join(', ')
    const missMsg = [
      guessed.length ? `La página no trae acordes para la parte que empieza con ${q(guessed)}: se completó con los de una estrofa parecida. Revisala.` : '',
      empty.length ? `Quedó sin acordes la parte que empieza con ${q(empty)}. Si la necesitás, probá otra versión de la canción en el cancionero.` : '',
    ].filter(Boolean).join(' ') || null
    setBase(segs); setUndo([]); setSource('analysis'); setFocusIdx(null); setPasteOpen(false); setPasteText(''); setNotice(missMsg); setAdvanced(true)
    return true
  }
  const songbookQuery = () => {
    const cur = songRef.current
    if (cur?.lyrics?.trackName && cur.lyrics.source === 'lrclib') return songbookText(cur.lyrics.trackName, cur.lyrics.artistName)
    if (mode === 'youtube' && yt.title) { const v = parseVideoTitle(yt.title); return songbookText(v.title, v.artist) }
    if (cur?.audio) return cleanTitle(cur.filename)
    return cleanTitle(cur?.filename ?? '') || searchHint
  }
  /** Abre el buscador directamente en la búsqueda de letra de esta canción. */
  function askLyrics() { setLyricsWeb(false); setLyricsOpen((x) => !x); setChordsOpen(false) }
  async function openSongbook() {
    const q = songbookQuery()
    if (!q) { setPasteOpen(true); return }
    setImporting(true)
    try {
      const text = await importFromSongbook(q)
      if (text) importCifrado(text)
    } catch (e) { setNotice(`No se pudo abrir el cancionero: ${(e as Error).message}`) } finally { setImporting(false) }
  }
  /** Ajustes de la letra; si los acordes vienen del cifrado, se corren con ella. */
  function adjustLyrics(a: { offset?: number; anchors?: LyricAnchor[] }) {
    const cur = songRef.current
    if (!cur) return
    const anchors = a.anchors ?? cur.lyricsAnchors ?? [], off = a.offset ?? cur.lyricsOffset ?? 0
    const patch: Partial<Song> = { lyricsOffset: off, lyricsAnchors: anchors }
    if (cur.kind === 'cifrado' && cur.cifrado) {
      const segs = cifradoSegments(cur.cifrado.events, cur.duration, anchors, off, gridOf(cur))
      patch.original = segs
      if (!cur.corrections) setBase(segs)
    }
    persist(patch)
  }
  function searchVideo(q: string) {
    pickYouTube(q).then((id) => {
      if (!id) return
      setSearchHint(q); setWantChords(true); setLyricsTried(false); setSearchOpen(false)
      pickVideo({ id })
    }, (e: Error) => setNotice(`No se pudo abrir YouTube: ${e.message}`))
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
    if (!cur.audio || cur.kind !== 'analysis') { setAdvanced(on); return } // cancionero o marcados: se simplifica al mostrar
    if (on && !cur.advanced) { setNotice('Esta canción se analizó con un motor anterior: tocá «Volver a analizar» para ver los acordes completos.'); return }
    if (cur.corrections) { setNotice('Tenés correcciones guardadas: tocá «Restaurar original» antes de cambiar entre completos y simplificados.'); return }
    setAdvanced(on); setBase(on ? (cur.advanced as Segment[]) : cur.original); setUndo([]); setFocusIdx(null); setNotice(null)
  }
  function loopCycle() {
    if (!loop) setLoop({ start: player.time, end: player.time })
    else if (loop.end <= loop.start) setLoop({ start: loop.start, end: Math.max(player.time, loop.start + 0.5) })
    else setLoop(null)
  }
  async function removeSong(s: Song) {
    if (!window.confirm(`¿Borrar «${s.filename}», sus acordes y el audio guardado en este teléfono?`)) return
    try {
      await deleteSong(s.id)
      if (songRef.current?.id === s.id) { songRef.current = null; setSong(null); setBase([]); setSource('none') }
      void refreshSongs()
    } catch (e) { setNotice((e as Error).message) }
  }
  function selectChord(i: number) { if (stepMode) { setStepIdx(i); return } setFocusIdx(i); player.seek(segments[i].start + eo); player.play() }
  /** El acorde siguiente al `i` (sin contar silencios), o -1. */
  const nextAfter = (segs: Segment[], i: number) => { let j = i + 1; while (j < segs.length && segs[j].chord === 'N') j++; return j < segs.length ? j : -1 }
  function openRetime() {
    setHeld(findActiveIndex(base, Math.max(0, player.time - eo))); heldStack.current = []
    setRetimeOpen(true); setStepMode(false); setChordsOpen(false); setOptsOpen(false); setBarsOpen(false)
  }
  /** «Marcar cambios»: el acorde que sigue al que está quieto en pantalla empieza ahora; lo que viene después se corre igual hasta
   *  el próximo toque. Ningún acorde se pasa solo: aunque la app lo tuviera más corto, sigue en pantalla hasta que se toque. */
  function tapChange() {
    const t = Math.max(0, player.time - eo)
    const j = held >= 0 ? nextAfter(base, held) : nextChange(base, -1)
    if (j < 0) { setNotice('No quedan más cambios de acorde.'); return }
    const next = retimeAt(base, j, t)
    if (!next) { setNotice('Ese toque cae antes del cambio anterior: retrocedé un poco el video y volvé a marcar.'); return }
    const k = next.findIndex((x) => Math.abs(x.start - t) < 0.006 && x.chord === base[j].chord)
    heldStack.current.push(held)
    commit(next); setHeld(k >= 0 ? k : j)
  }
  function undoMark() { undoLast(); setHeld(heldStack.current.pop() ?? -1) }
  useEffect(() => { // si se vuelve atrás en el video mientras se marca, se sigue desde el acorde de ese momento
    if (!retimeOpen || held < 0 || !base[held]) return
    const t = Math.max(0, player.time - eo)
    if (t < base[held].start - 0.3) { setHeld(findActiveIndex(base, t)); heldStack.current = [] }
  }, [player.time, retimeOpen]) // eslint-disable-line react-hooks/exhaustive-deps
  /** Modo «Siguiente» con una secuencia escrita («Am F C G»): se toca acorde por acorde, sin tiempos. */
  function applySequence() {
    const chords = chordSequence(seqText)
    if (!chords.length) { setNotice('No encontré acordes. Escribilos separados por espacios, por ejemplo: Am F C G'); return }
    const segs: Segment[] = chords.map((c, i) => ({ start: i * 2, end: i * 2 + 2, chord: c, confidence: null }))
    let cur = songRef.current ?? (videoId ? ensureVideoSong() : null)
    if (cur?.audio) { setNotice('Esta canción tiene acordes de tu audio; empezá una «Nueva» para escribir una secuencia.'); return }
    if (cur && cur.original.length && !window.confirm('Esta canción ya tiene acordes. ¿Reemplazarlos por la secuencia escrita?')) return
    if (!cur) {
      cur = { id: crypto.randomUUID(), kind: 'manual', filename: seqName.trim() || 'Canción sin título', createdAt: Date.now(), duration: segs.length * 2,
        method: 'secuencia escrita a mano (modo «Siguiente»)', lowConfidence: false, original: segs, corrections: null,
        settings: { videoId: null, transpose: 0, offset: 0, capo: 0, advanced: true }, audio: null, order: topOrder(songs) }
      songRef.current = cur; setSong(cur); setSource('analysis'); setOffset(0); setTranspose(0); setCapo(0)
      saveSong(cur).then(refreshSongs).catch((e: Error) => setNotice(e.message))
    } else persist({ kind: 'manual', original: segs, corrections: null, cifrado: undefined, method: 'secuencia escrita a mano (modo «Siguiente»)', ...(seqName.trim() ? { filename: seqName.trim() } : {}) })
    setBase(segs); setUndo([]); setAdvanced(true); setStepMode(true); setStepIdx(0); setSeqOpen(false); setChordsOpen(false); setNotice(null)
  }
  async function shareSong(s: Song) {
    // Se comparte como texto (.txt): WhatsApp, Gmail y demás rechazan un tipo de archivo desconocido («no es posible compartir este archivo»).
    // El contenido es el mismo y «Importar» lo reconoce por dentro, no por la extensión.
    try { await shareFile(encodeSongs([{ ...s, audio: null }], false), safeName(s.filename) + FILE_EXT + '.txt', `«${s.filename}» de Mi Cancionero. Abrilo en la app: Mi cancionero → Importar.`, 'text/plain') }
    catch (e) { setNotice(`No se pudo compartir: ${(e as Error).message}`) }
  }
  /** Guarda la canción como archivo donde el usuario elija (Descargas, Drive…), sin pasar por otra app. */
  async function saveSongFile(s: Song) {
    try {
      const ok = await saveFile(encodeSongs([{ ...s, audio: null }], false), safeName(s.filename) + FILE_EXT)
      setNotice(ok ? `Archivo de «${s.filename}» guardado.` : null)
    } catch (e) { setNotice(`No se pudo guardar el archivo: ${(e as Error).message}`) }
  }
  async function backupAll() {
    setFileBusy('Preparando la copia…')
    try {
      const all = await listSongs()
      const d = new Date(), name = `mi-cancionero-copia-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}${FILE_EXT}`
      const ok = await saveFile(encodeSongs(all, true), name, (p) => setFileBusy(`Guardando la copia… ${Math.round(p * 100)}%`))
      setNotice(ok ? `Copia de seguridad guardada (${all.length} canciones, con sus audios).` : null)
    } catch (e) { setNotice(`No se pudo guardar la copia: ${(e as Error).message}`) } finally { setFileBusy(null) }
  }
  async function importSongs(f: File) {
    setFileBusy('Leyendo el archivo…')
    try {
      const incoming = await decodeSongs(f)
      const restore = incoming.length > 1 || /copia/i.test(f.name)
      const add = songsToAdd(await listSongs(), incoming, restore ? 'restore' : 'share', () => crypto.randomUUID())
      for (const s of add) await saveSong(s)
      await refreshSongs()
      setNotice(add.length ? `Se agregaron ${add.length} ${add.length === 1 ? 'canción' : 'canciones'} a Mi cancionero.` : 'Esas canciones ya estaban en tu cancionero.')
    } catch (e) { setNotice((e as Error).message) } finally { setFileBusy(null) }
  }
  importRef.current = (f: File) => { void importSongs(f) }
  const fileNow = () => Math.max(0, player.time - eo)

  function applyChord(raw: string) {
    if (shownIdx === null) return
    const name = raw.trim()
    if (!CHORD_OK.test(name)) { setNotice(`«${name}» no es un acorde admitido (mayor, menor, séptima o N).`); return }
    commit(setChordAt(base, shownIdx, name === 'N' ? 'N' : transposeChord(name, capo - transpose)))
  }

  const hasMedia = !!(videoId || audioUrl)
  useEffect(() => {
    if (!wantChords || !hasWebPicker() || !videoId || importing) return
    const ready = (song?.lyrics && song.settings.videoId === videoId) || (lyricsTried && !lyricCands)
    if (!ready) return
    if (song?.audio || song?.kind === 'cifrado') { setWantChords(false); return }
    setWantChords(false)
    void openSongbook()
  }, [wantChords, song?.lyrics, lyricsTried, lyricCands, videoId]) // eslint-disable-line react-hooks/exhaustive-deps
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
    const want = mode === 'youtube' ? parseVideoTitle(yt.title || searchHint) : { ...parseVideoTitle(lyrName), artist: parseVideoTitle(lyrName).artist }
    const queries = [...new Set([want.query, want.title].map((x) => x.trim()).filter((x) => x.length >= 3))]
    if (!queries.length) return
    const attempt = async (q: string) => { try { return await searchLyrics(q) } catch { await new Promise((r) => setTimeout(r, 1500)); return searchLyrics(q) } }
    void (async () => {
      let pool: LR[] = [], failed = false
      for (const q of queries) {
        let res: LR[] = []
        try { res = await attempt(q) } catch { failed = true; continue }
        if (lyricAsked.current !== key) return
        pool = pool.concat(res)
        // se elige sola solo si coincide el título y además el artista o la duración (±3 s); si no, se ofrece la lista
        const sure = pickConfident(res, want, lyrDur)
        if (sure) { attachLyrics(sure); setLyricsTried(true); return }
      }
      if (lyricAsked.current !== key) return
      const ranked = rankResults(pool, want.query, lyrDur).slice(0, 3)
      if (!ranked.length && want.artist) { // segunda fuente: solo texto, se ofrece para elegir
        const alt = await searchPlainLyrics(want.artist, want.title)
        if (lyricAsked.current !== key) return
        if (alt) ranked.push(alt)
      }
      setLyricCands(ranked.length ? ranked : null)
      setLyricsNote(ranked.length ? null : failed ? 'No se pudo buscar la letra (LRCLIB no respondió).' : 'No encontré la letra de esta canción.')
      setLyricsTried(true)
    })()
  }, [wantsLyrics, lyrName, lyrDur, song?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const small = 'btn'
  const box = 'card'
  const fmtDur = (d: number) => `${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, '0')}`
  const fileTime = player.time - eo
  const viewTime = fileTime + ahead // lo que se muestra (con anticipación opcional)
  const taps = useMemo(() => tapOnes(song?.taps), [song?.taps]) // eslint-disable-line react-hooks/exhaustive-deps
  const bpb = taps?.bpb ?? song?.beatsPerBar ?? 4
  const gridBeats = useMemo(() => {
    const dur = song?.duration || player.duration || 0
    if (taps) { // pulsos marcados; antes y después de lo marcado se sigue con el mismo largo de compás
      const b = taps.bars, n = b.length, d0 = (b[1] - b[0]) / taps.bpb, d1 = (b[n - 1] - b[n - 2]) / taps.bpb
      const pre: number[] = []; for (let t = b[0] - d0 * taps.bpb; t > -d0 * taps.bpb; t -= d0 * taps.bpb) pre.unshift(t)
      const post: number[] = []; for (let t = b[n - 1] + d1 * taps.bpb; t < dur + d1 * taps.bpb; t += d1 * taps.bpb) post.push(t)
      return gridFromBars([...pre, ...b, ...post], taps.bpb).map(([t]) => t)
    }
    return song?.beats?.length ? song.beats : estimateBeats(segments, dur)
  }, [taps, song?.beats, segments, song?.duration, player.duration])
  const gridDownbeat = taps ? 0 : song?.beats?.length ? song.downbeat ?? 0 : 0
  const bpos = taps || song?.beats?.length ? beatPosition(gridBeats, viewTime, gridDownbeat, bpb) : null
  const info = [song?.key && `Tonalidad: ${song.key}${song.kind === 'cifrado' ? ' (según la página)' : ''}`,
    song?.cifrado?.capo && `la página indica cejilla en el ${song.cifrado.capo}: los acordes ya están escritos para tocar con esa cejilla`, song?.bpm && `≈ ${Math.round(song.bpm)} bpm`, bpos && `compás ${bpos.bar}, tiempo ${bpos.inBar + 1} (${taps ? `pulso marcado, ${taps.meter ?? `${taps.bpb} tiempos`}` : 'estimado, 4/4'})`].filter(Boolean).join(' · ')
  const nowTitle = song?.lyrics?.source === 'lrclib' ? song.lyrics.trackName : song?.filename ?? (mode === 'youtube' ? yt.title : audioName)
  const nowArtist = song?.lyrics?.source === 'lrclib' ? song.lyrics.artistName : ''
  const latest = songs.slice(0, 4)
  return (
    <div className="flex h-[100dvh] flex-col">
      <Splash />
      <Songbook open={drawer} songs={songs} currentId={song?.id ?? null} onClose={() => setDrawer(false)} onOpen={(x) => openSong(x)} onNew={newSong}
        onDelete={removeSong} onRename={renameSong} onReorder={reorderSongs} onShare={shareSong} onSaveFile={saveSongFile} onBackup={backupAll} onImport={importSongs} busy={fileBusy} />
      <header className="max-h-[42vh] shrink-0 space-y-2 overflow-y-auto bg-bg px-3 pb-2" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1">
            <button onClick={() => setDrawer(true)} className="icon-btn" aria-label="Abrir Mi cancionero"><Icon name="menu" /></button>
            <Notebook size={22} className="shrink-0" />
            <h1 className="truncate pl-1 text-lg font-extrabold tracking-tight">Mi Cancionero</h1>
          </div>
          <div className="flex shrink-0 items-center">
            {installEvt && <button className="btn mr-1" onClick={() => installEvt.prompt?.()}>Instalar</button>}
            <button className="icon-btn" onClick={newSong} disabled={!!job} aria-label="Nueva canción" title="Nueva canción"><Icon name="plus" /></button>
            <button onClick={() => setSearchOpen((x) => !x)} className={`icon-btn ${searchOpen ? 'bg-panel2' : ''}`} aria-label="Buscar canción" aria-expanded={searchOpen}><Icon name="search" /></button>
            <button onClick={() => setSettings((x) => !x)} className={`icon-btn ${settings ? 'bg-panel2' : ''}`} aria-label="Ajustes" aria-expanded={settings}><Icon name="gear" /></button>
          </div>
        </div>
        {settings && (
          <div className="card flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Tema oscuro</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={easyOnly} onChange={(e) => setEasyOnly(e.target.checked)} /> Priorizar posiciones sin cejilla completa</label>
            <div className="flex items-center gap-2">
              <span>Mostrar los cambios antes:</span>
              <button className={small} onClick={() => setAhead((a) => Math.max(0, Math.round((a - 0.05) * 100) / 100))}>−</button>
              <span className="w-14 text-center">{ahead.toFixed(2)} s</span>
              <button className={small} onClick={() => setAhead((a) => Math.min(0.5, Math.round((a + 0.05) * 100) / 100))}>+</button>
            </div>
            <p className="w-full text-xs text-mute">Versión {APP_VERSION} · Idea y diseño: Agustín Salazar · Hecha con Claude · Uruguay</p>
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
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-panel2 p-2 text-xs">{testReport}</pre>
                <button className={small} onClick={() => navigator.clipboard?.writeText(testReport).catch(() => undefined)}>Copiar resultados</button>
              </>}
            </div>
            <label className="w-full">Clave propia de YouTube Data API v3 (opcional, solo para buscar; se guarda solo en este teléfono)
              <input value={ytKey} onChange={(e) => setYtKey(e.target.value.trim())} autoComplete="off" className="field mt-1 w-full" /></label>
          </div>
        )}
        {searchOpen && <SearchPanel key={searchKey} onPick={(v) => { setSearchHint(""); setWantChords(hasWebPicker()); setLyricsTried(false); pickVideo(v); setSearchOpen(false) }} onLyrics={attachLyrics} onVideoSearch={searchVideo} recent={recent} apiKey={ytKey} />}
      </header>

      <main className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3 pt-1">
        {(hasMedia || song) && nowTitle && (
          <div className="flex items-baseline gap-2 text-sm" aria-label="Canción actual">
            <span className="min-w-0 truncate font-semibold">{nowTitle}</span>
            {nowArtist && <span className="shrink-0 truncate text-mute">{nowArtist}</span>}
            {stepMode && <span className="chip ml-auto shrink-0">modo Siguiente</span>}
          </div>)}
        {source === 'demo' && <p className="rounded-xl bg-accent/20 p-2 text-sm font-semibold">DEMOSTRACIÓN: acordes de ejemplo, no corresponden al video ni a un análisis real.</p>}
        {notice && <p role="alert" className="rounded-xl bg-red-500/10 p-2 text-sm text-red-400">{notice}</p>}
        {fileBusy && <p role="status" className="text-sm text-mute">{fileBusy}</p>}
        {segments.length > 0 && <>
          {!stepMode && <BeatGrid segments={segments} beats={gridBeats} downbeat={gridDownbeat} bpb={bpb} time={viewTime} hideNames={hideNames} marked={!!taps} onSeek={(t) => { if (hasMedia) player.seek(Math.max(0, t + eo)) }} />}
          <ChordStrip segments={segments} activeIndex={activeIndex} time={stepMode ? segments[activeIndex]?.start ?? 0 : viewTime} hideNames={hideNames} easyOnly={easyOnly}
            alt={alt} onAlt={(c) => setAlt((a) => ({ ...a, [c]: (a[c] ?? 0) + 1 }))} onSelect={selectChord} />
        </>}
        {stepMode && segments.length > 0 && (
          <div className="grid grid-cols-[auto_1fr] gap-2" role="group" aria-label="Modo Siguiente">
            <button className="btn h-16 px-5" disabled={activeIndex <= 0} onClick={() => setStepIdx((i) => Math.max(0, i - 1))} aria-label="Acorde anterior"><Icon name="prev" /></button>
            <button className="btn-primary h-16 text-lg" disabled={activeIndex >= segments.length - 1} onClick={() => setStepIdx((i) => Math.min(segments.length - 1, i + 1))}>
              Siguiente{segments[activeIndex + 1] ? `: ${hideNames ? '?' : segments[activeIndex + 1].chord}` : ''} <Icon name="next" /></button>
            <p className="col-span-2 text-center text-xs text-mute">Acorde {activeIndex + 1} de {segments.length}{activeIndex >= segments.length - 1 ? ' · fin' : ''}</p>
          </div>)}
        {retimeOpen && !stepMode && segments.length > 0 && hasMedia && (() => {
          const j = held >= 0 ? nextAfter(base, held) : nextChange(base, -1)
          const nm = (i: number) => (hideNames ? '?' : segments[i]?.chord === 'N' ? '—' : segments[i]?.chord ?? '')
          return (
            <section className="card space-y-2" aria-label="Marcar cambios">
              <p className="text-xs text-mute">Dale play. El acorde queda quieto hasta que toques el botón: tocalo justo cuando la canción cambia al siguiente.
                Así no se te pasa ninguno, aunque en la app durara menos. Si te equivocás, «Deshacer» o volvé el video atrás. Se guarda en tu cancionero.</p>
              <p className="text-center text-sm">Suena: <b className="text-lg">{held >= 0 ? nm(held) : '—'}</b></p>
              <button className="btn-primary h-20 w-full text-2xl" disabled={j < 0} onClick={tapChange}>
                <Icon name="tap" className="h-6 w-6" /> {j < 0 ? 'No hay más cambios' : `Cambia a ${nm(j)}`}</button>
              <div className="flex gap-2 whitespace-nowrap">
                {!player.playing && <button className="btn flex-1" onClick={player.play}>▶ Play</button>}
                <button className="btn flex-1" onClick={undoMark} disabled={!undo.length}>Deshacer</button>
                <button className="btn flex-1" onClick={() => setRetimeOpen(false)}>Listo</button>
              </div>
            </section>)
        })()}
        {barsOpen && song?.cifrado && hasMedia && (
          <section className="card space-y-2" aria-label="Marcar pulso">
            <h2 className="font-semibold">Marcar pulso</h2>
            <p className="text-xs text-mute">Elegí el compás, dale play y tocá el botón grande al ritmo: en cada golpe, o solo en el «uno» de cada compás
              (el golpe fuerte). Empezá a marcar en un «uno». Marcá toda la canción o la parte que quieras: los acordes se acomodan a tiempos completos. Si te equivocás, «Deshacer».
              Si no sabés el compás, dejá 4/4 (vals: 3/4; zamba y chacarera: 6/8; milonga: 2/4).</p>
            <button className="btn-primary h-20 w-full text-2xl" onClick={() => setBarTaps((b) => [...b, fileNow()])}>
              <Icon name="tap" className="h-6 w-6" /> Golpe · {barTaps.length} marcado{barTaps.length === 1 ? '' : 's'}</button>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-mute">Compás:</span>
              {Object.keys(METERS).map((m) => <button key={m} className={`btn min-h-9 px-3 ${barMeter === m ? 'bg-accent text-accent-fg' : ''}`} aria-pressed={barMeter === m} onClick={() => setBarMeter(m)}>{m}</button>)}
            </div>
            <div className="flex flex-wrap gap-2 whitespace-nowrap">
              {!player.playing && <button className="btn flex-1" onClick={player.play}>▶ Play</button>}
              <button className="btn flex-1" disabled={!barTaps.length} onClick={() => setBarTaps((b) => b.slice(0, -1))}>Deshacer</button>
              <button className="btn flex-1" disabled={!barTaps.length && !song.taps} onClick={() => { setBarTaps([]); if (song.taps) applyBars([], barMeter) }}>Borrar marcas</button>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={barTaps.length < 2} onClick={() => { applyBars(barTaps, barMeter); setBarsOpen(false) }}>Listo: acomodar acordes</button>
              <button className="btn flex-1" onClick={() => setBarsOpen(false)}>Cancelar</button>
            </div>
          </section>)}
        {shownLyrics && !stepMode && <LyricsView lyrics={shownLyrics} followsChords={!!chordLyrics} time={viewTime} offset={chordLyrics ? 0 : song?.lyricsOffset ?? 0} anchors={chordLyrics ? [] : song?.lyricsAnchors ?? []}
          onAdjust={adjustLyrics} onSeek={(t) => { if (hasMedia) player.seek(Math.max(0, t + eo)) }} onRemove={() => persist({ lyrics: null, lyricsAnchors: [] })}
          onChange={() => { setLyricsOpen(true); setChordsOpen(false) }} />}
        {song?.lyrics?.duration && player.duration > 0 && Math.abs(song.lyrics.duration - player.duration) > 6 && !(song.lyricsAnchors?.length) && !stepMode && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-mute">La letra encontrada es de otra grabación ({fmtDur(song.lyrics.duration)}; esta dura {fmtDur(player.duration)}): puede ir adelantada o atrasada.
            <button className={small} onClick={() => song.lyrics?.synced && adjustLyrics({ offset: 0, anchors: fitAnchors(song.lyrics.synced, song.lyrics.duration ?? 0, player.duration) })}>Ajustar la letra a esta grabación</button>
            <span>Después, si hace falta, «⚙ Ajustar letra» → «Esta línea empieza ahora».</span></p>)}
        {lyricCands && !song?.lyrics && !lyricsOpen && (
          <section className={box}>
            <h2 className="text-sm font-semibold">¿Es alguna de estas letras?</h2>
            <ul className="mt-1 space-y-1">{lyricCands.map((r) => (
              <li key={r.id}><button className="w-full rounded-xl bg-panel2 p-2 text-left text-sm" onClick={() => attachLyrics(r)}>
                <b>{r.trackName}</b> · {r.artistName}{r.duration ? ` · ${Math.floor(r.duration / 60)}:${String(Math.round(r.duration % 60)).padStart(2, '0')}` : ''}{r.syncedLyrics ? '' : ' · sin tiempos'}</button></li>))}
            </ul>
            <div className="mt-2 flex gap-2">
              <button className={small} onClick={() => { setLyricCands(null); setLyricsWeb(false); setLyricsOpen(true) }}>Ninguna: buscar otra</button>
              <button className={small} onClick={() => { setLyricCands(null); setLyricsWeb(true); setLyricsOpen(true) }}>Buscar en una página</button>
              <button className={small} onClick={() => { setLyricCands(null); if (songRef.current) persist({ lyrics: null }) }}>Sin letra</button>
            </div>
          </section>)}
        {lyricsNote && !song?.lyrics && !chordLyrics && !lyricCands && !lyricsOpen && <p className="flex flex-wrap items-center gap-2 text-sm text-mute">{lyricsNote}
          {song?.cifrado?.lines?.some((l) => l.text.trim()) && <button className="btn-primary" onClick={() => persist({ lyrics: { ...pastedLyrics(cifradoLyrics(song.cifrado!.lines!), song.filename), source: 'manual', artistName: 'letra de la página de acordes' }, lyricsOffset: 0, lyricsAnchors: [] })}>Usar la letra de la página de acordes</button>}
          <button className={small} onClick={() => { setLyricsWeb(true); setLyricsOpen(true); setChordsOpen(false) }}>Buscar la letra en una página</button>
          <button className={small} onClick={() => { setLyricsWeb(false); setLyricsOpen(true); setChordsOpen(false) }}>Pegar o buscar de nuevo</button></p>}

        {(hasMedia || song) && (
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-panel p-1" role="group" aria-label="Acciones">
            {([
              ['lyrics', 'Letra', lyricsOpen, askLyrics],
              ['chords', 'Acordes', chordsOpen, () => { setChordsOpen((x) => !x); setLyricsOpen(false) }],
              ['more', optsOpen ? 'Ocultar' : '⋯ Opciones', optsOpen, () => setOptsOpen((x) => !x)],
            ] as const).map(([ic, label, on, fn]) => (
              <button key={ic} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition active:scale-95 ${on ? 'bg-accent text-accent-fg' : 'text-mute'}`}
                onClick={fn} aria-expanded={on} aria-label={label}><Icon name={ic} />{label === '⋯ Opciones' ? 'Opciones' : label}</button>))}
          </div>)}
        {lyricsOpen && <LyricsSearch key={`${searchKey}-${song?.id ?? ''}`} initial={songbookQuery()} onPick={attachLyrics} onPaste={pasteLyrics} autoWeb={lyricsWeb} onClose={() => { setLyricsOpen(false); setLyricsWeb(false) }} />}
        {(chordsOpen || (!segments.length && (hasMedia || song) && !lyricsOpen && !seqOpen)) && (
          <section className={`${box} space-y-3`} aria-label="Acordes">
            <h2 className="font-semibold">{segments.length ? 'Acordes' : 'Sin acordes todavía'}</h2>
            <div className="flex flex-wrap gap-2">
              {!song?.audio && hasWebPicker() && <button className="btn-primary" disabled={importing} onClick={() => void openSongbook()}>{importing ? 'Abriendo…' : 'Buscar en cancioneros'}</button>}
              {!song?.audio && !hasWebPicker() && songbookQuery() && <a className={small} href={songbookSearchUrl(songbookQuery())} target="_blank" rel="noreferrer">Buscar cifrado ↗</a>}
              {!song?.audio && <button className={small} onClick={() => setPasteOpen((x) => !x)}>Pegar cifrado</button>}
              {!song?.audio && <button className={small} onClick={() => { setSeqOpen(true); setChordsOpen(false) }}>Escribir acordes</button>}
              {segments.length > 0 && hasMedia && <button className={small} onClick={openRetime}>Marcar los cambios a mano</button>}
              {song?.kind === 'cifrado' && song.lyrics?.synced && hasMedia && <button className={small} onClick={() => { setBarTaps(song.taps?.bars ?? []); setBarMeter(song.taps?.meter ?? (song.taps?.bpb === 3 ? '3/4' : '4/4')); setBarsOpen(true); setRetimeOpen(false); setStepMode(false); setChordsOpen(false) }}>Marcar pulso{song.taps ? ' ✓' : ''}</button>}
            </div>
            {segments.length > 0 && hasMedia && <p className="text-xs text-mute">¿Algún acorde cae a destiempo? «Marcar los cambios a mano»: tocás un botón en cada cambio mientras suena y queda guardado.</p>}
          </section>)}
        {seqOpen && (
          <section className={`${box} space-y-2`} aria-label="Escribir acordes">
            <h2 className="font-semibold">Escribir la secuencia de acordes</h2>
            <p className="text-xs text-mute">Para canciones sin cifrado: escribí los acordes en orden y tocá «Siguiente» en cada cambio mientras tocás. No hace falta el tiempo.</p>
            {!song && <input value={seqName} onChange={(e) => setSeqName(e.target.value)} placeholder="Nombre de la canción" aria-label="Nombre de la canción" className="field w-full" />}
            <textarea value={seqText} onChange={(e) => setSeqText(e.target.value)} rows={4} placeholder={'Am F C G\nAm F E'} aria-label="Secuencia de acordes escrita"
              className="field w-full py-2 font-mono text-sm" />
            <div className="flex gap-2">
              <button className="btn-primary" disabled={!seqText.trim()} onClick={applySequence}>Usar en modo Siguiente</button>
              <button className={small} onClick={() => setSeqOpen(false)}>Cerrar</button>
            </div>
          </section>)}
        {pasteOpen && (
          <section className={box}>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={8} placeholder={'Pegá la letra con los acordes arriba, por ejemplo:\nAm          G\nPrimera línea de la canción'}
              className="field w-full py-2 font-mono text-xs" aria-label="Cifrado" />
            <div className="mt-2 flex gap-2">
              <button className="btn-primary" disabled={!pasteText.trim()} onClick={() => { if (importCifrado(pasteText)) setChordsOpen(false) }}>Usar estos acordes</button>
              <button className={small} onClick={() => setPasteOpen(false)}>Cerrar</button>
            </div>
          </section>)}

        {optsOpen && (
          <section className={`${box} space-y-2 text-sm`} aria-label="Opciones">
            <details className="rounded-xl bg-panel2 p-2" open>
              <summary className="min-h-9 cursor-pointer font-semibold">Para tocar</summary>
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Stepper label="Transponer" value={transpose} fmt={(v) => (v > 0 ? `+${v}` : `${v}`)} onDec={() => setTranspose((t) => Math.max(-11, t - 1))} onInc={() => setTranspose((t) => Math.min(11, t + 1))} />
                  <Stepper label="Cejilla (traste)" value={capo} fmt={(v) => (v ? `${v}` : 'sin')} onDec={() => setCapo((c) => Math.max(0, c - 1))} onInc={() => setCapo((c) => Math.min(11, c + 1))} />
                  <label className="flex items-center gap-2 rounded-xl bg-panel p-2"><input type="checkbox" checked={!advanced} disabled={!song || (song.kind === 'analysis' && !!song.audio && !song.advanced)} onChange={(e) => toggleAdvanced(!e.target.checked)} /> Acordes simplificados</label>
                  <label className="flex items-center gap-2 rounded-xl bg-panel p-2"><input type="checkbox" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} /> Ocultar nombres</label>
                  <label className="col-span-2 flex items-center gap-2 rounded-xl bg-panel p-2"><input type="checkbox" checked={stepMode} disabled={!segments.length}
                    onChange={(e) => { setStepMode(e.target.checked); setStepIdx(Math.max(0, findActiveIndex(segments, player.time, eo))); setRetimeOpen(false) }} /> Modo Siguiente: avanzar acorde por acorde con un toque (sin seguir el tiempo)</label>
                </div>
                {capo > 0 && <p className="text-xs text-mute">Con cejilla en el traste {capo} se muestran las formas a tocar; el sonido sigue siendo el de la canción.</p>}
                {hasMedia && <PlayExtras onSeek={player.seek} onSkip={player.skip} onVolume={player.setVolume} rate={rate} rates={mode === 'audio' ? AUDIO_RATES : YT_RATES}
                  onRate={(r) => { setRate(r); player.setRate(r) }} loop={loop} onLoopCycle={loopCycle} />}
              </div>
            </details>
            <details className="rounded-xl bg-panel2 p-2">
              <summary className="min-h-9 cursor-pointer font-semibold">Editar un acorde</summary>
              <div className="mt-2 space-y-3">
                {seg && shownIdx !== null && source !== 'none' ? (
                  <div><h3 className="mb-2 font-semibold">Editar acorde {shownIdx + 1}</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="col-span-3">Acorde (ej. Am, F#, E7, Dsus4, N)
                        <input key={`c${shownIdx}${seg.chord}`} defaultValue={seg.chord} onBlur={(e) => e.target.value.trim() !== seg.chord && applyChord(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className="field mt-1 w-full" /></label>
                      <button className={small} onClick={() => commit(moveStart(base, shownIdx, fileTime))}>Inicio = ahora</button>
                      <button className={small} onClick={() => commit(moveEnd(base, shownIdx, fileTime))}>Fin = ahora</button>
                      <button className={small} onClick={() => commit(splitAt(base, shownIdx, fileTime))}>Dividir aquí</button>
                      <button className={small} onClick={() => commit(removeAt(base, shownIdx))}>Eliminar</button>
                      <button className={small} onClick={undoLast} disabled={!undo.length}>Deshacer</button>
                      {original && song?.kind !== 'manual' && <button className={small} onClick={restore}>Restaurar original</button>}
                    </div>
                  </div>) : <p className="text-xs text-mute">Tocá un acorde del carrusel para editarlo.</p>}
              </div>
            </details>
            <details className="rounded-xl bg-panel2 p-2">
              <summary className="min-h-9 cursor-pointer font-semibold">Otros</summary>
              <div className="mt-2 space-y-2">
                {song?.audio && song.kind !== 'manual' && song.method !== NMETHOD && !job && (
                  <p className="text-xs">Esta canción se analizó con un motor anterior. <button className="underline" onClick={() => song.audio && pickFile(new File([song.audio], song.filename, { type: song.audio.type || 'audio/mpeg' }), song)}>Volver a analizar con el motor nuevo</button> (se conservan la letra y el video; se pierden las correcciones de acordes).</p>)}
                {source === 'analysis' && song && <p className="text-xs text-mute">«{song.filename}» · {song.method}.{info ? ` ${info}.` : ''}{song.lowConfidence && ' Confianza media baja: revisá los acordes marcados con ≈.'}</p>}
                {song && <button className={small} onClick={() => void shareSong(song)}><Icon name="share" className="h-4 w-4" /> Compartir esta canción</button>}
                {song && <button className={small} onClick={() => void saveSongFile(song)}>Guardar archivo de esta canción</button>}
                <button className={small} onClick={() => setDrawer(true)}>Ver Mi cancionero ({songs.length})</button>
              </div>
            </details>
          </section>)}
        {!hasMedia && !song && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-col items-center py-2 text-center">
              <Notebook size={64} />
              <p className="mt-2 text-xl font-extrabold">¿Qué tocamos hoy?</p>
              <p className="text-sm text-mute">Buscá una canción arriba o analizá un audio tuyo.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="card flex flex-col items-start gap-1 text-left transition active:scale-95" onClick={() => { setSearchOpen(true); setTimeout(() => document.querySelector<HTMLInputElement>('input[aria-label="Buscar canción"]')?.focus(), 50) }}>
                <Icon name="search" className="h-6 w-6 text-accent" /><b>Buscar en YouTube</b><span className="text-xs text-mute">Elegí el video y traigo la letra y los acordes</span></button>
              <button className="card flex flex-col items-start gap-1 text-left transition active:scale-95" onClick={() => setSeqOpen(true)}>
                <Icon name="chords" className="h-6 w-6 text-accent" /><b>Escribir acordes</b><span className="text-xs text-mute">Para canciones sin cifrado: modo Siguiente</span></button>
            </div>
            <section className="card space-y-2">
              <h2 className="font-semibold">Analizar mi MP3</h2>
              <AudioPanel job={job} error={jobErr} onFile={pickFile} onCancel={() => cancelRef.current?.()} />
            </section>
            {latest.length > 0 && (
              <section className="space-y-1">
                <h2 className="px-1 text-sm font-semibold text-mute">Últimas canciones</h2>
                {latest.map((x) => (
                  <button key={x.id} className="card flex w-full items-center gap-3 py-2 text-left transition active:scale-[.98]" onClick={() => openSong(x)}>
                    <Notebook size={20} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{x.filename}</span>
                    <Icon name="next" className="h-4 w-4 text-mute" />
                  </button>))}
              </section>)}
          </div>)}
      </main>

      <footer className="shrink-0 bg-panel px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_16px_rgba(0,0,0,.18)]">
        {videoId && audioUrl && (
          <div className="mb-1 flex gap-1 text-xs" role="group" aria-label="Fuente de reproducción">
            <button className={`min-h-8 rounded-full px-3 ${mode === 'audio' ? 'bg-accent text-accent-fg' : 'bg-panel2 text-mute'}`} onClick={() => setMode('audio')}>Mi archivo</button>
            <button className={`min-h-8 rounded-full px-3 ${mode === 'youtube' ? 'bg-accent text-accent-fg' : 'bg-panel2 text-mute'}`} onClick={() => setMode('youtube')}>Video</button>
          </div>
        )}
        {player.error && <p role="alert" className="text-sm text-red-500">{player.error}{mode === 'youtube' && videoId && <> <a className="underline" href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer">Abrir en YouTube</a></>}</p>}
        {hasMedia ? (
          <Controls time={player.time} duration={player.duration} playing={player.playing} onPlay={player.play} onPause={player.pause} onSeek={player.seek}>
            <div className={`aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-black ${mode === 'audio' || !videoId ? 'hidden' : ''}`} ref={yt.hostRef} />
          </Controls>
        ) : <p className="py-2 text-center text-sm text-mute">{song ? 'Modo Siguiente: tocá «Siguiente» en cada cambio.' : 'Buscá una canción o elegí un MP3/WAV para empezar.'}</p>}
      </footer>
    </div>
  )
}

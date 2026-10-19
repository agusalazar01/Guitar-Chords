import { useEffect, useRef, useState } from 'react'
import type { Song } from '../lib/songs.ts'

/** «Mi cancionero»: panel lateral con todas las canciones guardadas. Se reordena arrastrando la manija ⠿ o con ↑ ↓. */
export default function Songbook({ open, songs, currentId, onClose, onOpen, onNew, onDelete, onRename, onReorder }: {
  open: boolean; songs: Song[]; currentId: string | null
  onClose: () => void; onOpen: (s: Song) => void; onNew: () => void; onDelete: (s: Song) => void
  onRename: (s: Song, name: string) => void; onReorder: (list: Song[]) => void
}) {
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [list, setList] = useState(songs)
  const [dragId, setDragId] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  useEffect(() => { if (!dragId) setList(songs) }, [songs, dragId])
  useEffect(() => { // cerrar con «Atrás» del teclado / Escape
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  const q = filter.trim().toLowerCase()
  const shown = q ? list.filter((s) => `${s.filename} ${s.lyrics?.artistName ?? ''}`.toLowerCase().includes(q)) : list
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= list.length) return
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]]
    setList(next); onReorder(next)
  }
  // Arrastre con el dedo: se mueve el elemento según la posición vertical sobre los demás.
  const onPointerMove = (e: { clientY: number }) => {
    if (!dragId || !listRef.current) return
    const items = [...listRef.current.querySelectorAll<HTMLElement>('[data-song]')]
    const from = list.findIndex((s) => s.id === dragId)
    let to = items.findIndex((el) => { const r = el.getBoundingClientRect(); return e.clientY < r.top + r.height / 2 })
    if (to < 0) to = list.length - 1
    else if (to > from) to -= 1
    if (to === from || from < 0) return
    const next = [...list]; const [it] = next.splice(from, 1); next.splice(to, 0, it)
    setList(next)
  }
  useEffect(() => { // soltar fuera de la lista también termina el arrastre
    if (!dragId) return
    const up = () => { setDragId(null); onReorder(list) }
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
  }, [dragId, list, onReorder])

  const tag = (s: Song) => [s.audio ? 'audio analizado' : s.kind === 'cifrado' ? 'acordes del cancionero' : s.original.length ? 'acordes marcados' : 'sin acordes', s.lyrics ? (s.lyrics.synced ? 'letra' : 'letra sin tiempos') : null, s.settings.videoId ? 'video' : null].filter(Boolean).join(' · ')
  const small = 'min-h-10 min-w-10 rounded-lg border border-line px-2 text-sm'
  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside role="dialog" aria-label="Mi cancionero"
        className={`absolute inset-y-0 left-0 flex w-[min(92vw,26rem)] flex-col border-r border-line bg-bg shadow-xl transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)' }}>
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <h2 className="text-lg font-extrabold">Mi cancionero</h2>
          <button className={small} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="space-y-2 px-3 py-2">
          <button className="min-h-11 w-full rounded-lg bg-accent font-semibold text-accent-fg" onClick={() => { onNew(); onClose() }}>+ Nueva canción</button>
          {list.length > 4 && <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar por título o artista" aria-label="Filtrar canciones"
            className="min-h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm" />}
        </div>
        {!list.length && <p className="px-3 text-sm text-mute">Todavía no hay canciones. Buscá una por su nombre, elegí un video o analizá un MP3: todo lo que cargues queda acá, en este teléfono, hasta que lo borres.</p>}
        <ul ref={listRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3" onPointerMove={onPointerMove}
          style={{ touchAction: dragId ? 'none' : 'auto' }}>
          {shown.map((s) => {
            const i = list.indexOf(s)
            return (
              <li key={s.id} data-song className={`flex items-center gap-1 rounded-lg border p-1 ${s.id === currentId ? 'border-accent bg-accent/10' : 'border-line bg-panel'} ${dragId === s.id ? 'opacity-70 shadow-lg' : ''}`}>
                {!q && <span role="button" aria-label={`Mover ${s.filename}`} className="grid min-h-10 w-8 cursor-grab touch-none place-items-center text-mute"
                  onPointerDown={(e: { currentTarget: HTMLElement; pointerId: number }) => { e.currentTarget.releasePointerCapture?.(e.pointerId); setDragId(s.id) }}>⠿</span>}
                {editing === s.id ? (
                  <input autoFocus defaultValue={s.filename} aria-label="Nuevo nombre" className="min-h-10 min-w-0 flex-1 rounded border border-line bg-bg px-2 text-sm"
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.filename) onRename(s, v); setEditing(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null) }} />
                ) : (
                  <button className="min-h-10 min-w-0 flex-1 text-left" onClick={() => { onOpen(s); onClose() }}>
                    <span className="block truncate text-sm font-semibold">{s.filename}</span>
                    <span className="block truncate text-xs text-mute">{tag(s)}</span>
                  </button>
                )}
                {!q && <>
                  <button className={small} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                  <button className={small} onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Bajar">↓</button>
                </>}
                <button className={small} onClick={() => setEditing(s.id)} aria-label={`Renombrar ${s.filename}`}>✎</button>
                <button className={small} onClick={() => onDelete(s)} aria-label={`Borrar ${s.filename}`}>🗑</button>
              </li>
            )
          })}
        </ul>
      </aside>
    </div>
  )
}

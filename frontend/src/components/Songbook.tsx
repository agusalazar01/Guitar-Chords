import { useEffect, useRef, useState } from 'react'
import type { Song } from '../lib/songs.ts'
import { Icon, Mate } from './Art.tsx'

/** «Mi cancionero»: panel lateral con todas las canciones guardadas. Se reordena arrastrando la manija ⠿ o con ↑ ↓. */
export default function Songbook({ open, songs, currentId, onClose, onOpen, onNew, onDelete, onRename, onReorder, onShare, onBackup, onImport, busy }: {
  open: boolean; songs: Song[]; currentId: string | null
  onClose: () => void; onOpen: (s: Song) => void; onNew: () => void; onDelete: (s: Song) => void
  onRename: (s: Song, name: string) => void; onReorder: (list: Song[]) => void
  onShare: (s: Song) => void; onBackup: () => void; onImport: (f: File) => void; busy: string | null
}) {
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [menu, setMenu] = useState<string | null>(null) // acciones de una canción (⋯)
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
  const small = 'grid min-h-10 min-w-9 place-items-center rounded-lg px-1 text-sm text-mute active:scale-90 disabled:opacity-30'
  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside role="dialog" aria-label="Mi cancionero"
        className={`absolute inset-y-0 left-0 flex w-[min(92vw,26rem)] flex-col bg-bg shadow-2xl transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)' }}>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <h2 className="text-lg font-extrabold">Mi cancionero</h2>
          <button className={small} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="space-y-2 px-3 py-2">
          <button className="btn-primary w-full" onClick={() => { onNew(); onClose() }}>+ Nueva canción</button>
          {list.length > 4 && <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar por título o artista" aria-label="Filtrar canciones"
            className="field w-full text-sm" />}
        </div>
        {!list.length && (
          <div className="flex flex-col items-center px-6 py-6 text-center">
            <Mate size={70} className="text-mute" />
            <p className="mt-3 font-semibold">Todavía no guardaste canciones</p>
            <p className="mt-1 text-sm text-mute">Buscá una, elegí un video o analizá un MP3: todo queda acá, en este teléfono, hasta que lo borres.</p>
          </div>)}
        <ul ref={listRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3" onPointerMove={onPointerMove}
          style={{ touchAction: dragId ? 'none' : 'auto' }}>
          {shown.map((s) => {
            const i = list.indexOf(s)
            return (
              <li key={s.id} data-song className={`flex flex-wrap items-center gap-0.5 overflow-hidden rounded-xl p-1 ${s.id === currentId ? 'bg-accent/15 ring-1 ring-accent' : 'bg-panel'} ${dragId === s.id ? 'opacity-70 shadow-lg' : ''}`}>
                {!q && <span role="button" aria-label={`Mover ${s.filename}`} className="grid min-h-10 w-8 cursor-grab touch-none place-items-center text-mute"
                  onPointerDown={(e: { currentTarget: HTMLElement; pointerId: number }) => { e.currentTarget.releasePointerCapture?.(e.pointerId); setDragId(s.id) }}>⠿</span>}
                {editing === s.id ? (
                  <input autoFocus defaultValue={s.filename} aria-label="Nuevo nombre" className="field min-h-10 min-w-0 flex-1 text-sm"
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.filename) onRename(s, v); setEditing(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null) }} />
                ) : (
                  <button className="min-h-10 min-w-0 flex-1 text-left" onClick={() => { onOpen(s); onClose() }}>
                    <span className="block truncate text-sm font-semibold">{s.filename}</span>
                    <span className="block truncate text-xs text-mute">{tag(s)}</span>
                  </button>
                )}
                <button className={small} onClick={() => setMenu(menu === s.id ? null : s.id)} aria-label={`Opciones de ${s.filename}`} aria-expanded={menu === s.id}><Icon name="more" className="h-5 w-5" /></button>
                {menu === s.id && (
                  <div className="flex basis-full flex-wrap gap-1 pb-1 pl-8">
                    {!q && <button className="btn min-h-9 px-2 text-xs" onClick={() => move(i, -1)} disabled={i === 0}>↑ Subir</button>}
                    {!q && <button className="btn min-h-9 px-2 text-xs" onClick={() => move(i, 1)} disabled={i === list.length - 1}>↓ Bajar</button>}
                    <button className="btn min-h-9 px-2 text-xs" onClick={() => { onShare(s); setMenu(null) }} aria-label={`Compartir ${s.filename}`}><Icon name="share" className="h-4 w-4" /> Compartir</button>
                    <button className="btn min-h-9 px-2 text-xs" onClick={() => { setEditing(s.id); setMenu(null) }} aria-label={`Renombrar ${s.filename}`}>✎ Renombrar</button>
                    <button className="btn min-h-9 px-2 text-xs text-red-400" onClick={() => { onDelete(s); setMenu(null) }} aria-label={`Borrar ${s.filename}`}>Borrar</button>
                  </div>)}
              </li>
            )
          })}
        </ul>
        <div className="space-y-2 border-t border-line px-3 py-3">
          {busy && <p role="status" className="text-xs text-mute">{busy}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn" disabled={!!busy || !list.length} onClick={onBackup}><Icon name="download" className="h-4 w-4" /> Copia de seguridad</button>
            <label className={`btn cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}><Icon name="upload" className="h-4 w-4" /> Importar
              <input type="file" className="sr-only" aria-label="Importar canción o copia" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} /></label>
          </div>
          <p className="text-[11px] text-mute">La copia guarda todas tus canciones (con sus audios) en un archivo. «Importar» abre una copia o una canción que te compartieron.</p>
        </div>
      </aside>
    </div>
  )
}

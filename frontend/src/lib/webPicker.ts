// Puente con el plugin nativo «WebPicker» de la APK (android-extra/WebPickerPlugin.java). En la web no existe: se usan enlaces.
import { Capacitor, registerPlugin } from '@capacitor/core'

interface WebPicker {
  pickYouTube(o: { query: string }): Promise<{ id?: string; cancelled?: boolean }>
  importPage(o: { url: string; title?: string; button?: string; mode?: 'chords' | 'lyrics' }): Promise<{ text?: string; url?: string; title?: string; cancelled?: boolean }>
  createFile(o: { name: string; mime: string }): Promise<{ token?: string; cancelled?: boolean }>
  writeChunk(o: { token: string; data: string }): Promise<void>
  closeFile(o: { token: string }): Promise<void>
  shareFile(o: { name: string; mime: string; data: string; text?: string }): Promise<void>
}
const plugin = registerPlugin<WebPicker>('WebPicker')

export const hasWebPicker = () => { try { return Capacitor.getPlatform() === 'android' } catch { return false } }

/** Abre la búsqueda de YouTube dentro de la app (sin cuenta); devuelve el id del video tocado o null si se cerró. */
export async function pickYouTube(query: string): Promise<string | null> {
  const r = await plugin.pickYouTube({ query })
  return r.id ?? null
}

/** Buscador web con la canción: «canción artista acordes lacuerda» (LaCuerda sale primero; Cifra Club sigue apareciendo más abajo).
 *  Con «site:… OR …» Google no encontraba nada, por eso se usa solo la palabra. */
export const songbookSearchUrl = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(`${q} acordes lacuerda`)}`

/** Abre el cancionero dentro de la app; el usuario elige la canción y toca «Importar acordes». Devuelve el texto o null. */
export async function importFromSongbook(q: string): Promise<string | null> {
  const r = await plugin.importPage({ url: songbookSearchUrl(q), title: 'Elegí la canción y tocá «Importar acordes»' })
  if (!r.text) return null
  try { const v = JSON.parse(r.text); return typeof v === 'string' ? v : null } catch { return r.text }
}

/** Búsqueda web de la letra: «canción artista letra». */
export const lyricsSearchUrl = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(`${q} letra`)}`

/** APK: abre una búsqueda de la letra dentro de la app; el usuario elige la página (y si quiere selecciona la letra) y toca
 *  «Importar letra». Devuelve el texto o null si cerró. */
export async function importLyricsFromWeb(q: string): Promise<string | null> {
  const r = await plugin.importPage({ url: lyricsSearchUrl(q), title: 'Elegí la página de la letra y tocá «Importar letra»', button: 'Importar letra', mode: 'lyrics' })
  if (!r.text) return null
  try { const v = JSON.parse(r.text); return typeof v === 'string' ? v : null } catch { return r.text }
}

async function toBase64(b: Blob): Promise<string> {
  const u = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 30000)
}

/** Guarda un archivo donde el usuario elija (APK) o lo descarga (web). Devuelve false si se canceló. Se escribe por partes. */
export async function saveFile(blob: Blob, name: string, onProgress?: (p: number) => void): Promise<boolean> {
  if (!hasWebPicker()) { download(blob, name); return true }
  const r = await plugin.createFile({ name, mime: 'application/octet-stream' })
  if (!r.token) return false
  const CH = 3 * 1024 * 1024 // múltiplo de 3: cada parte en base64 es independiente
  try {
    for (let i = 0; i < blob.size; i += CH) { await plugin.writeChunk({ token: r.token, data: await toBase64(blob.slice(i, i + CH)) }); onProgress?.(Math.min(1, (i + CH) / blob.size)) }
  } finally { await plugin.closeFile({ token: r.token }) }
  return true
}

/** Comparte un archivo chico (una canción) con otras apps; en la web lo descarga. */
export async function shareFile(blob: Blob, name: string, text: string, mime = 'application/octet-stream'): Promise<void> {
  if (!hasWebPicker()) { download(blob, name); return }
  await plugin.shareFile({ name, mime, data: await toBase64(blob), text })
}

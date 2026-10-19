// Puente con el plugin nativo «WebPicker» de la APK (android-extra/WebPickerPlugin.java). En la web no existe: se usan enlaces.
import { Capacitor, registerPlugin } from '@capacitor/core'

interface WebPicker {
  pickYouTube(o: { query: string }): Promise<{ id?: string; cancelled?: boolean }>
  importPage(o: { url: string; title?: string }): Promise<{ text?: string; url?: string; title?: string; cancelled?: boolean }>
}
const plugin = registerPlugin<WebPicker>('WebPicker')

export const hasWebPicker = () => { try { return Capacitor.getPlatform() === 'android' } catch { return false } }

/** Abre la búsqueda de YouTube dentro de la app (sin cuenta); devuelve el id del video tocado o null si se cerró. */
export async function pickYouTube(query: string): Promise<string | null> {
  const r = await plugin.pickYouTube({ query })
  return r.id ?? null
}

/** Buscador web con la canción, restringido a cancioneros conocidos. */
export const songbookSearchUrl = (q: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${q} acordes site:lacuerda.net OR site:cifraclub.com OR site:cifraclub.com.br`)}`

/** Abre el cancionero dentro de la app; el usuario elige la canción y toca «Importar acordes». Devuelve el texto o null. */
export async function importFromSongbook(q: string): Promise<string | null> {
  const r = await plugin.importPage({ url: songbookSearchUrl(q), title: 'Elegí la canción y tocá «Importar acordes»' })
  if (!r.text) return null
  try { const v = JSON.parse(r.text); return typeof v === 'string' ? v : null } catch { return r.text }
}

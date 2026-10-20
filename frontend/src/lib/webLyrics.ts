// Limpieza del texto que se trae de una página de letras: se sacan restos de la página (enlaces, avisos, botones) y se
// dejan las estrofas. El usuario lo revisa antes de usarlo, así que se limpia con prudencia (mejor que sobre a que falte).
const JUNK = [
  /https?:\/\//i, /©|copyright|derechos reservados|todos los derechos/i, /cookies?|publicidad|anuncio|suscrib/i,
  /^(compartir|imprimir|enviar|corregir|traducir|traducción|ver (más|video|vídeo)|escuchar|reproducir|seguir|me gusta)$/i,
  /^(inicio|menú|buscar|iniciar sesión|registrarse|ver letra|letras?\.\w+)$/i, /^(facebook|twitter|whatsapp|instagram|youtube)$/i,
  /^(compositor(es)?|escrita por|letra de|autores?):/i,
]

export function cleanWebLyrics(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n').map((l) => l.replace(/\s+$/, '').replace(/^\s+/, ''))
  const kept = lines.filter((l) => !l || !JUNK.some((r) => r.test(l)))
  const out: string[] = []
  for (const l of kept) { if (!l && (!out.length || !out[out.length - 1])) continue; out.push(l) }
  while (out.length && !out[out.length - 1]) out.pop()
  return out.join('\n')
}

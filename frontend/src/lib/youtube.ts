const ID_RE = /^[A-Za-z0-9_-]{11}$/
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'])

export function parseYouTubeId(input: string): string | null {
  const text = input.trim()
  if (ID_RE.test(text)) return text
  let url: URL
  try { url = new URL(text.includes('//') ? text : 'https://' + text) } catch { return null }
  if (!HOSTS.has(url.hostname)) return null
  const parts = url.pathname.split('/').filter(Boolean)
  let cand: string | null | undefined = null
  if (url.hostname === 'youtu.be') cand = parts[0]
  else if (parts[0] === 'watch') cand = url.searchParams.get('v')
  else if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) cand = parts[1]
  return cand && ID_RE.test(cand) ? cand : null
}

export function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60), r = Math.floor(s % 60)
  return `${m}:${r.toString().padStart(2, '0')}`
}

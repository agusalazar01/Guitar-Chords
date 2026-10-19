/** Un borrador es una canción creada solo desde la letra: sin acordes, sin audio y sin video. Al elegir un video se une a él. */
export function isEmptyDraft(s: { settings: { videoId?: string | null }; audio?: unknown; original: unknown[] } | null | undefined): boolean {
  return !!s && !s.settings.videoId && !s.audio && !s.original.length
}

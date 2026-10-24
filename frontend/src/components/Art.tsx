// Dibujos de Mi Cancionero: el cuaderno con un diagrama de acorde (el ícono) y el mate (con vapor que sube mientras espera).

/** Cuaderno amarillo con espiral y el diagrama de La. */
export function Notebook({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="96 76 312 360" width={size} height={size * 360 / 312} className={className} aria-hidden="true">
      <rect x="132" y="92" width="268" height="336" rx="26" fill="#c98f22" />
      <rect x="120" y="84" width="268" height="336" rx="26" fill="#f2b84b" />
      <g fill="none" stroke="#e9eefc" strokeWidth="12" strokeLinecap="round"><path d="M104 140 h40" /><path d="M104 196 h40" /><path d="M104 252 h40" /><path d="M104 308 h40" /><path d="M104 364 h40" /></g>
      <g stroke="#0e1424" strokeLinecap="round">
        <path d="M176 150 h170" strokeWidth="18" />
        <g strokeWidth="8"><path d="M176 150 v216" /><path d="M210 150 v216" /><path d="M244 150 v216" /><path d="M278 150 v216" /><path d="M312 150 v216" /><path d="M346 150 v216" /></g>
        <g strokeWidth="7"><path d="M176 204 h170" /><path d="M176 258 h170" /><path d="M176 312 h170" /><path d="M176 366 h170" /></g>
      </g>
      <g fill="#0e1424"><circle cx="244" cy="231" r="14" /><circle cx="278" cy="231" r="14" /><circle cx="312" cy="231" r="14" /></g>
    </svg>
  )
}

/** Mate con bombilla; con steam, el vapor sube despacio (se usa mientras analiza o carga). */
export function Mate({ size = 96, steam = true, className = '' }: { size?: number; steam?: boolean; className?: string }) {
  return (
    <svg viewBox="0 -8 100 162" width={size} height={size * 162 / 100} className={className} aria-hidden="true">
      {steam && <g className="steam" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".6">
        <path d="M30 40 c-8 -10 8 -18 0 -28" /><path d="M48 44 c-8 -12 8 -20 0 -34" /><path d="M66 40 c-8 -10 8 -18 0 -28" />
      </g>}
      <path d="M86 6 L58 70" stroke="#c9cfdc" strokeWidth="7" strokeLinecap="round" />
      <rect x="80" y="0" width="14" height="10" rx="3" fill="#c9cfdc" transform="rotate(24 87 5)" />
      <ellipse cx="48" cy="64" rx="34" ry="8" fill="#7fa34a" />
      <path d="M12 72 C 0 100, 2 150, 48 152 C 94 150, 96 100, 84 72 Z" fill="#9a6232" />
      <path d="M22 96 C 18 120, 24 138, 40 144" stroke="#b97c43" strokeWidth="6" fill="none" strokeLinecap="round" />
      <rect x="8" y="66" width="80" height="12" rx="6" fill="#c9cfdc" />
    </svg>
  )
}

/** Banderita de Uruguay. */
export function FlagUY({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 27 18" width="18" height="12" className={className} role="img" aria-label="Uruguay">
      <rect width="27" height="18" fill="#fff" />
      <g fill="#0038a8"><rect y="2" width="27" height="2" /><rect y="6" width="27" height="2" /><rect y="10" width="27" height="2" /><rect y="14" width="27" height="2" /></g>
      <rect width="10" height="10" fill="#fff" /><circle cx="5" cy="5" r="3" fill="#fcd116" />
    </svg>
  )
}

/** Íconos de línea simples (24×24). */
export function Icon({ name, className = 'h-5 w-5' }: { name: 'menu' | 'plus' | 'search' | 'gear' | 'lyrics' | 'chords' | 'more' | 'share' | 'download' | 'upload' | 'next' | 'prev' | 'tap' | 'tuner' | 'metronome'; className?: string }) {
  const p: Record<string, React.ReactNode> = {
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    lyrics: <path d="M5 6h14M5 10h14M5 14h9M5 18h6" />,
    chords: <><path d="M6 4h12M6 4v16M10 4v16M14 4v16M18 4v16M6 9h12M6 14h12" /><circle cx="10" cy="11.5" r="1.4" fill="currentColor" /><circle cx="14" cy="11.5" r="1.4" fill="currentColor" /></>,
    more: <><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></>,
    share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /></>,
    download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
    upload: <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />,
    next: <path d="M9 5l7 7-7 7" />,
    prev: <path d="M15 5l-7 7 7 7" />,
    tap: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="7.5" /></>,
    metronome: <><path d="M9 3h6l4 18H5L9 3z" /><path d="M12 16l5-9" /></>,
    tuner: <><path d="M9 3v8a3 3 0 0 0 6 0V3" /><path d="M12 14v7" /></>,
  }
  return <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[name]}</svg>
}

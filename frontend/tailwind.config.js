export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'] },
      colors: {
        bg: 'var(--bg)', panel: 'var(--panel)', fg: 'var(--fg)', mute: 'var(--mute)',
        line: 'var(--line)', panel2: 'var(--panel2)', accent: 'var(--accent)', 'accent-fg': 'var(--accent-fg)', next: 'var(--next)',
      },
    },
  },
}

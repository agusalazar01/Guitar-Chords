import type { CapacitorConfig } from '@capacitor/cli'

// La app empaqueta el frontend compilado: el análisis y el almacenamiento ocurren en el teléfono.
const config: CapacitorConfig = {
  appId: 'app.guitarchords',
  appName: 'Guitar Chords',
  webDir: 'dist',
  server: { androidScheme: 'https' },
}
export default config

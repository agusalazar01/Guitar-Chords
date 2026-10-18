# Guitar Chords (app Android local)

Reconoce acordes de tus MP3/WAV **en el propio teléfono**, los muestra sincronizados con la reproducción, con diagramas de
guitarra, bucle, velocidad, transposición y edición. No hay servidor propio ni cuentas.

## Qué funciona sin Internet / qué necesita Internet
| Función | Internet |
|---|---|
| Elegir MP3/WAV, decodificar, analizar acordes (motor en TypeScript, Web Worker) | No |
| Reproducir el archivo, bucle, velocidad lenta, saltos, sincronización | No |
| Diagramas, transposición, edición/restauración de acordes y tiempos | No |
| Canciones guardadas, ajustes, preferencias (IndexedDB / localStorage del teléfono) | No |
| Reproducir un video de YouTube (reproductor oficial) | **Sí** (los datos van a YouTube/Google) |
| Buscar en YouTube | **Sí**: requiere tu propia clave de YouTube Data API v3 (opcional, Ajustes); la consulta y la clave se envían a Google. Sin clave, pegá un enlace |

Servidores propios: **ninguno**. El audio nunca sale del teléfono. Por seguridad, la clave de YouTube no se incluye en la APK:
la escribe cada usuario y queda solo en su dispositivo. El audio de YouTube **no** se extrae ni se analiza; los acordes de un
archivo propio pueden mostrarse sobre el video con un desfase manual.

## Motor de reconocimiento (v0.3) y limitaciones
STFT (8192 muestras, salto 2048, 22,05 kHz) → cromagramas por banda (acordes 90–2200 Hz; graves 70–250 Hz) con estimación de
afinación → **pulso y tempo** (flujo espectral + autocorrelación + programación dinámica) → cromagrama sincronizado al pulso
(mediana) → **tonalidad** (Krumhansl–Schmuckler) como bonificación suave a acordes diatónicos → apoyo del bajo a la raíz →
Viterbi con estado «N» (silencio). El compás se estima asumiendo 4/4 y eligiendo como tiempo fuerte el pulso donde más cambian los acordes.
Si no hay un pulso fiable, usa el modo sin pulso. Supone tempo estable.

Dos vocabularios (se elige en la app, «Acordes»):
- **Simples** (por defecto): mayores y menores.
- **Avanzados (experimental)**: añade 7, maj7, m7, sus2, sus4, dim y aug, con una penalización para que solo ganen con evidencia clara.

**Medición (`npm test`; banco SINTÉTICO con guitarra, bajo, batería y melodía; NO son canciones reales):**
| | v0.1 | v0.3 simples | v0.3 avanzados |
|---|---|---|---|
| Canciones de tríadas (exacto) | 89,7 % | 98,9 % | 82,1 % |
| Canciones con séptimas/sus (exacto) | 30,5 % | 24,2 % | 49,2 % |
En música real los resultados serán peores y no están medidos; no se afirma ninguna precisión ni equivalencia con otras apps.
El modo avanzado mejora séptimas pero empeora canciones simples (más falsos positivos). Diagramas verificados: tríadas (con cejillas
desplazadas), 7 abiertas, maj7/m7/sus/dim/aug abiertos comunes; el resto muestra «No hay una posición verificada».
Límites de archivo: 40 MB y 15 min.

## ¿Analizar el audio de YouTube en tiempo real? Decisión: no
- **Técnicamente** (no comprobado en un dispositivo): el reproductor IFrame de YouTube no entrega audio. En Android 10+ la API
  `AudioPlaybackCapture` copia audio de reproductores `USAGE_MEDIA/GAME/UNKNOWN` y exige permiso `RECORD_AUDIO`, el aviso de consentimiento de
  `MediaProjection` y un plugin nativo; el audio interno se captura sin micrófono, pero cada app puede excluirse de la captura y no sé si el
  audio del WebView/iframe sería capturable.
- **Condiciones de uso**: las políticas de YouTube para desarrolladores prohíben ofrecer la posibilidad de descargar o separar pistas de audio y
  separar o aislar componentes de audio de un video, y recomiendan una *auditoría de cumplimiento de la API* ante dudas. Por eso **no se implementó**
  la captura ni el análisis del audio de YouTube.
- **Alternativas incluidas**: analizar un MP3/WAV propio (todo en el teléfono) y mostrarlo sobre el video con desfase manual o con «Alinear: este acorde empieza ahora».
  Si en el futuro conseguís autorización o una fuente de acordes con licencia, la arquitectura (motor separado del reproductor) lo permite.

## Datos en el teléfono
Se guardan en IndexedDB: audio, acordes originales, correcciones, transposición, desfase y video asociado. Borrá una canción
con «Borrar» (elimina también su audio). Desinstalar la app o borrar sus datos elimina todo. No hay copias de seguridad ni sincronización.

## Versión web de prueba (GitHub Pages)
Cada *push* a `main` compila y publica la app web en `https://<usuario>.github.io/<repositorio>/` (workflow `pages.yml`).
Se abre en el navegador del teléfono y es la misma app que la APK, sin generar ni instalar nada. Activación única:
repositorio → Settings → Pages → Build and deployment → Source: **GitHub Actions**. Los repositorios **privados** necesitan un
plan de GitHub que incluya Pages; en el plan gratuito, Pages exige repositorio público (el código sería visible).
Alternativa sin publicar: en un Codespace, `cd frontend && npm install && npm run dev -- --host` y abrir la URL del puerto 5173 (pestaña Ports).
La APK (workflow `android-debug.yml`) ahora se genera solo a mano, cuando quieras la versión final.

## Obtener la APK sin computadora
1. Cuenta en github.com y repositorio nuevo. Con «Sitio de escritorio» en Chrome, abrí Code → Codespaces → Create.
2. En el Codespace, subí `guitar-chords.zip` (clic derecho en el explorador → Upload) y en la terminal:
   `unzip guitar-chords.zip && cp -r guitar-chords/. . && rm -rf guitar-chords guitar-chords.zip && git add -A && git commit -m init && git push`
3. En Actions → «APK de depuración» (corre sola al hacer push o con *Run workflow*). Si falla, abrí el log del paso en rojo.
4. En el repositorio, *Releases → APK de depuración → app-debug.apk*: descargala desde el teléfono.
5. Abrila desde Descargas; Android pedirá permitir «instalar apps desconocidas» para tu navegador: aceptá solo para este archivo.
Para regenerar tras cambios: *commit* a `main` o *Run workflow*.

## Desarrollo
`cd frontend && npm install && npm test && npm run dev` (Node 22+). `npm run build` ejecuta `tsc --noEmit` y falla ante errores de tipos.

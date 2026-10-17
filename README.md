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

## Motor de reconocimiento (limitaciones)
STFT (8192 muestras, salto 2048, 22,05 kHz) → cromagrama con estimación de afinación → plantillas de tríadas mayores/menores
→ Viterbi (suavizado temporal) con estado «N» (silencio). Solo reconoce mayores y menores; no séptimas, suspendidos, inversiones
ni tonalidad. Sufre con mezclas densas, percusión fuerte, modulaciones y graves. Medido **solo con audio sintético**
(`npm test`); no está evaluado con canciones reales, así que no se afirma ninguna precisión. Límites: 40 MB y 15 min por archivo.

## Datos en el teléfono
Se guardan en IndexedDB: audio, acordes originales, correcciones, transposición, desfase y video asociado. Borrá una canción
con «Borrar» (elimina también su audio). Desinstalar la app o borrar sus datos elimina todo. No hay copias de seguridad ni sincronización.

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

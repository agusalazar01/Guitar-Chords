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

## Motor de reconocimiento (v0.4) y limitaciones
STFT (ventana 8192 = 371 ms, salto 2048 = 93 ms, 22,05 kHz) → cromagrama solo con la banda **90–700 Hz** (donde están las notas
de la guitarra; deja afuera buena parte de la voz y sus armónicos) con estimación de afinación → filtro de mediana →
**tonalidad** (Krumhansl–Schmuckler) como bonificación suave → **Viterbi** con estado «N» (silencio). Cada frame se etiqueta por el
**centro** de su ventana. Si hay un pulso fiable, cambiar de acorde es más probable **sobre un pulso**, pero ya no se fuerza a la rejilla.
**Inversiones** (C/E, G/D, Em/B…): solo si un seguimiento del bajo (ventana de 0,74 s, 65–196 Hz) indica la 3ª o la 5ª del acorde
durante ≥ 0,8 s y hay graves audibles. Vocabularios: **Simples** (mayores y menores, por defecto) y **Avanzados (experimental)**:
7, maj7, m7, sus2, sus4, dim, aug, 6, add9 y 9, con una penalización para que solo aparezcan con evidencia clara.

### Medición con 4 canciones reales (grabaciones y cancioneros aportados por el usuario; el audio NO está en el repositorio)
Las partituras no traen tiempos, así que las métricas son aproximadas: *en-partitura* = % del tiempo con un acorde del cancionero
(nivel tríada, con la afinación real: «Buenas noches» suena medio tono abajo); *F1sec* = coincidencia de la secuencia de acordes;
*cambios* = acordes detectados / del cancionero.
| | v0.1 | v0.3 (versión anterior de la app) | v0.4 simples |
|---|---|---|---|
| En-partitura (promedio) | 90,3 % | 90,9 % | 96,6 % |
| F1 de secuencia (3 canciones) | 51,9 | 31,6 | 61,4 |
| Cambios en «La noche está muy oscura» (ref. 25) | 29 | **2** | 36 |
| Cambios en «Buenas noches» (ref. 17) | 26 | **5** | 26 |
La v0.3 alineaba los acordes al pulso con mucha «inercia» y mantenía el acorde anterior durante compases enteros (ese era el retraso
que se notaba). La banda 90–700 Hz mejoró las 4 canciones frente a 90–2200 Hz; elegida dejando una canción afuera, la mejora se
mantiene en 3 de 4 (en «Buenas noches» se elegiría 90–600 Hz, que allí empeora). Ventanas más cortas (186 ms y 93 ms) se probaron
y **empeoraron** la precisión (más cambios falsos), así que se mantuvo 371 ms con salto de 93 ms.
Errores típicos que persisten: mayor/menor confundidos (Am leído como A), acordes «de paso» de la voz o del bajo, y C/E o G/D leídos
como Am o G. El modo Avanzado no mejora a Simples en estas canciones (F1 57,7 vs 61,4).
Reproducir la medición: `frontend/tools/eval-real.ts` (instrucciones en el archivo). Límites de archivo: 40 MB y 15 min.

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

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

## Motor de reconocimiento v0.5: híbrido IA + croma + HMM (todo en el teléfono)
1. **Basic Pitch** (Spotify; código y pesos Apache-2.0, `public/models/LICENSE-basic-pitch.txt`; modelo ONNX de 230 KB) estima la
   probabilidad de cada una de las 88 notas cada ~11,6 ms. Corre en un Web Worker con **onnxruntime-web** (MIT, WASM, 1 hilo); los
   `.wasm` se copian a `public/ort` al compilar (`scripts/copy-ort.mjs`), así que no se usa ningún CDN ni servidor.
2. Esas notas se pliegan en un croma de agudos (que se **suma** al croma clásico STFT 90–700 Hz) y un croma de **bajo**.
3. El bajo apoya la raíz del acorde (o, con peso 0,9, una inversión), pero **solo en los cuadros donde una nota grave domina**: en
   guitarra arpegiada con bajo alternado casi no pesa; en canciones con bajista, sí.
4. Tonalidad por acordes (dos pasadas) como bonificación suave + **Viterbi** con más probabilidad de cambio sobre los pulsos.
5. Si el modelo no carga, el worker usa el **motor clásico v0.4.2** (se conserva completo) y la app lo avisa.

### Resultados (mismos audios y referencias para todos los motores; `tools/`)
Referencias con tiempos: lo que muestra Chordify en las 2 grabaciones de pantalla del usuario. Cancioneros: sin tiempos (métricas aproximadas).
«Completo» = raíz + tipo exacto (Am7 ≠ Am); «mayor/menor» = raíz y si es mayor o menor; similitud = notas compartidas (separada de la precisión).
| Motor | A las nueve: completo | Carta: raíz | Carta: mayor/menor | Carta: completo (avanzados) | Cancioneros: en-partitura / F1 secuencia |
|---|---|---|---|---|---|
| v0.3 (app anterior) | 61 % | 27 % | 27 % | 8 % | 90,9 % / 31,6 |
| clásico v0.4.2 | 93 % | 45 % | 40 % | 2 % | 96,6 % / 61,4 |
| **híbrido v0.5** | **94 %** | **78 %** | **63 %** | **15 %** | 95,0 % / 58,3 |
Cambios encontrados (±1 s) y retraso mediano: «A las nueve» 100 % y +34 ms; «Carta» 80 % y +143 ms (v0.4.2: 85 % y +134 ms).
El híbrido mejora mucho la raíz en la canción con bajo y séptimas rápidas, empata en «A las nueve» y queda apenas por debajo del
clásico en los 4 cancioneros (guitarra arpegiada). Las séptimas exactas siguen siendo débiles (15 %): bajar la penalización las sube en
«Carta» (hasta 39 %) pero agrega séptimas falsas en «A las nueve» (de 86 % a 40 %), así que el modo Avanzados quedó conservador.
Las referencias no traen inversiones, así que la precisión del bajo/inversiones **no se pudo medir**. Seis canciones son pocas: los
parámetros se eligieron con ellas y pueden no generalizar.

### Alternativas evaluadas con pruebas (y descartadas)
Ventanas cortas (186/93 ms): más cambios falsos. Sincronizar al pulso con mucha inercia (v0.3): retenía acordes (2 cambios en una
canción entera). Pegar los cambios al pulso: no mejoró. Restar notas persistentes: +8 puntos en «Carta», −8 a −25 en las demás.
Bajo con peso fijo: +36 puntos de raíz en «Carta» pero hasta −50 en cancioneros (por eso el peso adaptativo). Solo IA sin croma
clásico: peor en cancioneros. Tonalidad por perfiles de croma: elegía mal (Re mayor en una canción en Mi menor).
### Alternativas revisadas sin integrar (licencia/tamaño; no verificadas en esta sesión salvo donde se indica)
NNLS-Chroma/Chordino (GPL: obligaría a publicar el código de la app; el método se podría reimplementar), madmom (pesos con licencia no
comercial), modelos de transformador para acordes (requieren convertir pesos de PyTorch, no disponible aquí), separación de fuentes
(Demucs/Spleeter: decenas de MB y minutos por canción en un teléfono). CQT: no implementado (STFT con corrección de afinación).

### Velocidad, tamaño y equivalencia web/APK: cómo se verifica (y qué NO está verificado)
- **Tamaño real**: el modelo pesa 230 KB, pero el motor completo incluye los `.wasm` de onnxruntime-web y el código del worker. Al
  compilar, `scripts/engine-manifest.mjs` mide todos esos archivos y los anota (tamaño + SHA-256) en `engine-manifest.json`; el
  registro de GitHub Actions muestra el total. Ese número no se pudo medir en esta sesión (sin acceso a npm).
- **Mismo resultado que la referencia**: el trabajo `motor-ia` de GitHub Actions ejecuta el modelo con onnxruntime-web (el mismo paquete
  y backend WASM que la app) sobre un acorde de prueba y lo compara con ONNX Runtime nativo (diferencia máxima permitida 0,02).
  Lo verificado aquí: el audio de prueba y las ventanas en TypeScript dan exactamente los valores de referencia con el runtime nativo.
- **Web y APK, mismo motor**: ambas se compilan del mismo `dist`. El flujo de la APK extrae los archivos del motor de la APK y comprueba que
  sus huellas sean idénticas a las de la web; si no, falla.
- **Velocidad en el teléfono**: no medida. En la app, **Ajustes → «Probar motor de IA en este dispositivo»** carga el modelo, analiza 5 s
  de un acorde de Do mayor, comprueba que detecte Do-Mi-Sol, mide la velocidad y muestra la huella del motor. Hacela en Chrome y en
  la APK: si la huella coincide y ambas dicen «FUNCIONA», es el mismo motor; los tiempos dicen cuánto tarda en ese teléfono.
- Referencia en el servidor de pruebas (no equivale a un teléfono): 1,4 s de modelo por minuto de audio (nativo, 1 hilo).

### Reproducir la medición
`python3 tools/basic_pitch_notes.py audio.f32 audio.notes` (requiere `pip install onnxruntime numpy`) y luego
`node --experimental-strip-types tools/eval-hybrid.ts` (referencias Chordify) o `tools/eval-real.ts` (cancioneros, motor clásico).

## Motor clásico (v0.4.2, se usa si el modelo no carga) y limitaciones
STFT (ventana 8192 = 371 ms, salto 2048 = 93 ms, 22,05 kHz) → cromagrama solo con la banda **90–700 Hz** (donde están las notas
de la guitarra; deja afuera buena parte de la voz y sus armónicos) con estimación de afinación → filtro de mediana →
**tonalidad en dos pasadas** (primero acordes sin sesgo; luego la tonalidad cuyos acordes diatónicos cubren más tiempo) como bonificación suave → **Viterbi** con estado «N» (silencio). Cada frame se etiqueta por el
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
### Comparación con Chordify (v0.4.1)
Grabación de pantalla aportada por el usuario («A las nueve», No Te Va Gustar, 65 s): se extrajo el audio y, de los fotogramas, el
acorde que muestra Chordify y el instante exacto en que cambia (17 acordes, 16 cambios). Acierto = % del tiempo con el mismo acorde.
| | v0.1 | v0.3 | v0.4 (tonalidad por perfiles) | v0.4.1 |
|---|---|---|---|---|
| Acierto vs Chordify | 71 % | 61 % | 77 % | **94 %** |
| Cambios encontrados (±1,5 s) | 10/16 | 3/16 | 13/16 | **16/16** |
El salto de 77 % a 94 % vino de la tonalidad: con perfiles de croma salía «Re mayor» y favorecía La en vez de Lam; por acordes sale
«Mi menor». Los cambios quedan a ±0,3–0,6 s de los de Chordify (Chordify los ajusta al compás). Ajustar los cambios al pulso se probó
y no mejoró el acierto, así que está desactivado. Es una sola canción y un fragmento: no garantiza el mismo resultado en otras.

### Segunda comparación con Chordify: «Carta para no llorar» (75 s, acordes de séptima, ~1 cambio por segundo)
47 acordes de referencia (Cmaj7, Gmaj7, Dm7, G7, Cm7, Bm7, E7, Am7, D7…). Acierto a nivel tríada (Am7 cuenta como Am):
v0.1 25 %, v0.3 27 %, v0.4.1 35 %, **v0.4.2 39 %**; con la séptima exacta, ≈ 0–12 %. Diagnóstico: aun eligiendo la mejor plantilla
cuadro a cuadro sin suavizado se llega solo a 38 %: en esta grabación suenan casi siempre D y E por encima de los acordes (melodía o
tensiones), y los acordes de séptima comparten 3 de 4 notas con otros (Bm7 = D6, E7 ≈ G#dim…). Se probaron, sin éxito o empeorando
otras canciones: ventanas más cortas, menos suavizado, restar las notas persistentes y darle peso al bajo. El método actual (plantillas
de croma) funciona bien en pop/rock/folk con acordes de 2–4 s y mal en armonías tipo jazz/bossa rápidas: ahí haría falta un modelo
entrenado (red neuronal en el navegador, con pesos de licencia compatible), que es un cambio grande.
v0.4.2 quita el desempate por «primer acorde» (en esta canción, que empieza en el IV, elegía Do mayor); las otras 5 canciones no cambian.

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

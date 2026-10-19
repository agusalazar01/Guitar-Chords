# Mi Cancionero (app Android local; antes «Guitar Chords»)

Tu cancionero en el teléfono: busca canciones por nombre, guarda su **letra sincronizada**, reconoce acordes de tus MP3/WAV **en el
propio teléfono** y los muestra con la reproducción (archivo o video de YouTube), con diagramas, bucle, velocidad, transposición y
edición. No hay servidor propio ni cuentas. (El identificador interno de la APK sigue siendo `app.guitarchords` para conservar las
canciones ya guardadas; el repositorio mantiene su nombre.)

## Motor v0.6.1 (medido)
Referencia nueva: la grabación completa de Chordify de «Carta para no llorar» que mandó el usuario (109 acordes en 175 s, alineada con
el MP3 por el audio; Chordify pone los cambios sobre una grilla de 1–2 s). Qué se encontró y qué se cambió:
- **Piso de ruido de la IA**: Basic Pitch da ~0,10 de probabilidad a *todas* las notas todo el tiempo (medido en las 8 canciones).
  Sumado, ese piso tapaba las notas reales en pasajes suaves: por eso la intro de guitarra eléctrica de «Mi semilla» quedaba en Mi
  16 s seguidos. Ahora se resta (`NOTECFG`): la intro muestra la caminata del bajo Mi–Fa#–Sol#–La (E F#m G#m A).
- **Las séptimas sí están en el audio**: en «Carta», la séptima suele ser la nota *más* fuerte del acorde (en E7 el Re, en Am7 el Sol).
  El detector anterior exigía que apareciera en casi todos los cuadros; ahora usa el promedio del segmento (umbral 0,7 de la tríada,
  0,5 si la canción usa muchas séptimas; maj7 desde 0,3).
- **E7 salía Em**: la tonalidad (Sol) favorecía sus acordes propios y castigaba E7 (dominante secundaria). Ahora las dominantes
  secundarias (La7, Si7, Mi7, Fa#7 en Sol) y el iv prestado (Dom en Sol) tienen media bonificación.
- Bajo con menos peso (0,5 → 0,3) e inercia algo mayor, porque sin el piso el bajo es mucho más nítido.

| «Carta» completa vs Chordify | v0.5.3 | v0.6.1 |
|---|---|---|
| raíz correcta | 68 % | 72 % |
| mayor/menor correcto | 57 % | 69 % |
| cambios encontrados (±1 s) | 72 % | 84 % |
| cambios de más (sobresegmentación) | 35 % | 25 % |
| Avanzados: acorde completo (con su séptima) | 41 % | 43 % |
| E7 reconocido como E7 | 0 % (Em) | 53 % |
| Am7 / Bm7 / Cmaj7 completos | — | 72 % / 53 % / 75 % |

Otras: «Carta» (grabación anterior) mayor/menor 66 → 85 %, Avanzados 45 → 61 %; «A las nueve» igual en Simples (95 %) y 95 → 92 %
en Avanzados (alguna séptima de más); cancioneros: en-partitura 95 % igual, F1 de secuencia 57 → 55.
Lo que sigue fallando: acordes de 1 s antes del I (D7 y Dm7 → G en un tercio del tiempo), Gmaj7 se ve como G (su Fa# es muy suave)
y Cm7 como Cm. La app cambia los acordes ~0,1–0,2 s después que Chordify según estas referencias (el ajuste «Mostrar los cambios
antes» lo compensa). Ocho canciones siguen siendo pocas.

## Novedades de la v0.6.0
- **Nombre «Mi Cancionero»** (ícono, encabezado, instalación).
- **Menú ☰ «Mi cancionero»**: todas las canciones guardadas, con filtro, renombrar, borrar, «+ Nueva canción» y **orden propio**
  (arrastrando la manija ⠿ o con ↑ ↓). Las canciones quedan hasta que las borrás.
- **Buscador por nombre** (lupa): «guitarrero viejo zitarrosa» busca a la vez:
  - **Canción y letra en LRCLIB** (gratis, sin clave ni cuenta): lista de versiones con disco, duración y si la letra tiene tiempos.
    Al elegir una, la letra se guarda en la canción abierta o crea una entrada nueva en el cancionero (todavía sin acordes).
  - **Videos de YouTube**: con tu clave propia aparecen en la app; sin clave, el botón «Buscar en YouTube» abre YouTube con la
    búsqueda hecha y, **en la APK**, desde el video tocás **Compartir → Mi Cancionero** y vuelve a la app con ese video.
- **Letra debajo del compás**: línea actual resaltada y la siguiente; «Ver toda» (tocar una línea salta ahí); corrimiento ±¼ s y
  «La próxima línea empieza ahora» para ajustarla a otra versión.
- **Letra automática**: al abrir un video (con su título) o analizar un MP3 (con el nombre del archivo) se busca la letra; si una
  versión coincide en título y duración (±3 s) se guarda sola, si no se ofrecen hasta 3 para elegir. Nunca reemplaza una letra elegida.
- **Analizar un MP3 con una canción abierta que todavía no tiene acordes** (creada desde la letra o el video) completa esa misma canción.

Qué está verificado: pruebas unitarias del formato LRC, limpieza de títulos y elección automática; tipos de TypeScript. Lo demás se
verifica en GitHub Actions (compilación, prueba de interfaz en Chromium y la APK con el nombre y el «compartir» en el manifiesto).
**No verificado**: el «Compartir → Mi Cancionero» real en un teléfono y si la web (GitHub Pages) puede consultar LRCLIB desde el
navegador (depende de que LRCLIB permita CORS; la prueba de Actions lo informa). En la APK la consulta va por la capa nativa.
Las letras tienen derechos de autor: LRCLIB es una base comunitaria; la app solo las guarda en tu teléfono para uso personal.

## Qué funciona sin Internet / qué necesita Internet
| Función | Internet |
|---|---|
| Elegir MP3/WAV, decodificar, analizar acordes (motor en TypeScript, Web Worker) | No |
| Reproducir el archivo, bucle, velocidad lenta, saltos, sincronización | No |
| Diagramas, transposición, edición/restauración de acordes y tiempos | No |
| Canciones guardadas, ajustes, preferencias (IndexedDB / localStorage del teléfono) | No |
| Reproducir un video de YouTube (reproductor oficial) | **Sí** (los datos van a YouTube/Google) |
| Buscar canción y letra (LRCLIB) | **Sí** (consulta a lrclib.net, sin clave ni cuenta) |
| Buscar en YouTube | **Sí**: requiere tu propia clave de YouTube Data API v3 (opcional, Ajustes); la consulta y la clave se envían a Google. Sin clave, pegá un enlace |

Servidores propios: **ninguno**. El audio nunca sale del teléfono. Por seguridad, la clave de YouTube no se incluye en la APK:
la escribe cada usuario y queda solo en su dispositivo. El audio de YouTube **no** se extrae, no se capta y no se analiza, y la app
**nunca** usa el micrófono. Con un video podés: analizar tu propio MP3/WAV de la misma canción (los acordes quedan unidos al video y
se abren solos cuando lo volvés a elegir) o **marcar los acordes a mano** mientras suena el video (ver «Videos de YouTube»).

## Motor de reconocimiento v0.5: híbrido IA + croma + HMM (todo en el teléfono)
1. **Basic Pitch** (Spotify; código y pesos Apache-2.0, `public/models/LICENSE-basic-pitch.txt`; modelo ONNX de 230 KB) estima la
   probabilidad de cada una de las 88 notas cada ~11,6 ms. Corre en un Web Worker con **onnxruntime-web** (MIT, WASM, 1 hilo); los
   `.wasm` se copian a `public/ort` al compilar (`scripts/copy-ort.mjs`), así que no se usa ningún CDN ni servidor.
2. Esas notas se pliegan en un croma de agudos (que se **suma** al croma clásico STFT 90–700 Hz) y un croma de **bajo**.
3. El bajo apoya la raíz del acorde (o, con peso 0,9, una inversión), pero **solo en los cuadros donde una nota grave domina**: en
   guitarra arpegiada con bajo alternado casi no pesa; en canciones con bajista, sí.
4. Tonalidad por acordes (dos pasadas) como bonificación suave + **Viterbi** con más probabilidad de cambio sobre los pulsos.
5. Si el modelo no carga, el worker usa el **motor clásico v0.4.2** (se conserva completo) y la app lo avisa.

### Cambios de la v0.5.3
- **Séptimas (modo Avanzados), adaptativo por canción**: primero se buscan séptimas con un criterio estricto sobre las notas medias
  (C3–E5) que da Basic Pitch; si al menos el 15 % del tiempo ya son séptimas, la canción «usa séptimas» y se aplica un criterio más
  sensible (la séptima menor o mayor debe estar presente en ≥ 75 % de los cuadros del acorde con ≥ 60 % de la energía de la tríada).
  Si no, queda el estricto, para no inventar séptimas en canciones con tríadas. «Carta» (séptimas): completo 26 % → **45 %**;
  «A las nueve» (sin séptimas): 95 % → 95 % (sin séptimas falsas); cancioneros sin cambio relevante (94,8 → 94,7 % en-partitura).
- **Tiempos**: filtro de mediana del croma de 5 → 7 cuadros (menos cambios espurios en «Carta»: sobresegmentación 27 → 25 %,
  mayor/menor 63 → 66 %). Probé además afinar cada frontera con las notas de Basic Pitch a ~23 ms y otros valores de inercia
  y adelanto: **no mejoraron** contra Chordify, así que no se incluyeron. El retraso mediano ya está por debajo de un cuadro de
  análisis (93 ms): «A las nueve» −43 ms, «Carta» +84 ms. Nuevo ajuste **«Mostrar los cambios antes»** (Ajustes, 0–0,5 s) para
  ver el próximo acorde con anticipación.
- **Diagramas en orden convencional**: abierta → cejilla más cercana a la cejuela → variante simplificada → formas móviles de menor
  a mayor traste. F muestra primero la cejilla completa en el traste 1; Bm/B/C#m/Bb, la forma de La (traste 2/2/4/1).
  «Priorizar posiciones sin cejilla» (Ajustes) sigue poniendo primero las simplificadas.
- **«+ Nueva»** (arriba): empieza otra canción sin recargar la página; lo guardado sigue en «Canciones guardadas».
- **Videos de YouTube**: reapertura automática de los acordes guardados para un video y modo «Marcar acordes» (ver abajo).

### Cambios de la v0.5.2
- **Causa del fallo del motor de IA** («no available backend found … Importing a module script failed»): la app importaba la entrada
  general de onnxruntime-web, que trae WebGPU/JSEP y pide `ort-wasm-simd-threaded.jsep.mjs`, archivo que no se copiaba a `public/ort`.
  Ahora se importa `onnxruntime-web/wasm` (solo WebAssembly) y, antes de cargar, se comprueba que existan los archivos del motor.
  Nueva prueba en GitHub Actions que abre la web compilada en **Chromium** (el motor del WebView de Android) y **WebKit** (Safari) y
  ejecuta la prueba del motor (`tools/browser-selftest.mjs`).
- **B7 leído como B9**: 6, add9 y 9 pagan una penalización extra; en las 6 canciones de prueba ya no aparecen (no hay ninguno en las
  referencias) y «Carta» sube de 15 % a 26 % de acordes completos en modo Avanzados.
- **Retraso**: los cambios se adelantan 50 ms (latencia medida contra Chordify) y el acorde se mantiene un poco menos; la app lee la
  posición del reproductor en cada cuadro de pantalla (antes cada 100 ms). Retraso mediano: «A las nueve» +34 → −16 ms, «Carta» +143 → +84 ms.
- **Diagramas**: formas móviles comprobadas nota por nota para 7, m7, maj7, sus2, sus4, dim, aug, 6 y 9 en las 12 raíces; las inversiones
  (G/B) muestran la forma del acorde y al transponer se mueve también el bajo. Sin diagrama quedan solo los add9.

### Resultados (mismos audios y referencias para todos los motores; `tools/`)
Referencias con tiempos: lo que muestra Chordify en las 2 grabaciones de pantalla del usuario. Cancioneros: sin tiempos (métricas aproximadas).
«Completo» = raíz + tipo exacto (Am7 ≠ Am); «mayor/menor» = raíz y si es mayor o menor; similitud = notas compartidas (separada de la precisión).
| Motor | A las nueve: completo | Carta: raíz | Carta: mayor/menor | Carta: completo (avanzados) | Cancioneros: en-partitura / F1 secuencia |
|---|---|---|---|---|---|
| v0.3 (app anterior) | 61 % | 27 % | 27 % | 8 % | 90,9 % / 31,6 |
| clásico v0.4.2 | 93 % | 45 % | 40 % | 2 % | 96,6 % / 61,4 |
| híbrido v0.5.0 | 94 % | 78 % | 63 % | 15 % | 95,0 % / 58,3 |
| **híbrido v0.5.3** | **95 %** | **78 %** | **66 %** | **45 %** | 94,8 % / 57,3 |
Cambios encontrados (±1 s) y retraso mediano (v0.5.3): «A las nueve» 100 % y −43 ms; «Carta» 83 % y +84 ms (v0.4.2: 85 % y +134 ms).
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

## Videos de YouTube (v0.5.3)
- **Marcar acordes**: elegí un video (enlace o búsqueda), tocá «Marcar los acordes de este video», elegí la tonalidad y, mientras suena,
  tocá cada acorde cuando empieza (hay paleta con los acordes de la tonalidad, los ya usados, «N» y un campo para cualquier otro).
  Se puede pausar, retroceder, volver a marcar encima o deshacer; luego se edita como cualquier canción (tiempos, dividir, eliminar).
  Se guarda en el teléfono unido al video, sin audio. No hay análisis automático en este modo.
- **Acordes analizados de tu archivo**: si analizás un MP3/WAV con un video abierto (o elegís el video con la canción abierta), quedan
  unidos. Al volver a elegir ese video, sus acordes se abren solos. Para otra versión del video, usá «Alinear» o el desfase.
- Lo que **no** hace: captar, grabar, separar o descargar el audio de YouTube, ni usar el micrófono.

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
Se guardan en IndexedDB: audio, acordes originales, correcciones, transposición, desfase y video asociado (las canciones marcadas
sobre un video no guardan audio). Borrá una canción
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

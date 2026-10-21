# Pendientes anotados (después de la v0.6.0)

## 1. Sincronizar la letra con la canción automáticamente
- Pedido: que la letra encontrada (LRCLIB) se ajuste sola a la canción que suena, quizás con reconocimiento de voz.
- Solo se puede hacer donde la app tiene el audio: MP3/WAV propio (y, si se hace, la captura en la APK). En un video de YouTube
  sin captura queda el ajuste manual (±¼ s y «La próxima línea empieza ahora").
- Opciones a medir:
  a) Corrimiento automático: detectar dónde entra la voz y encajar los comienzos de línea de la letra (barato, sin modelo nuevo).
  b) Alineación forzada con un modelo de voz chico en el teléfono (ubicar una letra conocida es más fácil que reconocerla de cero),
     con tiempo por línea o por palabra. Pesa decenas de MB; la música de fondo lo dificulta.
- Medir con las canciones de prueba antes de elegir.

## 2. (HECHO en v0.6.1) Introducción con guitarra eléctrica suave no reconocida («Mi semilla», La Vela Puerca)
- Síntoma: los primeros acordes (guitarra eléctrica, volumen bajo) no cambian; cuando entra la voz y la banda, mejora mucho
  (todavía se pierde algún cambio).
- Hipótesis a comprobar: el umbral de silencio y la normalización son globales, así que una intro suave frente a una canción fuerte
  se toma como «casi silencio» y el acorde se mantiene; además la distorsión y los efectos agregan armónicos.
- Plan: umbral y normalización relativos al volumen de cada tramo, y revisar cómo pesa la nota de la IA en tramos suaves. Medir con
  el MP3 de «Mi semilla» (pedírselo al usuario) y comprobar que las otras 6 canciones no empeoran.

## 3. Siguen fallando en «Carta» (después de v0.6.1)
- D7 y Dm7 de 1 s justo antes del I se leen como G (la voz y el Sol de la guitarra pesan más; el Fa# casi no suena).
- Gmaj7 → G (Fa# muy suave) y Cm7 → Cm.

## 4. (DESCARTADO) captura del audio de YouTube en la APK (decidido por el usuario, uso personal)
- Módulo nativo (Kotlin/Java en la APK) con AudioPlaybackCapture, solo el audio de la propia app (el reproductor de YouTube de adentro).
- Android pide el aviso de «grabar/transmitir pantalla» y el permiso que llama «micrófono» (el micrófono no se usa); en Android 14+
  notificación fija mientras dura la captura. Requiere Android 10+.
- El audio se analiza en trozos con el motor actual y no se guarda; quedan los acordes unidos al video.
- Modo «Escuchar y aprender»: la primera reproducción completa genera los acordes (con unos segundos de atraso); después se abren
  al instante. Va contra las condiciones de YouTube: experimental, apagado por defecto.
- No verificable en el entorno de desarrollo: probar en el teléfono del usuario en 2–3 vueltas.
- Antes: el usuario prueba la v0.6.1 y pasa lo que haya que corregir.

## 5. Prueba del usuario (después de v0.6.1) — PRIORIDADES
1. «Carta para no llorar» sigue mostrando G, C… sin séptimas. Revisar primero: ¿versión instalada (Ajustes → Versión 0.6.1)?,
   ¿modo «Avanzados» activado? (las séptimas solo salen ahí), ¿canción vuelta a analizar? (las guardadas conservan el análisis viejo).
   Si todo eso está bien y siguen sin salir, es un error a corregir. Propuesta: que la app pase sola a Avanzados (o avise) cuando
   detecta una canción con muchas séptimas, y que avise cuando una canción guardada se analizó con un motor anterior.
2. «Mi semilla»: mucho mejor; sobra un Mi entre La y Si. Revisar ese tramo con el MP3.
3. Letra de «Mi semilla» desincronizada (la de «Carta» está bien sincronizada). Pedido: que la letra no avance mientras no se canta
   (intro, partes habladas, público en vivo) y que arranque cuando empieza el canto; resaltar en negrita recién ahí.
   → Detectar dónde hay voz cantada (con las notas de la IA y/o un detector de voz) y encajar la primera línea al primer canto;
   después, corrimiento automático por línea (ver punto 1 de esta lista). Es versión en vivo: puede durar distinto que la letra de
   LRCLIB (elegir la versión de duración más parecida o estirar los tiempos).

## 6. Estado después de v0.6.2
- Hecho: acordes completos por defecto + «Simplificado»; volver a analizar; letra con intro y puntos de ajuste.
- No hecho: captura del audio de YouTube (no se implementa).
- Pendiente: Mi de paso entre La y Si en «Mi semilla» (probé unir acordes cortos: no mejoró); detección automática del canto.

## 7. (HECHO en v0.7.0, falta probar en el teléfono) PLAN v0.7
- Buscador único en la APK: al buscar, se abre dentro de la app la página de resultados de YouTube (versión móvil, sin cuenta ni
  clave). Al tocar un video, la app lo detecta (WebView nativa: doUpdateVisitedHistory / URL /watch?v=), cierra esa vista y lo
  abre en el reproductor. En la web: pestaña aparte + pegar enlace. La clave de YouTube queda opcional.
- Automático al elegir el video: letra de LRCLIB por título + duración (elige la versión de duración igual) y se abre el
  cancionero (LaCuerda / Cifra Club) ya en esa canción.
- «Importar acordes»: el usuario confirma en la página que está viendo (no se extrae nada automáticamente de esos sitios);
  la app une el cifrado (acorde sobre palabra) con los tiempos de LRCLIB → acordes con tiempo. Alternativa: «Pegar texto».
- Todo queda guardado junto en Mi cancionero (video + letra + acordes); «Empezó a cantar» ajusta letra y acordes juntos.
- La IA con audio propio sigue igual. Pendientes del motor: Mi de paso («Mi semilla»), D7 cortos («Carta»), detección del canto.
- No se implementa captura del audio de YouTube.

## 8. Prueba del usuario con v0.7.1 (HECHOS en v0.7.2: 2, 3, 4, 6, 7, 8, 9 — falta probar en el teléfono)
1. Canciones poco conocidas sin cifrado en la web → evaluar: IA con audio propio (ya existe), modo «Siguiente» (pegar solo la
   secuencia de acordes y tocar en cada cambio), compartir canciones entre usuarios (exportar/importar archivo).
2. A veces la letra encontrada NO es la de la canción → elección automática más estricta (título + artista + duración),
   mostrar cuál se eligió y poder cambiarla con un toque («No es esta letra» → lista de alternativas).
3. «Buscar la letra» lleva al buscador de videos → tiene que abrir una búsqueda SOLO de letras (lista de LRCLIB) y nada más.
4. Barra de reproducción mínima:
   - con archivo (sin video): solo play/pausa (mismo botón) y la línea de tiempo; nada más.
   - con video: el video pequeño + play/pausa + línea de tiempo.
   - el resto (−10/−5/+5/+10, bucle, velocidad, volumen) pasa a «⋯ Opciones». Todo el espacio libre para acordes y letra.
5. Revisar el fallo de la prueba automática «motor-ia» en GitHub Actions (falta el detalle del paso con ✘).
6. Analizado el video del usuario (15:26, «Buenas Noches audio.mp3», Eduardo Darnauchans):
   - Letra equivocada: con el nombre del archivo («Buenas Noches») se eligió sola «Buenas Noches – Say Mo» (2:05 contra 1:57).
     Causa: la regla nueva acepta coincidencia solo de título aunque no haya artista ni coincida la duración. → Con solo el
     título, NO elegir solo: ofrecer la lista. Elegir solo si coinciden título + artista, o título + duración ±3 s.
   - «Buscar la letra» abrió el buscador con «Buenas Noches — Say Mo» (la letra equivocada); al corregir y tocar «Buscar» se abrió
     YouTube (búsqueda de videos), no letras. → modo «buscar letra» propio: el botón Buscar busca SOLO letras mientras dure.
   - «Buscar solo la letra» dio «LRCLIB respondió 503» varias veces seguidas → evaluar una segunda fuente de letras de reserva y
     «Pegar letra» manual; mostrar el error con «Reintentar».
   - Bien: compás y carrusel funcionan con la grilla; la letra espera en la intro («la letra empieza en 0:19»).
   - Las opciones abiertas y el reproductor grande ocupan casi toda la pantalla (ver punto 4).
7. La letra (y la búsqueda en el cancionero) tienen que basarse en el VIDEO elegido, no en lo que se escribió en el buscador.
   - v0.7.1 ya busca la letra primero con el título del video, pero si no lo encuentra prueba con lo escrito (p. ej. solo
     «Julieta Venegas»), y la búsqueda en el cancionero y el botón «Buscar la letra» todavía usan lo escrito antes que el título.
   - Cambiar: usar solo el título del video (artista y canción separados por « - »; limpiar «(Video Oficial)», «Letra», «HD»,
     «Mix -», etc.); lo escrito se usa solo si el video no trae título. Con archivo propio: el nombre del archivo.
8. Separar lo que se usa siempre de las opciones avanzadas:
   - Fila de acciones a mano, fuera de «⋯ Opciones» (botones chicos debajo de la letra): «Letra» (buscar / cambiar letra),
     «Acordes» (buscar en cancionero / pegar / analizar mi audio).
   - «⋯ Opciones» ordenado en grupos plegables: «Para tocar» (transponer, cejilla, simplificados, velocidad, bucle, saltos),
     «Ajustar» (desfase, ajustes de letra, editar acordes), «Otros» (volver a analizar, demostración, Mi cancionero).
9. «+ Nueva» no limpia el buscador: queda el texto anterior, los resultados y el error viejo (p. ej. «LRCLIB respondió 503»).
   Causa: el buscador guarda su estado y «+ Nueva» no lo reinicia (sigue abierto, no se vuelve a crear). → Reiniciarlo por
   completo (texto, resultados de letras y videos, errores) al tocar «+ Nueva»; lo mismo para la búsqueda de letra.

## 9. PRÓXIMAS TANDAS (después de v0.7.2)
- v0.7.3: estética (colores, tipografía, tamaños, pantalla de inicio).
- Canciones sin cifrado en la web: modo «Siguiente» (pegar solo la secuencia de acordes) y compartir/exportar canciones.
- Segunda fuente de letras de reserva cuando LRCLIB falla (evaluar).
- Motor: Mi de paso en «Mi semilla», D7/Dm7 cortos en «Carta», Gmaj7/Cm7; detección automática del canto para la letra.
- Firma fija de la APK (para actualizar sin desinstalar) + copia de seguridad de Mi cancionero.
- Revisar el fallo de «motor-ia» en GitHub Actions (falta el detalle del paso con ✘).

## 10. Prueba del usuario con v0.7.2 (HECHO en v0.8.0, falta probar en el teléfono)
- El motor de IA para MP3/WAV propio NO se toca por ahora.
- YouTube queda como está: los acordes del cifrado siguen avanzando solos con la letra.
1. Búsqueda en el cancionero con texto limpio: «canción + artista principal + acordes». Sacar «(Feat. …)», «ft.», paréntesis,
   corchetes, «En vivo», «Official…», lo que sigue a «|», años, y NO usar «site:… OR site:…» (Google no encontraba nada).
   Caso real: título «Coti (Feat. Paulina Rubio & Julieta Venegas) Nada Fué Un Error»; el artista de LRCLIB trae el «(Feat. …)».
   Con «nada de esto fue un error acordes» salían Cifra Club y LaCuerda primeros. Hacer pruebas con títulos reales.
2. Acordes que se pierden al importar: el cifrado y la letra cortan las líneas distinto («Y tú, y tú» [E] + «No quisiste fallar»
   en Cifra Club = una sola línea en LRCLIB) → la E se descarta (reproducido: 5 de 6 acordes). Unir palabra por palabra en vez de
   línea por línea; estribillos escritos una vez se repiten donde se vuelven a cantar.
3. Marcar los cambios a mano: Cifra Club sirve de referencia pero puede estar mal o a destiempo (el cifrado dice sobre qué palabra,
   no el momento exacto). Si un acorde no cae bien, modo «Marcar cambios»: con la progresión que ya está cargada, mientras suena
   tocás un botón grande en cada cambio («acá cambia») y la app corre ese acorde a ese momento. Poder rehacer desde un punto
   hasta que quede bien; se guarda en Mi cancionero. (Opcional a evaluar: ajustar el toque al pulso más cercano.)
- Además sigue pendiente: estética, modo «Siguiente»/compartir, segunda fuente de letras, firma fija de la APK + copia de
  seguridad, y la versión web que falla en GitHub Actions (build y prueba «motor-ia»).
4. Incluir también en la próxima versión: modo «Siguiente», compartir canciones (exportar/importar archivo), firma fija de la
   APK (clave como secreto de GitHub, nunca en el repositorio) + copia de seguridad del cancionero.
5. Estética: MANTENER los colores (tema oscuro actual) y la parte de acordes. Mejorar el diseño para que sea más amigable y
   menos «de prueba» (ideas en conversación, a definir juntos).
6. Logo de la app + pantalla de carga de ~1 s: logo grande, «Mi Cancionero», versión abajo en la esquina; poco más.
7. Pantalla de carga: debajo de la versión, atribución chica: «Idea: Agustín Salazar · Hecha con Claude · Uruguay» (texto a ajustar).
8. Mate: en la pantalla de carga junto al cuaderno, en «Mi cancionero» vacío y como animación mientras analiza (vapor del mate).
   NO en el ícono (muy chico).
9. Ícono de la app: cuadernito con un diagrama de acorde (o letras A, G) — formas simples que se lean a 48 px.

## 11. Después de v0.8.0
- Probar en el teléfono: ícono, pantalla de carga, marcar cambios, modo Siguiente, compartir (WhatsApp) y copia/importar.
- La primera instalación con la firma fija necesita desinstalar una última vez (la clave anterior era de depuración).
- Pendientes de antes: segunda fuente de letras, motor (Mi de paso, D7 cortos, Gmaj7/Cm7), detección del canto,
  abrir un .cancionero directamente desde WhatsApp (hoy: guardarlo y usar «Importar»).

## 12. v0.8.1 (revisión del código, 20/10/2026)
Hecho y verificado en el código (se deja igual):
- Interfaz: acciones «Letra / Acordes / Opciones», barra mínima, opciones agrupadas (sección 8, puntos 4 y 8); estética de la v0.8.0.
- Logo, ícono, pantalla de carga con versión y atribución, mate (sección 10, puntos 6 a 9).
- Modo «Siguiente», «Marcar cambios», compartir, copia de seguridad e importar; firma fija en GitHub Actions.
- Letra: elección automática estricta, «No es esta letra», búsqueda solo de letras, «+ Nueva» limpia el buscador.
- Cifrado unido palabra por palabra; búsqueda del cancionero con texto limpio.
- La prueba «motor-ia» y la versión web pasan en GitHub Actions.
Nuevo en v0.8.1:
- Al elegir un video nuevo, la pantalla principal se limpia (lo anterior queda en Mi cancionero).
- Ningún acorde del cifrado se pierde por caer pegado a otro (mínimo 0,5 s entre cambios); el buscador de acordes prioriza LaCuerda.
- Letras desde una página web: «Buscar la letra en una página» (en el aviso de letra no encontrada, en la lista de letras sugeridas
  y en el panel «Letra»). En la APK se abre dentro de la app; se puede seleccionar la letra en la página o tocar «Importar letra»
  directamente; el texto se limpia y queda en «Pegar letra» para revisarlo. En la web: pestaña aparte + pegar.
- Compartir como `.cancionero.txt` (text/plain) con permiso de lectura explícito, y botón «Guardar archivo».
- Número de versión 0.8.1 visible en la pantalla de carga y Ajustes.
A probar en el teléfono: todo lo anterior (la parte nativa no se puede probar fuera del teléfono).
Sigue pendiente:
- «Zafar» (La Vela Puerca): el Dm se quedaba ~17 s aunque la página trae Am-Dm-G en cada línea → hace falta el archivo de la canción
  («Guardar archivo») para reproducirlo.
- Abrir un .cancionero directamente desde WhatsApp (hoy: guardarlo e «Importar»).
- Segunda fuente automática de letras (la página web cubre el caso a mano).
- Sincronizar la letra sola con el canto (sección 1) — investigación.
- Motor de audio propio (Mi de paso, D7 cortos, Gmaj7/Cm7): en pausa por decisión del usuario.

## 13. v0.8.2 (con la copia del cancionero del usuario, 20/10/2026)
- «Zafar»: solo 15 cambios de acorde en toda la canción. Causas encontradas con los datos guardados:
  1. La página escribe los acordes con punto («Am.», «Dm.»): no se reconocían y quedaban como letra. → Se aceptan.
  2. Las líneas de tablatura de la intro («E|---0---|») se tomaban como letra. → Se ignoran.
  3. La estrofa se repite al final de la canción y los acordes se unían a la última aparición (la primera quedaba sin cambios).
     → Se unen a la primera; las repeticiones se completan como antes.
  4. Solo se importaba el bloque <pre> más largo; LaCuerda puede partir la canción en varios. → Se importan todos, en orden.
  Con la copia: «Zafar» pasa de 15 a 41 cambios (estrofa Am-Dm-G en cada línea); las otras canciones quedan igual o mejor.
  Las canciones guardadas se recalculan solas al abrirlas (salvo las corregidas a mano). Para el estribillo de «Zafar» hay que
  volver a importar los acordes con la v0.8.2 (la importación anterior no lo trajo).
- Compartir quedaba «cargando» en WhatsApp y otras apps. Causa más probable: la otra app leía el archivo desde Mi Cancionero, que
  en segundo plano puede quedar congelada. → En Android 10+ el archivo se guarda en Descargas/Mi Cancionero y se comparte desde
  ahí (lo sirve el sistema). Si igual falla, el archivo queda en Descargas para adjuntarlo a mano. A confirmar en el teléfono.

## 14. v0.8.2 — prueba con 10 canciones del usuario (copia «cancionero_V08.1»)
- Los cancioneros escriben los acordes solo la primera vez de cada estrofa/estribillo. → Las estrofas de la letra sincronizada
  (cortadas en líneas vacías, silencios largos o, si no hay, en cuartetas) que quedan casi sin acordes copian los de la estrofa
  anterior más parecida, línea por línea. «Brindis por Pierrot» 89 → 242 cambios; «Orejano» 27 → 2 líneas sin acorde; «Alfonsina»,
  «Doña Soledad», «Zafar» mejoran mucho. Partes que la página no trae (puente de «Bicho de ciudad») quedan sin acordes: no se inventan.
- «Gurisito» no se podía importar: LaCuerda escribe «RE», «SOL5», «LA4», «MIm», «Solº», «A)RE» y tablatura con cuerdas latinas.
  → Se leen (en minúsculas sin nada más, «la», «mi», «si», siguen siendo palabras de la letra).
- Ajustar la letra: ±¼ s funcionaba pero no se notaba. → «⚙ Ajustar letra»: «Esta línea empieza ahora» (también si la letra va
  adelantada), «La próxima empieza ahora», «Sincronizar tocando» (tocar en la lista cada línea cuando se canta) y correr todo ±1/±5 s.
  Aviso cuando la letra de LRCLIB es de otra grabación (duración distinta).
- Tono y cejilla de la página («Tono: G», «Capo en 2», «Capotraste na 2ª casa»): se leen, se muestran y no se confunden con acordes.
- Sin letra de LRCLIB: se usa la letra de la página de acordes (sin tiempos), automáticamente al importar o con un botón.
- Pendiente: «Loco en el desierto» y «Zafar» siguen con líneas sin acordes (importación incompleta: volver a importar con v0.8.2).
- Pedido del usuario (hecho en v0.8.2): sin letra sincronizada, la letra de la página de acordes sigue a los acordes (cada línea
  aparece con su primer acorde). Si los acordes se marcaron a mano con buenos tiempos, la letra queda bien sin LRCLIB.
- También en v0.8.2 (elegidos por el usuario, 1 a 4):
  1. «Ajustar la letra a esta grabación»: con la letra de otra grabación, un toque la estira o achica a la duración del video
     (dos puntos de ajuste); después se afina con «Esta línea empieza ahora».
  2. Abrir un archivo de Mi Cancionero desde WhatsApp, Descargas, etc. («Compartir» o «Abrir con → Mi Cancionero»): se importa solo.
  3. Al importar acordes, aviso de las partes de la letra que la página no trae (p. ej. el estribillo de «Zafar»).
  4. Segunda fuente de letras (lyrics.ovh, solo texto) cuando LRCLIB no responde o no encuentra: se ofrece para elegir.
  A probar en el teléfono: 2 (parte nativa) y 4 (que lyrics.ovh responda).
- Siguen para después: «Marcar cambios» por estrofa, sincronizar la letra con el canto (audio propio), motor de IA (en pausa).

## 15. v0.8.3 — prueba automática con 45 canciones de LaCuerda (desde el Chrome del usuario)
- Método: LaCuerda (cifrado completo) + LRCLIB (letra sincronizada) traídos desde el navegador del usuario y pasados por el mismo
  código de la app; los textos no se guardan en el repositorio. Chordify no se automatizó (cupo gratis «0/2» y sus condiciones).
- Nuevas notaciones leídas: acordes unidos con guiones («Bm-G-D-A», «(Bm-G-D-A)»), extensiones con barra («F#7/9», «6/9»),
  etiquetas sin «:» en la línea de acordes («INTRO Bm Em7 … x 2»), comentarios junto a 3+ acordes («FA#m RE LA Tablatura abajo»),
  notaciones propias («B7.9», «F7.13», «E(s3)6», «C#7[4- 3]», «F#m7*»), tablaturas con prefijo («1) G|--4--») o sin barra («e-0-2-3»).
- Estrofas repetidas: el modelo puede ser la mitad de una estrofa larga, se compara también el largo de las líneas, y la parte que
  sigue a un modelo tiene preferencia (estribillo en dos mitades). «Brindis por Pierrot»: 4 de 91 líneas sin acorde, con cada
  estrofa y cada mitad del estribillo con sus acordes.
- Aviso al importar: qué partes no trae la página y si se completaron copiando una estrofa parecida (para revisarlas).
- Desde el navegador, LRCLIB responde (la letra automática funciona en la versión web).
- Resultado en las 45 canciones: 173 de 1378 líneas cantadas sin acorde antes de los últimos ajustes de estrofas; el resto son en
  su mayoría acordes que se mantienen o partes que la página no trae. Quedan sin leer errores de tipeo de la página («An», «Bsdim»).
- Comparación con Chordify (mismo video; autorizada por el usuario, 2 canciones): «Zafar» (Chordify: La menor, 100 BPM, 441,3 Hz) y
  «Doña Soledad» (Si mayor, 111 BPM, 444,9 Hz). Con v0.8.3 la cantidad de cambios ya se parece (Zafar 68 contra 70), pero los acordes
  de la app caen ~0,5 s ANTES que en Chordify: LRCLIB marca el comienzo del canto y el acorde entra en el tiempo fuerte, después de
  las primeras sílabas. Correr 0,5 s: Zafar 44 % → 59 % del tiempo igual a Chordify; Doña Soledad 54 % → 59 %. A decidir con el usuario
  (puede sentirse «más lento»; existe el ajuste «adelantar en pantalla»). Mostrar la afinación en Hz (el motor ya la estima).
- Medición contra referencias exactas (corpus ChoCo / Isophonics: acordes marcados al segundo sobre la grabación original), 31 canciones
  de The Beatles y Queen con cifrado de Cifra Club + letra de LRCLIB (misma duración que la grabación), pasadas por el código de v0.8.3:
  · Acorde correcto el 34 % del tiempo; 48 % si se tiene en cuenta que muchos cifrados están en otro tono (cejilla o afinación:
    «Michelle» cejilla 5, «In My Life» y «Norwegian Wood» cejilla 2, «Yesterday» guitarra un tono abajo).
  · Error mediano de cada cambio de acorde: 0,65 s (en varias canciones 1–1,5 s): el punto débil es repartir los acordes dentro de
    cada línea por la cantidad de letras.
  · Correr todo 0,5 s más tarde EMPEORA el promedio (34 % → 30 %): no se aplica (la comparación con Chordify en 2 canciones decía lo
    contrario; con 31 referencias exactas no se sostiene).
  · Fallan del todo los cifrados sin acordes sobre la letra (solo tablatura: «Blackbird», «We Will Rock You»).
  Próximo paso propuesto: ubicar los cambios dentro de la línea con un pulso regular estimado de la propia letra en vez de por letras.

## 16. v0.8.4 — medición con 163 canciones con referencia exacta (ChoCo: The Beatles, Queen)
- Datos traídos desde el Chrome del usuario (Cifra Club + LRCLIB de igual duración + anotaciones ChoCo desde GitHub) y guardados
  en el navegador (IndexedDB «mc-eval» en cifraclub.com) para próximas rondas; nada de eso entra al repositorio.
- Hallazgos:
  · El 78 % de los cambios de acorde caen en el primer tiempo del compás (12 % en el tercero).
  · Ubicar los acordes sobre el pulso: aun con el compás real, el acierto total sube solo ~2 puntos; estimar el compás solo con
    la letra no fue fiable (empeora). Queda para cuando haya pulso del audio (MP3 propio).
  · Lo que funciona: ubicar las palabras solo en la parte cantada de cada línea (no estirarlas hasta el silencio siguiente).
- Cambio aplicado (versión prudente: ritmo de canto típico de la canción, solo comprime líneas seguidas de una pausa):
  grupo de comprobación 53,2 % → 55,7 %; error típico 0,69 → ~0,6 s; no empeora Queen (48,2 → 48,4 %); empeora 26 de 163.
  (La versión agresiva daba 56,9 % pero empeoraba Queen y «Zafar»; se descartó por el repertorio del usuario.)
- Dónde se pierde el resto: con tolerancia de ±0,5 s el acierto sería 66,6 %, ±1 s 73,4 %, ±2 s 79,3 %; el cifrado trae el acorde
  correcto el 96 % del tiempo. O sea: el límite es el tiempo exacto dentro de la línea, no los acordes. LRCLIB no trae tiempos
  por palabra en ninguna de las 181 letras.

## 17. v0.8.5 — «Marcar pulso» (pedido del usuario: la música va por compás y tiempos)
- Medido con 145 canciones con referencia exacta (pulsos reales de ChoCo):
  · Ubicar los acordes de cada línea en tiempos completos, con fuerte preferencia por el «uno»: conociendo el pulso real,
    acierto 54,7 % → 58,3 % y error típico de cada cambio 0,64 → 0,10 s.
  · Simulando que el usuario marca el «uno» durante toda la canción (con ±60 ms de imprecisión): 58,1 % y 0,13 s.
  · Marcar solo 4–8 compases al principio NO sirve: el pulso de las grabaciones varía (la rejilla se corre ~1,75 s al final,
    mediana; >4 s en 1 de cada 4). Re-anclar en cada línea con la letra tampoco alcanzó (~55 %).
- Implementado: «Acordes» → «Marcar pulso» (solo canciones de cancionero con letra sincronizada). Botón grande «Uno» mientras
  suena; compás 2/4, 3/4, 4/4, 5/4, 6/8, 12/8 (con tiempo fuerte intermedio); Deshacer, Borrar marcas, «Listo: acomodar acordes». Se guarda en la canción (taps) y los acordes
  de las líneas marcadas se ubican sobre esos pulsos; lo no marcado queda como antes. No pisa correcciones hechas a mano.
- Sin marcar el compás la app no puede conocer los tiempos en YouTube (no tiene el audio). Probado repartir la línea en cuartos
  sin pulso: arregla duraciones como «Zafar» (Am 2 tiempos, Dm 1, G 1) pero queda corrido por el comienzo del canto; no se aplicó.
- Barra de compás (pedido: simple y bien a la vista): un casillero por tiempo, más alto, el acorde escrito grande en el tiempo donde
  entra (el que sigue sonando al empezar el compás, atenuado), tiempo actual en color de acento, el «uno» con borde a la izquierda,
  avanza de compás en compás (2 compases a la vista; 1 en 6/8 y 12/8). Con «Marcar pulso» usa los «uno» marcados y el compás elegido.

## 18. v0.8.6 — barra de compás (video del 21/10)
- Nombres cortados («E…», «Ds…»): ahora el nombre ocupa los casilleros vacíos que le siguen dentro del compás y achica la letra
  solo si hace falta; casilleros más bajos (h-11).
- Acordes salteados: antes solo se escribía el acorde que sonaba justo en el golpe; un acorde que entraba entre golpes no aparecía.
  Ahora cada acorde se asigna al tiempo donde entra (lib/beatgrid.ts) y si entran dos en el mismo tiempo se escriben los dos.
- Zafar (G corto): las líneas de LRCLIB empiezan en la anacrusa (~0,6–0,8 s antes del «uno»), así que el Am siguiente entra antes
  y le roba tiempo al G (Am 2,8 s · Dm 1,5 · G 0,5). Simulado con «Marcar pulso» (uno cada 2,4 s): Am 2,5 · Dm 1,2 · G 1,2 = lo
  correcto. Sin pulso marcado no hay forma confiable de saberlo (un corrimiento general empeora el promedio, ya medido).
- «Marqué el pulso en Zafar y no cambió nada»: lo más probable es que se marcó cada golpe (el nombre «pulso» lo invita) y la app
  tomaba cada marca como un compás → compases de 0,6 s, los acordes casi no se movían (simulado: G 0,7 s). Ahora barsFromTaps
  acepta las dos formas: si las marcas son golpes, la primera es un «uno» y se toma una de cada N golpes (6/8: 2, 12/8: 4),
  tolerando golpes salteados. El «uno» no se puede deducir de los acordes (con los tiempos de la letra caen en cualquier golpe
  por igual, medido), por eso se pide empezar en un «uno». Zafar simulado marcando golpes: Am 2,4 · Dm 1,2 · G 1,2.
- placeOnBeats: dos líneas podían poner acordes en el mismo golpe y uno desaparecía; ahora no se repite golpe.

## 19. v0.8.7 — barra de tiempos como cinta (video del 21/10, 18:01)
- Pedido: que la barra de arriba corra con la canción como una línea (no casilleros fijos donde solo cambia el contenido), que se
  pueda mover para adelante y atrás como el carrusel de acordes. Hecho: cinta con todos los tiempos de la canción, «ahora» fijo
  (línea blanca al 30 %), el tiempo actual subrayado, cada acorde escrito donde entra y ocupando hasta el siguiente (nombre
  completo, el que suena en color). Se arrastra para mirar (vuelve sola a los 3 s); tocar un tiempo lleva la canción ahí.
  Abajo dice «pulso marcado» o «pulso estimado».
- Zafar en el video seguía con los tiempos sin marcar (Dm 35,4 · G 37,2 · Am 37,7). Las marcas guardadas con la 0.8.5 (cada golpe)
  ahora también se convierten a compases al abrir la canción. Si sigue igual: pedir la copia de seguridad para ver las marcas.
- «Marcar los cambios a mano» con el acorde quieto (pedido: en Zafar el G pasaba antes de poder tocarlo): mientras se marca, el
  acorde en pantalla no se va hasta tocar el botón; el toque hace empezar AL SIGUIENTE de la secuencia (no al que la app tenía en
  ese segundo), así no se saltea ninguno aunque en la app durara menos. Deshacer vuelve al acorde anterior; si se retrocede el video
  se sigue desde el acorde de ese momento.
- Interfaz más limpia (pedido): se sacaron «Marcar a mano» (armar acordes desde cero sobre el video), el «Marcar los cambios a mano»
  repetido en Opciones, «Desfase/Alinear», las casillas «Inicio (s)/Fin (s)», «Ver secuencia de demostración» y «Analizar mi audio
  con la IA» dentro de Acordes (sigue en la pantalla de inicio). Quedan «Marcar los cambios a mano» (acorde quieto) y «Marcar pulso».

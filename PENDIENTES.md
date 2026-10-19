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

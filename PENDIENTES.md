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

// Prueba de extremo a extremo en navegadores reales (GitHub Actions): abre la web compilada con ?selftest=1 en Chromium (motor de
// Chrome y del WebView de Android) y WebKit (Safari), espera el resultado de la prueba del motor de IA y falla si no funciona.
import { chromium, webkit } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/?selftest=1'
let failed = 0
for (const [name, type] of [['Chromium (Chrome / WebView de Android)', chromium], ['WebKit (Safari)', webkit]]) {
  const browser = await type.launch()
  const page = await browser.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  try {
    await page.goto(url)
    const r = await page.waitForFunction(() => window.__selftest, null, { timeout: 180000 }).then((h) => h.jsonValue())
    console.log(`\n${name}: ${r.ok ? 'FUNCIONA' : 'FALLÓ'}${r.error ? ` (${r.error})` : ''}`)
    console.log(`  notas detectadas: ${(r.foundPitchClasses ?? []).join(' ')} · carga ${Math.round(r.loadMs ?? 0)} ms · ${Math.round(r.msPerWindow ?? 0)} ms/ventana · ${(r.secPerAudioMinute ?? 0).toFixed(1)} s por minuto de audio (servidor de CI, no un teléfono)`)
    if (!r.ok) { failed++; console.log(`::error title=Motor de IA (${name})::${r.error ?? 'no detectó Do-Mi-Sol'}`) }
  } catch (e) { console.log(`\n${name}: ERROR ${e.message}`); console.log(`::error title=Motor de IA (${name})::${e.message.split('\n')[0]}`); failed++ }
  if (errors.length) console.log('  errores de consola:', errors.slice(0, 5).join(' | '))
  await browser.close()
}

// Prueba de interfaz (Chromium): «+ Nueva», pegar acordes para un video de YouTube, guardado local y reapertura automática.
// No depende de que YouTube cargue: la marca usa el tiempo del reproductor (0 s si el video no llegó a cargar).
{
  const browser = await chromium.launch(), page = await browser.newPage(), errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // ::error:: hace que el fallo aparezca como anotación en GitHub (se ve sin abrir el registro completo)
  const step = async (label, fn) => { try { await fn(); console.log(`  ✔ ${label}`) } catch (e) { const m = e.message.split('\n')[0]; console.log(`  ✘ ${label}: ${m}`); console.log(`::error title=Prueba de interfaz::${label}: ${m}`); failed++ } }
  console.log('\nInterfaz (Chromium):')
  const base = url.replace(/[?#].*$/, '')
  await step('carga la app', () => page.goto(base))
  const search = page.getByPlaceholder('Canción, artista o enlace de YouTube')
  const pick = async () => { await search.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); await search.press('Enter') }
  await step('elegir un video por enlace', pick)
  await step('pegar un cifrado para el video (sin acordes todavía)', async () => {
    await page.getByRole('button', { name: 'Pegar cifrado' }).first().click({ timeout: 10000 })
    await page.getByLabel('Cifrado').fill('C           G\nPrimera línea de prueba\nAm          F\nSegunda línea de prueba')
    await page.getByRole('button', { name: 'Usar estos acordes' }).click()
  })
  await step('aparecen los acordes y la canción queda en «Mi cancionero»', async () => {
    await page.getByLabel('Secuencia de acordes').waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Abrir Mi cancionero' }).click()
    await page.getByRole('dialog', { name: 'Mi cancionero' }).getByText('acordes del cancionero').first().waitFor({ timeout: 10000 })
    await page.getByRole('dialog', { name: 'Mi cancionero' }).getByRole('button', { name: 'Cerrar' }).click()
  })
  await step('«Nueva canción» vuelve al inicio sin recargar y limpia el buscador', async () => {
    await page.getByRole('button', { name: 'Nueva canción', exact: true }).click()
    await page.getByText('Buscá una canción o elegí un MP3/WAV para empezar.').waitFor({ timeout: 10000 })
    if (await search.inputValue()) throw new Error('el buscador conserva el texto anterior')
  })
  await step('al volver a elegir el video, sus acordes se abren solos', async () => {
    await pick(); await page.getByLabel('Secuencia de acordes').waitFor({ timeout: 10000 })
  })
  await step('las opciones están ocultas hasta tocar «⋯ Opciones»', async () => {
    if (await page.getByText('Transponer').count()) throw new Error('las opciones se ven sin abrirlas')
    await page.getByRole('button', { name: '⋯ Opciones' }).click()
    await page.getByText('Transponer').first().waitFor({ timeout: 5000 })
    await page.getByRole('button', { name: 'Ocultar', exact: true }).click()
  })
  await step('pegar un cifrado crea acordes para el video', async () => {
    await page.getByRole('button', { name: 'Acordes', exact: true }).click()
    await page.getByRole('button', { name: 'Pegar cifrado' }).first().click({ timeout: 10000 })
    await page.getByLabel('Cifrado').fill('Am          G\nPrimera línea de prueba\nF           E\nSegunda línea de prueba')
    await page.getByRole('button', { name: 'Usar estos acordes' }).click()
    await page.getByLabel(/^Am \d+,/).first().waitFor({ timeout: 10000 })
  })
  await step('«Marcar los cambios a mano» muestra el botón grande para marcar', async () => {
    await page.getByRole('button', { name: 'Acordes', exact: true }).click()
    await page.getByRole('button', { name: 'Marcar los cambios a mano' }).first().click({ timeout: 10000 })
    await page.getByRole('button', { name: /^.?\s*Cambia a / }).waitFor({ timeout: 5000 })
    await page.getByRole('button', { name: 'Listo', exact: true }).click()
  })
  await step('escribir una secuencia y avanzar con «Siguiente»', async () => {
    await page.getByRole('button', { name: 'Nueva canción', exact: true }).click()
    await page.getByRole('button', { name: /Escribir acordes/ }).first().click()
    await page.getByLabel('Nombre de la canción').fill('Prueba Siguiente')
    await page.getByLabel('Secuencia de acordes escrita').fill('Am F C G')
    await page.getByRole('button', { name: 'Usar en modo Siguiente' }).click()
    await page.getByText('Acorde 1 de 4').waitFor({ timeout: 5000 })
    await page.getByRole('button', { name: /^Siguiente: F/ }).click()
    await page.getByText('Acorde 2 de 4').waitFor({ timeout: 5000 })
  })
  await step('Mi cancionero tiene copia de seguridad e importar', async () => {
    await page.getByRole('button', { name: 'Abrir Mi cancionero' }).click()
    await page.getByRole('button', { name: /Copia de seguridad/ }).waitFor({ timeout: 5000 })
    await page.getByLabel('Importar canción o copia').waitFor({ state: 'attached', timeout: 5000 })
    await page.getByRole('dialog', { name: 'Mi cancionero' }).getByRole('button', { name: 'Cerrar' }).click()
  })
  // Letras (LRCLIB) desde el navegador: si falla, la web no puede consultar LRCLIB (CORS); la APK usa la capa nativa y no depende de esto.
  try {
    await page.getByRole('button', { name: 'Nueva canción', exact: true }).click()
    await search.fill('guitarrero viejo zitarrosa'); await search.press('Enter')
    await page.getByText('letra con tiempos').first().waitFor({ timeout: 20000 })
    await page.getByText('letra con tiempos').first().click()
    await page.getByText('letra de LRCLIB').first().waitFor({ timeout: 10000 })
    console.log('  ✔ letras: búsqueda en LRCLIB desde el navegador y letra guardada (informativo)')
  } catch (e) { console.log(`  ⚠ letras desde el navegador no funcionaron (informativo, no falla la prueba): ${e.message.split('\n')[0]}`) }
  if (errors.length) console.log('  errores de página (informativo):', errors.slice(0, 5).join(' | '))
  await browser.close()
}
process.exit(failed ? 1 : 0)

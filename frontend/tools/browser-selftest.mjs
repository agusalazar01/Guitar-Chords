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
    if (!r.ok) failed++
  } catch (e) { console.log(`\n${name}: ERROR ${e.message}`); failed++ }
  if (errors.length) console.log('  errores de consola:', errors.slice(0, 5).join(' | '))
  await browser.close()
}

// Prueba de interfaz (Chromium): «+ Nueva», marcar acordes sobre un video de YouTube, guardado local y reapertura automática.
// No depende de que YouTube cargue: la marca usa el tiempo del reproductor (0 s si el video no llegó a cargar).
{
  const browser = await chromium.launch(), page = await browser.newPage(), errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const step = async (label, fn) => { try { await fn(); console.log(`  ✔ ${label}`) } catch (e) { console.log(`  ✘ ${label}: ${e.message.split('\n')[0]}`); failed++ } }
  console.log('\nInterfaz (Chromium):')
  const base = url.replace(/[?#].*$/, '')
  await step('carga la app', () => page.goto(base))
  const search = page.getByPlaceholder('Canción, artista o enlace de YouTube')
  const pick = async () => { await search.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); await search.press('Enter') }
  await step('elegir un video por enlace', pick)
  await step('abrir «Marcar a mano»', () => page.getByRole('button', { name: 'Marcar a mano' }).first().click({ timeout: 10000 }))
  await step('marcar un acorde (C)', () => page.getByRole('button', { name: 'C', exact: true }).first().click({ timeout: 10000 }))
  await step('aparecen los acordes y la canción queda en «Mi cancionero»', async () => {
    await page.getByLabel('Secuencia de acordes').waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Abrir Mi cancionero' }).click()
    await page.getByRole('dialog', { name: 'Mi cancionero' }).getByText('acordes marcados').first().waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Cerrar' }).click()
  })
  await step('«+ Nueva» vuelve al inicio sin recargar', async () => {
    await page.getByRole('button', { name: '+ Nueva', exact: true }).click()
    await page.getByText('Buscá una canción o elegí un MP3/WAV para empezar.').waitFor({ timeout: 10000 })
  })
  await step('al volver a elegir el video, sus acordes se abren solos', async () => {
    await pick(); await page.getByLabel('Secuencia de acordes').waitFor({ timeout: 10000 })
  })
  await step('las opciones están ocultas hasta tocar «⋯ Opciones»', async () => {
    if (await page.getByText('Transponer').count()) throw new Error('las opciones se ven sin abrirlas')
    await page.getByRole('button', { name: '⋯ Opciones' }).click()
    await page.getByText('Transponer').first().waitFor({ timeout: 5000 })
    await page.getByRole('button', { name: 'Ocultar opciones' }).click()
  })
  await step('pegar un cifrado crea acordes para el video', async () => {
    await page.getByRole('button', { name: '⋯ Opciones' }).click()
    await page.getByRole('button', { name: 'Pegar cifrado' }).first().click({ timeout: 10000 })
    await page.getByLabel('Cifrado').fill('Am          G\nPrimera línea de prueba\nF           E\nSegunda línea de prueba')
    await page.getByRole('button', { name: 'Usar estos acordes' }).click()
    await page.getByLabel(/^Am \d+,/).first().waitFor({ timeout: 10000 })
  })
  // Letras (LRCLIB) desde el navegador: si falla, la web no puede consultar LRCLIB (CORS); la APK usa la capa nativa y no depende de esto.
  try {
    await page.getByRole('button', { name: '+ Nueva', exact: true }).click()
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

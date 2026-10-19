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
  await step('abrir «Marcar los acordes de este video»', () => page.getByRole('button', { name: 'Marcar los acordes de este video' }).click({ timeout: 10000 }))
  await step('marcar un acorde (C)', () => page.getByRole('button', { name: 'C', exact: true }).first().click({ timeout: 10000 }))
  await step('aparece la canción marcada y queda guardada', async () => {
    await page.getByText('acordes marcados a mano sobre el video').first().waitFor({ timeout: 10000 })
    await page.getByText('marcada sobre video').first().waitFor({ timeout: 10000 })
  })
  await step('«+ Nueva» vuelve al inicio sin recargar', async () => {
    await page.getByRole('button', { name: '+ Nueva' }).click()
    await page.getByText('Todavía no hay acordes').waitFor({ timeout: 10000 })
  })
  await step('al volver a elegir el video, sus acordes se abren solos', async () => {
    await pick(); await page.getByText('acordes marcados a mano sobre el video').first().waitFor({ timeout: 10000 })
  })
  if (errors.length) console.log('  errores de página (informativo):', errors.slice(0, 5).join(' | '))
  await browser.close()
}
process.exit(failed ? 1 : 0)

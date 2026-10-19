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
process.exit(failed ? 1 : 0)

// Se ejecuta en GitHub Actions después de «npx cap add android»: agrega «Compartir → Mi Cancionero» (intent SEND de texto) y la
// MainActivity que entrega el enlace a la página. Falla con un mensaje claro si la plantilla de Capacitor cambió.
import fs from 'node:fs'
const man = 'android/app/src/main/AndroidManifest.xml'
let xml = fs.readFileSync(man, 'utf8')
if (!xml.includes('android.intent.action.SEND')) {
  const i = xml.indexOf('</intent-filter>')
  if (i < 0) throw new Error('No encontré el intent-filter principal en ' + man)
  const extra = `</intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>`
  xml = xml.slice(0, i) + extra + xml.slice(i + '</intent-filter>'.length)
  fs.writeFileSync(man, xml)
}
if (!/launchMode="singleTask"/.test(xml)) console.warn('Aviso: la actividad no es singleTask; compartir abrirá otra instancia.')
const act = 'android/app/src/main/java/app/guitarchords/MainActivity.java'
if (!fs.existsSync(act)) throw new Error('No encontré ' + act)
fs.copyFileSync('android-extra/MainActivity.java', act)
fs.copyFileSync('android-extra/WebPickerPlugin.java', act.replace('MainActivity.java', 'WebPickerPlugin.java'))
console.log('Android: compartir desde YouTube y WebPicker configurados.')

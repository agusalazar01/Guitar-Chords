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

// v0.8.0: ícono (cuaderno con diagrama de acorde), pantalla de inicio nativa oscura con el ícono, archivos para compartir y
// firma fija opcional (si GitHub Actions entrega la clave en MC_KEYSTORE; la clave nunca está en el repositorio).
const res = 'android/app/src/main/res'
fs.cpSync('android-extra/res', res, { recursive: true, force: true })
xml = fs.readFileSync(man, 'utf8')
if (!xml.includes('.mcfiles')) {
  const i = xml.lastIndexOf('</application>')
  if (i < 0) throw new Error('No encontré </application> en ' + man)
  const prov = `    <provider android:name="androidx.core.content.FileProvider" android:authorities="\${applicationId}.mcfiles"
            android:exported="false" android:grantUriPermissions="true">
            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/mc_file_paths" />
        </provider>
    `
  xml = xml.slice(0, i) + prov + xml.slice(i)
  fs.writeFileSync(man, xml)
}
const styles = `${res}/values/styles.xml`
if (fs.existsSync(styles)) {
  let st = fs.readFileSync(styles, 'utf8')
  if (st.includes('@drawable/splash')) st = st.replaceAll('@drawable/splash', '@drawable/mc_launch')
  else console.warn('Aviso: no encontré @drawable/splash en styles.xml (pantalla de inicio nativa sin cambiar).')
  if (/parent="Theme\.SplashScreen"/.test(st) && !st.includes('windowSplashScreenBackground')) {
    st = st.replace(/(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)/, `$1
        <item name="windowSplashScreenBackground">@color/mc_icon_bg</item>
        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>`)
  }
  fs.writeFileSync(styles, st)
} else console.warn('Aviso: no encontré ' + styles)
const gradle = 'android/app/build.gradle'
let g = fs.readFileSync(gradle, 'utf8')
if (!g.includes('signingConfigs.mc')) {
  const i = g.indexOf('android {')
  if (i < 0) throw new Error('No encontré «android {» en ' + gradle)
  const block = `android {
    signingConfigs {
        mc {
            if (System.getenv('MC_KEYSTORE')) {
                storeFile file(System.getenv('MC_KEYSTORE'))
                storePassword System.getenv('MC_KEYSTORE_PASS')
                keyAlias System.getenv('MC_KEY_ALIAS')
                keyPassword System.getenv('MC_KEY_PASS')
            }
        }
    }
    buildTypes { debug { if (System.getenv('MC_KEYSTORE')) { signingConfig signingConfigs.mc } } }
`
  g = g.slice(0, i) + block + g.slice(i + 'android {'.length)
  fs.writeFileSync(gradle, g)
}
console.log('Android: ícono, pantalla de inicio, compartir archivos y firma' + (process.env.MC_KEYSTORE ? ' FIJA' : ' de depuración (sin clave fija)') + '.')

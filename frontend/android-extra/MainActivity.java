package app.guitarchords;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

/**
 * Mi Cancionero: recibe «Compartir → Mi Cancionero» desde la app de YouTube (o cualquier texto con un enlace) y se lo pasa a la
 * página como window.__shareText(texto). También recibe un archivo de Mi Cancionero compartido o abierto desde WhatsApp, Descargas,
 * etc. («Compartir» o «Abrir con») y se lo pasa como window.__importFile(base64, nombre). Si la página todavía está cargando,
 * reintenta cada 0,5 s durante 20 s. No pide permisos: solo lee lo que el usuario le compartió.
 */
public class MainActivity extends BridgeActivity {
  private final Handler handler = new Handler(Looper.getMainLooper());
  private String pending = null; // código JS a ejecutar en la página
  private static final int MAX_FILE = 40 * 1024 * 1024;
  private int tries = 0;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(WebPickerPlugin.class); // búsqueda de YouTube y páginas de cancionero dentro de la app
    super.onCreate(savedInstanceState);
    take(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    take(intent);
  }

  private void take(Intent intent) {
    if (intent == null) return;
    String action = intent.getAction();
    Uri file = null;
    if (Intent.ACTION_VIEW.equals(action)) file = intent.getData();
    else if (Intent.ACTION_SEND.equals(action)) file = intent.getParcelableExtra(Intent.EXTRA_STREAM);
    else return;
    if (file != null) { // un archivo tiene prioridad sobre el texto que lo acompaña
      String js = fileJs(file);
      if (js != null) { pending = js; tries = 0; deliver(); return; }
    }
    if (!Intent.ACTION_SEND.equals(action)) return;
    String text = intent.getStringExtra(Intent.EXTRA_TEXT);
    if (text == null || text.isEmpty()) return;
    pending = "(function(){if(window.__shareText){window.__shareText(" + JSONObject.quote(text) + ");return 'ok'}return 'no'})()";
    tries = 0;
    deliver();
  }

  /** Lee el archivo compartido y arma la llamada a window.__importFile. null si no se puede leer o es demasiado grande. */
  private String fileJs(Uri uri) {
    String name = "cancion.cancionero";
    try (Cursor c = getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
      if (c != null && c.moveToFirst() && c.getString(0) != null) name = c.getString(0);
    } catch (Exception ignored) { }
    try (InputStream in = getContentResolver().openInputStream(uri)) {
      if (in == null) return null;
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      byte[] buf = new byte[65536];
      int n, total = 0;
      while ((n = in.read(buf)) > 0) { total += n; if (total > MAX_FILE) return null; out.write(buf, 0, n); }
      String b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
      return "(function(){if(window.__importFile){window.__importFile(" + JSONObject.quote(b64) + "," + JSONObject.quote(name) + ");return 'ok'}return 'no'})()";
    } catch (Exception e) {
      return null;
    }
  }

  private void deliver() {
    if (pending == null) return;
    if (getBridge() == null || getBridge().getWebView() == null) { retry(); return; }
    WebView web = getBridge().getWebView();
    web.evaluateJavascript(pending, value -> {
      if (value != null && value.contains("ok")) pending = null; else retry();
    });
  }

  private void retry() {
    if (++tries > 40) { pending = null; return; }
    handler.postDelayed(this::deliver, 500);
  }
}

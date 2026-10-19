package app.guitarchords;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

/**
 * Mi Cancionero: recibe «Compartir → Mi Cancionero» desde la app de YouTube (o cualquier texto con un enlace) y se lo pasa a la
 * página como window.__shareText(texto). Si la página todavía está cargando, reintenta cada 0,5 s durante 20 s.
 * No pide permisos ni lee nada más que el texto compartido.
 */
public class MainActivity extends BridgeActivity {
  private final Handler handler = new Handler(Looper.getMainLooper());
  private String pending = null;
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
    if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
    String text = intent.getStringExtra(Intent.EXTRA_TEXT);
    if (text == null || text.isEmpty()) return;
    pending = text;
    tries = 0;
    deliver();
  }

  private void deliver() {
    if (pending == null) return;
    if (getBridge() == null || getBridge().getWebView() == null) { retry(); return; }
    WebView web = getBridge().getWebView();
    String js = "(function(){if(window.__shareText){window.__shareText(" + JSONObject.quote(pending) + ");return 'ok'}return 'no'})()";
    web.evaluateJavascript(js, value -> {
      if (value != null && value.contains("ok")) pending = null; else retry();
    });
  }

  private void retry() {
    if (++tries > 40) { pending = null; return; }
    handler.postDelayed(this::deliver, 500);
  }
}

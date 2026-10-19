package app.guitarchords;

import android.app.Activity;
import android.app.Dialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Mi Cancionero: muestra páginas web dentro de la app, a pantalla completa, sin iniciar sesión.
 *  - pickYouTube({query}): la búsqueda móvil de YouTube; cuando el usuario toca un video, devuelve {id} y se cierra.
 *  - importPage({url, title}): una página (p. ej. un cancionero) con el botón «Importar acordes»; al tocarlo devuelve el texto
 *    de la página que el usuario está viendo ({text, url, title}). Nada se lee sin que el usuario lo pida.
 *  - createFile({name, mime}) / writeChunk({token, data}) / closeFile({token}): guardar un archivo donde el usuario elija
 *    (copia de seguridad), escrito por partes para no pasar todo de una vez.
 *  - shareFile({name, mime, data}): compartir un archivo chico (una canción) con otras apps (WhatsApp, mail…).
 * No se usan cuentas ni claves. Los enlaces que intentan abrir otras apps (intent://) se bloquean.
 */
@CapacitorPlugin(name = "WebPicker")
public class WebPickerPlugin extends Plugin {
  private Dialog dialog;
  private WebView web;
  private PluginCall pending;
  private boolean done = true;

  @PluginMethod
  public void pickYouTube(PluginCall call) {
    String q = call.getString("query", "");
    open(call, "https://m.youtube.com/results?search_query=" + Uri.encode(q), "Elegí el video", null);
  }

  @PluginMethod
  public void importPage(PluginCall call) {
    String url = call.getString("url");
    if (url == null || url.isEmpty()) { call.reject("Falta la dirección de la página."); return; }
    open(call, url, call.getString("title", "Abrí la canción y tocá Importar"), "Importar acordes");
  }

  private void finishWith(JSObject result) {
    if (done) return;
    done = true;
    PluginCall c = pending;
    pending = null;
    if (dialog != null) dialog.dismiss();
    dialog = null;
    if (web != null) { web.stopLoading(); web.destroy(); }
    web = null;
    if (c != null) c.resolve(result);
  }

  private void cancel() {
    JSObject r = new JSObject();
    r.put("cancelled", true);
    finishWith(r);
  }

  private void open(final PluginCall call, final String url, final String title, final String importLabel) {
    getActivity().runOnUiThread(() -> {
      if (!done) cancel();
      pending = call;
      done = false;
      final boolean youtube = importLabel == null;
      Dialog d = new Dialog(getActivity(), android.R.style.Theme_Black_NoTitleBar_Fullscreen);
      LinearLayout root = new LinearLayout(getActivity());
      root.setOrientation(LinearLayout.VERTICAL);
      LinearLayout bar = new LinearLayout(getActivity());
      bar.setOrientation(LinearLayout.HORIZONTAL);
      bar.setGravity(Gravity.CENTER_VERTICAL);
      bar.setBackgroundColor(Color.rgb(14, 20, 36));
      bar.setPadding(12, 12, 12, 12);
      Button close = styled("Cerrar", false);
      TextView label = new TextView(getActivity());
      label.setText(title);
      label.setTextColor(Color.rgb(147, 160, 196));
      label.setTextSize(13f);
      label.setPadding(16, 0, 16, 0);
      bar.addView(close);
      bar.addView(label, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
      final WebView view = new WebView(getActivity());
      web = view;
      if (!youtube) {
        Button imp = styled(importLabel, true);
        bar.addView(imp);
        imp.setOnClickListener(x -> view.evaluateJavascript(
          "(function(){var ps=[].slice.call(document.querySelectorAll('pre'));ps.sort(function(a,b){return b.innerText.length-a.innerText.length});"
            + "var p=ps[0];return (p&&p.innerText.length>150)?p.innerText:document.body.innerText})()",
          value -> {
            JSObject r = new JSObject();
            r.put("text", value);
            r.put("url", view.getUrl());
            r.put("title", view.getTitle());
            finishWith(r);
          }));
      }
      root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
      root.addView(view, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
      WebSettings s = view.getSettings();
      s.setJavaScriptEnabled(true);
      s.setDomStorageEnabled(true);
      view.setWebViewClient(new WebViewClient() {
        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
          Uri u = req.getUrl();
          if (youtube && check(u.toString())) return true;
          String scheme = u.getScheme();
          return !"http".equals(scheme) && !"https".equals(scheme);
        }

        @Override
        public void doUpdateVisitedHistory(WebView v, String u, boolean isReload) {
          super.doUpdateVisitedHistory(v, u, isReload);
          if (youtube) check(u);
        }
      });
      close.setOnClickListener(x -> cancel());
      d.setOnCancelListener(x -> cancel());
      d.setContentView(root);
      dialog = d;
      d.show();
      view.loadUrl(url);
    });
  }

  /** Si la dirección es un video de YouTube (/watch?v=… o /shorts/…), lo devuelve y cierra. */
  private boolean check(String address) {
    if (done || address == null) return false;
    Uri uri = Uri.parse(address);
    String path = uri.getPath() == null ? "" : uri.getPath();
    String id = null;
    if (path.startsWith("/watch")) id = uri.getQueryParameter("v");
    else if (path.startsWith("/shorts/")) id = path.substring(8).split("/")[0];
    if (id == null || !id.matches("[A-Za-z0-9_-]{11}")) return false;
    JSObject r = new JSObject();
    r.put("id", id);
    finishWith(r);
    return true;
  }

  // ---------- archivos: copia de seguridad y compartir ----------
  private final Map<String, OutputStream> streams = new HashMap<>();
  private int nextToken = 1;

  @PluginMethod
  public void createFile(PluginCall call) {
    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE);
    i.setType(call.getString("mime", "application/octet-stream"));
    i.putExtra(Intent.EXTRA_TITLE, call.getString("name", "mi-cancionero.cancionero"));
    startActivityForResult(call, i, "createFileResult");
  }

  @ActivityCallback
  private void createFileResult(PluginCall call, ActivityResult result) {
    if (call == null) return;
    Intent data = result.getData();
    if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
      JSObject r = new JSObject();
      r.put("cancelled", true);
      call.resolve(r);
      return;
    }
    try {
      OutputStream out = getContext().getContentResolver().openOutputStream(data.getData(), "w");
      if (out == null) { call.reject("No se pudo abrir el archivo para escribir."); return; }
      String token = "f" + (nextToken++);
      streams.put(token, out);
      JSObject r = new JSObject();
      r.put("token", token);
      call.resolve(r);
    } catch (Exception e) {
      call.reject("No se pudo crear el archivo: " + e.getMessage());
    }
  }

  @PluginMethod
  public void writeChunk(PluginCall call) {
    OutputStream out = streams.get(call.getString("token", ""));
    if (out == null) { call.reject("El archivo no está abierto."); return; }
    try {
      out.write(Base64.decode(call.getString("data", ""), Base64.DEFAULT));
      call.resolve();
    } catch (Exception e) {
      call.reject("No se pudo escribir el archivo: " + e.getMessage());
    }
  }

  @PluginMethod
  public void closeFile(PluginCall call) {
    OutputStream out = streams.remove(call.getString("token", ""));
    try {
      if (out != null) { out.flush(); out.close(); }
      call.resolve();
    } catch (Exception e) {
      call.reject("No se pudo terminar de guardar el archivo: " + e.getMessage());
    }
  }

  @PluginMethod
  public void shareFile(PluginCall call) {
    String name = call.getString("name", "cancion.cancionero").replaceAll("[^A-Za-z0-9._ -]", "_");
    try {
      File dir = new File(getContext().getCacheDir(), "share");
      if (!dir.exists() && !dir.mkdirs()) { call.reject("No se pudo preparar el archivo."); return; }
      File f = new File(dir, name);
      try (FileOutputStream out = new FileOutputStream(f)) { out.write(Base64.decode(call.getString("data", ""), Base64.DEFAULT)); }
      Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".mcfiles", f);
      Intent send = new Intent(Intent.ACTION_SEND);
      send.setType(call.getString("mime", "application/octet-stream"));
      send.putExtra(Intent.EXTRA_STREAM, uri);
      send.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
      send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      getActivity().startActivity(Intent.createChooser(send, "Compartir canción"));
      call.resolve();
    } catch (Exception e) {
      call.reject("No se pudo compartir: " + e.getMessage());
    }
  }

  /** Botón con los colores de la app (amarillo sobre oscuro, o borde claro). */
  private Button styled(String text, boolean primary) {
    Button b = new Button(getActivity());
    b.setText(text);
    b.setAllCaps(false);
    b.setTextColor(primary ? Color.rgb(26, 18, 4) : Color.rgb(233, 238, 252));
    GradientDrawable g = new GradientDrawable();
    g.setCornerRadius(28f);
    if (primary) g.setColor(Color.rgb(242, 184, 75));
    else { g.setColor(Color.rgb(23, 32, 56)); g.setStroke(2, Color.rgb(42, 54, 88)); }
    b.setBackground(g);
    b.setPadding(32, 8, 32, 8);
    return b;
  }
}

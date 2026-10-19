package app.guitarchords;

import android.app.Dialog;
import android.graphics.Color;
import android.net.Uri;
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
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Mi Cancionero: muestra páginas web dentro de la app, a pantalla completa, sin iniciar sesión.
 *  - pickYouTube({query}): la búsqueda móvil de YouTube; cuando el usuario toca un video, devuelve {id} y se cierra.
 *  - importPage({url, title}): una página (p. ej. un cancionero) con el botón «Importar acordes»; al tocarlo devuelve el texto
 *    de la página que el usuario está viendo ({text, url, title}). Nada se lee sin que el usuario lo pida.
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
      Button close = new Button(getActivity());
      close.setText("Cerrar");
      TextView label = new TextView(getActivity());
      label.setText(title);
      label.setTextColor(Color.WHITE);
      label.setPadding(16, 0, 16, 0);
      bar.addView(close);
      bar.addView(label, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
      final WebView view = new WebView(getActivity());
      web = view;
      if (!youtube) {
        Button imp = new Button(getActivity());
        imp.setText(importLabel);
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
}

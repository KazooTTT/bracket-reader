// GM_* 垫片，通过 <script src> 加载以绕过页面 CSP
window.GM_getValue = function (k, d) {
  try { const v = localStorage.getItem('GM_' + k); return v == null ? d : v; } catch (e) { return d; }
};
window.GM_setValue = function (k, v) {
  try { localStorage.setItem('GM_' + k, v); } catch (e) {}
};
window.GM_xmlhttpRequest = function (o) {
  fetch(o.url, { method: o.method, headers: o.headers, body: o.data })
    .then(function (r) { return r.text().then(function (t) { o.onload && o.onload({ status: r.status, responseText: t }); }); })
    .catch(function (e) { o.onerror && o.onerror(e); });
};

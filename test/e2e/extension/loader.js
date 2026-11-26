// 模拟油猴：全部通过 <script src> 注入，绕过页面 CSP
(function () {
  const head = document.head || document.documentElement;
  const a = document.createElement('script');
  a.src = chrome.runtime.getURL('gm-shim.js');
  a.onload = () => {
    const b = document.createElement('script');
    b.src = chrome.runtime.getURL('bracket-reader.user.js');
    head.appendChild(b);
  };
  head.appendChild(a);
})();

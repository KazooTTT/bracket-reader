// ==UserScript==
// @name         括号法阅读助手 (BracketReader)
// @namespace    https://github.com/KazooTTT/bracket-reader
// @version      0.4.0
// @description  用「括号法」阅读英文长难句：把介词短语、从句、非谓语括起来，露出主干。支持离线规则（即时）与 AI 精修（更准），可按网站开关自动标注。
// @author       kazoottt
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @connect      *
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/KazooTTT/bracket-reader/main/dist/bracket-reader.user.js
// @downloadURL  https://raw.githubusercontent.com/KazooTTT/bracket-reader/main/dist/bracket-reader.user.js
// ==/UserScript==

/* __ENGINE__ */

(function () {
  'use strict';

  // ==================== 配置 ====================
  const CFG_KEY = 'bracketReader.config';
  const SITE_KEY = 'bracketReader.sites';
  const CACHE_KEY = 'bracketReader.cache';

  const DEFAULTS = {
    apiUrl: 'http://127.0.0.1:3425/v1',
    apiKey: '',
    model: 'group/deepseek-free',
    mode: 'rules',            // rules | ai
    noThinking: true,         // 关思考，快很多
    concurrency: 5,           // AI 并发数（实测 5~8 接近网关上限）
    autoSite: false,          // 本网站是否自动标注
    markCore: true,           // 高亮主干
  };

  function gmGet(k, d) {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(k, d);
      const v = localStorage.getItem(k);
      return v == null ? d : v;
    } catch (e) { return d; }
  }
  function gmSet(k, v) {
    try {
      if (typeof GM_setValue === 'function') GM_setValue(k, v);
      else localStorage.setItem(k, v);
    } catch (e) { /* ignore */ }
  }

  function getCfg() {
    const raw = gmGet(CFG_KEY, '');
    let o = {};
    try { o = raw ? JSON.parse(raw) : {}; } catch (e) { o = {}; }
    return Object.assign({}, DEFAULTS, o);
  }
  function setCfg(patch) {
    const c = Object.assign(getCfg(), patch);
    gmSet(CFG_KEY, JSON.stringify(c));
    return c;
  }

  // 每个网站独立开关
  function hostKey() { return location.hostname || 'local'; }
  function siteEnabled() {
    const raw = gmGet(SITE_KEY, '');
    let m = {};
    try { m = raw ? JSON.parse(raw) : {}; } catch (e) { m = {}; }
    return !!m[hostKey()];
  }
  function setSiteEnabled(on) {
    const raw = gmGet(SITE_KEY, '');
    let m = {};
    try { m = raw ? JSON.parse(raw) : {}; } catch (e) { m = {}; }
    if (on) m[hostKey()] = 1; else delete m[hostKey()];
    gmSet(SITE_KEY, JSON.stringify(m));
  }

  // 句子级缓存，避免重复请求
  let cache = {};
  try { cache = JSON.parse(gmGet(CACHE_KEY, '') || '{}'); } catch (e) { cache = {}; }
  let cacheDirty = false;
  function cacheGet(s) { return cache[hash(s)]; }
  function cacheSet(s, v) {
    cache[hash(s)] = v; cacheDirty = true;
    if (!cacheTimer) cacheTimer = setTimeout(flushCache, 3000);
  }
  let cacheTimer = null;
  function flushCache() {
    cacheTimer = null;
    if (!cacheDirty) return;
    cacheDirty = false;
    // 限制缓存条数
    const keys = Object.keys(cache);
    if (keys.length > 3000) {
      const keep = {};
      for (const k of keys.slice(-2000)) keep[k] = cache[k];
      cache = keep;
    }
    gmSet(CACHE_KEY, JSON.stringify(cache));
  }
  function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  // ==================== 配色 ====================
  const COLORS = { pp: '#d97706', clause: '#2563eb', nonfinite: '#7c3aed' };
  const BRACKETS = { pp: ['(', ')'], clause: ['[', ']'], nonfinite: ['\u2039', '\u203a'] };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  // ==================== 渲染 ====================
  // 规则引擎的树 → HTML
  function treeToHtml(node) {
    let out = '';
    for (const c of node.children) {
      if (c.type === 'text') { out += esc(c.text); continue; }
      const col = COLORS[c.type] || '#888';
      const [op, cl] = BRACKETS[c.type] || ['(', ')'];
      const low = c.conf != null && c.conf < 0.7 ? ' data-lowconf="1"' : '';
      out += `<span class="br-mod" data-k="${c.type}" style="--c:${col}"${low}>` +
             `<span class="br-br">${op}</span>` + treeToHtml(c) + `<span class="br-br">${cl}</span>` +
             `</span>`;
    }
    return out;
  }

  // LLM 的嵌套数组 → HTML + 主干
  function llmToHtml(node, opts) {
    opts = opts || {};
    let html = '', core = '';
    if (!Array.isArray(node)) return { html: esc(String(node)), core: String(node) };
    for (const item of node) {
      if (!Array.isArray(item) || item.length < 2) {
        const s = Array.isArray(item) ? String(item[0] == null ? '' : item[0]) : String(item == null ? '' : item);
        html += esc(s); core += s; continue;
      }
      const kind = item[0], body = item[1];
      if (kind === 't') {
        const t = typeof body === 'string' ? body : String(body == null ? '' : body);
        html += esc(t); core += t; continue;
      }
      if (COLORS[kind]) {
        const inner = llmToHtml(body, opts);
        const [op, cl] = BRACKETS[kind];
        html += `<span class="br-mod" data-k="${kind}" style="--c:${COLORS[kind]}">` +
                `<span class="br-br">${op}</span>${inner.html}<span class="br-br">${cl}</span>` +
                `</span>`;
        continue;
      }
      const inner = llmToHtml(body, opts);
      html += inner.html; core += inner.core;
    }
    return { html, core };
  }

  function llmPlain(node) {
    if (typeof node === 'string') return node;
    if (!Array.isArray(node)) return String(node == null ? '' : node);
    return node.map(x => {
      if (Array.isArray(x) && x.length >= 2 && (COLORS[x[0]] || x[0] === 't')) return llmPlain(x[1]);
      if (Array.isArray(x)) return llmPlain(x);
      return String(x == null ? '' : x);
    }).join('');
  }

  const norm = s => String(s).replace(/\s+/g, ' ').trim();

  // ==================== LLM ====================
  const PROMPT = `Mark modifiers with brackets (括号法), keep the main clause plain.

Bracket these three types:
- pp: prepositional phrase. From the preposition to the first noun after it.
- clause: starts with that/which/who/whom/whose/when/where/why/because/if/although/though/since/as/while. It ENDS at the EARLIEST of: end of sentence, a comma, the next modifier, or the next MAIN-CLAUSE verb.
- nonfinite: starts with to-do / doing / done. Same end rules.

NEVER bracket: the main clause subject, the main clause verb, the main clause object, adjectives, or adverbs.

Output ONLY a JSON array. Each element is ["t","raw text"] for plain text, or ["pp"|"clause"|"nonfinite","raw text"] for a bracketed part.
Concatenating every second element in order MUST equal the input sentence exactly, including spaces and punctuation.

Example:
input:  The book that she bought in Paris last year was excellent.
output: [["t","The book "],["clause","that she bought"],["pp"," in Paris"],["pp"," last year"],["t"," was excellent."]]

Output the JSON array only. No prose, no markdown fences.`;

  function callLLM(sentence, cfg) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('未配置 API URL'));
      const url = cfg.apiUrl.replace(/\/+$/, '') + '/chat/completions';
      const payload = {
        model: cfg.model || undefined,
        temperature: 0,
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: sentence },
        ],
      };
      // 关键：关思考，否则会慢 10 倍以上
      if (cfg.noThinking) payload.reasoning_effort = 'none';
      const body = JSON.stringify(payload);

      const headers = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;

      const handle = text => {
        let j;
        try { j = JSON.parse(text); } catch (e) { return reject(new Error('返回不是 JSON')); }
        if (j.error) return reject(new Error(j.error.message || '接口报错'));
        const msg = j.choices && j.choices[0] && j.choices[0].message;
        const content = (msg && msg.content) || '';
        const m = content.match(/\[[\s\S]*\]/);
        if (!m) return reject(new Error('模型未返回 JSON 数组'));
        let arr;
        try { arr = JSON.parse(m[0]); } catch (e) { return reject(new Error('JSON 解析失败')); }
        if (!Array.isArray(arr)) return reject(new Error('格式不是数组'));
        // 硬校验：拼回来必须等于原句
        if (norm(llmPlain(arr)) !== norm(sentence)) return reject(new Error('RECONSTRUCT_MISMATCH'));
        resolve(arr);
      };

      if (typeof GM_xmlhttpRequest === 'function') {
        let settled = false;
        const done = fn => v => { if (!settled) { settled = true; clearTimeout(guard); fn(v); } };
        // 兜底：即便宿主不回调，也不能让面板永远卡在“分析中”
        const guard = setTimeout(() => {
          done(reject)(new Error('请求超时（30s）'));
        }, 30000);
        GM_xmlhttpRequest({
          method: 'POST', url, headers, data: body,
          onload: r => (r.status >= 200 && r.status < 300
            ? done(handle)(r.responseText)
            : done(reject)(new Error('HTTP ' + r.status))),
          onerror: () => done(reject)(new Error('网络错误')),
          ontimeout: () => done(reject)(new Error('超时')),
          timeout: 30000,
        });
      } else {
        fetch(url, { method: 'POST', headers, body })
          .then(r => r.text()).then(handle).catch(reject);
      }
    });
  }

  // ==================== 面板 ====================
  let panel = null;
  let currentText = '';

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.className = 'br-panel';
    panel.innerHTML = `
      <div class="br-head">
        <span class="br-title">括号法</span>
        <span class="br-legend">
          <i style="--c:${COLORS.pp}">介词</i>
          <i style="--c:${COLORS.clause}">从句</i>
          <i style="--c:${COLORS.nonfinite}">非谓语</i>
        </span>
        <span class="br-spacer"></span>
        <button class="br-btn br-site" title="在本网站自动标注">本站</button>
        <button class="br-btn br-refresh" title="重新分析">↻</button>
        <button class="br-btn br-cfg" title="设置">⚙</button>
        <button class="br-btn br-close" title="关闭 (Esc)">✕</button>
      </div>
      <div class="br-body"></div>
      <div class="br-foot"></div>
      <div class="br-settings" hidden>
        <div class="br-modes">
          <label><input type="radio" name="brmode" value="rules"> 离线规则（即时）</label>
          <label><input type="radio" name="brmode" value="ai"> AI 精修（更准，需接口）</label>
        </div>
        <label>API URL<input class="br-in br-url" placeholder="http://127.0.0.1:3425/v1"></label>
        <label>API Key<input class="br-in br-key" type="password" placeholder="留空则不需要"></label>
        <label>Model<input class="br-in br-model" placeholder="group/deepseek-free"></label>
        <label class="br-check"><input type="checkbox" class="br-nothink"> 关闭思考模式（快 10 倍）</label>
        <label>并发数<input class="br-in br-conc" type="number" min="1" max="16" placeholder="5"></label>
        <div class="br-row">
          <button class="br-btn br-save">保存</button>
          <span class="br-hint"></span>
        </div>
      </div>`;
    document.documentElement.appendChild(panel);

    panel.querySelector('.br-close').onclick = hidePanel;
    panel.querySelector('.br-refresh').onclick = () => showText(currentText);
    panel.querySelector('.br-site').onclick = () => {
      const on = !siteEnabled();
      setSiteEnabled(on);
      syncSiteBtn();
      if (on) startPageAnnotate(); else stopPageAnnotate();
    };
    panel.querySelector('.br-cfg').onclick = () => {
      const s = panel.querySelector('.br-settings');
      if (s.hidden) {
        const c = getCfg();
        panel.querySelector('.br-url').value = c.apiUrl;
        panel.querySelector('.br-key').value = c.apiKey;
        panel.querySelector('.br-model').value = c.model;
        panel.querySelector('.br-nothink').checked = c.noThinking;
        panel.querySelector('.br-conc').value = c.concurrency;
        const r = panel.querySelector(`input[name="brmode"][value="${c.mode}"]`);
        if (r) r.checked = true;
      }
      s.hidden = !s.hidden;
    };
    panel.querySelector('.br-save').onclick = () => {
      const modeEl = panel.querySelector('input[name="brmode"]:checked');
      setCfg({
        apiUrl: panel.querySelector('.br-url').value.trim(),
        apiKey: panel.querySelector('.br-key').value.trim(),
        model: panel.querySelector('.br-model').value.trim(),
        noThinking: panel.querySelector('.br-nothink').checked,
        concurrency: Math.max(1, Math.min(16, parseInt(panel.querySelector('.br-conc').value, 10) || 5)),
        mode: modeEl ? modeEl.value : 'rules',
      });
      const h = panel.querySelector('.br-hint');
      h.textContent = '已保存';
      setTimeout(() => { h.textContent = ''; }, 1500);
      if (currentText) showText(currentText);
    };
    syncSiteBtn();
    return panel;
  }

  function syncSiteBtn() {
    if (!panel) return;
    const b = panel.querySelector('.br-site');
    if (!b) return;
    const on = siteEnabled();
    b.classList.toggle('on', on);
    b.textContent = on ? '本站·开' : '本站';
  }

  function hidePanel() {
    if (panel) { panel.remove(); panel = null; }
  }

  function showText(text) {
    const p = ensurePanel();
    currentText = text;
    p.hidden = false;
    p.style.display = 'flex';
    const cfg = getCfg();
    p.querySelector('.br-settings').hidden = true;

    if (!text.trim()) {
      p.querySelector('.br-body').innerHTML = '<div class="br-empty">请先选中一段英文</div>';
      p.querySelector('.br-foot').innerHTML = '';
      return;
    }
    run(text, p, cfg);
  }

  function run(text, p, cfg) {
    const body = p.querySelector('.br-body');
    const foot = p.querySelector('.br-foot');
    const r = BracketEngine.annotate(text);

    // 规则结果先落地（无论哪种模式，都先给结果，避免空窗）
    const ruleHtml = r.sentences.map(s => `<div class="br-item">${treeToHtml(s.tree)}</div>`).join('');
    const ruleCores = r.sentences.map(s => s.core).filter(Boolean);

    if (cfg.mode !== 'ai' || !cfg.apiUrl) {
      body.innerHTML = ruleHtml;
      renderCore(foot, ruleCores);
      if (cfg.mode === 'ai' && !cfg.apiUrl) {
        body.insertAdjacentHTML('afterbegin', '<div class="br-note">AI 模式需要先配 API</div>');
      }
      return;
    }

    // AI 模式：先显示规则结果，再逐句升级
    body.innerHTML = `<div class="br-note br-progress">AI 分析中…</div>` + ruleHtml;
    renderCore(foot, ruleCores);
    upgradeWithAI(text, p, cfg);
  }

  async function upgradeWithAI(text, p, cfg) {
    const body = p.querySelector('.br-body');
    const foot = p.querySelector('.br-foot');
    const r = BracketEngine.annotate(text);

    const htmls = r.sentences.map(s => treeToHtml(s.tree));
    const cores = r.sentences.map(s => s.core);
    const total = r.sentences.length;

    let done = 0, failed = 0, finished = false;
    let paintQueued = false;

    const conc = Math.max(1, Math.min(16, cfg.concurrency || 5));
    const used = Math.min(conc, total);

    const progressText = () =>
      `AI 分析中… ${done}/${total}（并发 ${used}）` + (failed ? `，${failed} 句回退到规则` : '');

    // 统一渲染：finished 之后不再显示进度提示
    function paint() {
      paintQueued = false;
      if (p !== panel) return;
      const warning = failed
        ? `<div class="br-note br-progress">${finished
            ? `${failed} 句 AI 失败，已用离线规则`
            : esc(progressText())}</div>`
        : (!finished ? `<div class="br-note br-progress">${esc(progressText())}</div>` : '');
      body.innerHTML = warning + htmls.map(h => `<div class="br-item">${h}</div>`).join('');
      renderCore(foot, cores);
    }

    // 并发下每句都重绘会抖，合并到下一帧
    function schedulePaint() {
      if (paintQueued || finished) return;
      paintQueued = true;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(paint);
      else setTimeout(paint, 16);
    }

    paint();

    let cursor = 0;
    let aborted = false;

    async function worker() {
      while (true) {
        if (aborted || p !== panel) { aborted = true; return; }
        const i = cursor++;
        if (i >= total) return;
        const s = r.sentences[i];

        const cached = cacheGet(s.text);
        if (cached) {
          htmls[i] = cached.html;
          cores[i] = cached.core;
          done++;
          schedulePaint();
          continue;
        }

        try {
          let arr;
          try {
            arr = await callLLM(s.text, cfg);
          } catch (e) {
            // 重建校验失败多半是模型漏字，重试一次通常就过
            if (e.message === 'RECONSTRUCT_MISMATCH' && !aborted && p === panel) {
              arr = await callLLM(s.text, cfg);
            } else throw e;
          }
          if (aborted || p !== panel) return;   // 面板已关闭，丢弃过期结果
          const { html, core: c } = llmToHtml(arr);
          htmls[i] = html;
          cores[i] = c.replace(/\s+/g, ' ').trim();
          cacheSet(s.text, { html: htmls[i], core: cores[i] });
        } catch (e) {
          if (aborted || p !== panel) return;
          failed++;
          htmls[i] += `<div class="br-err">AI 失败（${esc(e.message)}），已保留离线结果</div>`;
        }
        done++;
        schedulePaint();
      }
    }

    await Promise.all(Array.from({ length: used }, worker));

    // 收尾：标记完成并同步绘制一次，确保进度提示被清除
    finished = true;
    paintQueued = false;
    paint();
  }

  // 主干首尾残留的标点要去掉（AI 常把逗号划在主干开头）
  function tidyCore(c) {
    return String(c || '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,;:—–、]+/, '')
      .replace(/\s*([,;:—–、])\s*$/, '')
      .replace(/\s+\./g, '.')
      .replace(/[\s,;:—–、]+$/, '')
      .trim();
  }

  function renderCore(foot, cores) {
    const clean = (cores || []).map(tidyCore).filter(c => c);
    if (!clean.length) { foot.innerHTML = ''; return; }
    const suspicious = clean.filter(c => !looksLikeClause(c));
    foot.innerHTML =
      `<div class="br-core-label">主干` +
      (suspicious.length ? `<span class="br-flag">${suspicious.length} 句结构可疑，建议核对</span>` : '') +
      `</div>` +
      `<div class="br-core">${clean.map(c => esc(c)).join('<br>')}</div>`;
  }

  // 主干是否像个完整小句：必须有谓语，且不能出现两个谓语硬拼在一起
  const FINITE_RE = /\b(am|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|can|could|may|might|must|seems?|becomes?|remains?)\b|\b\w{3,}ed\b|\b\w{4,}s\b/i;
  function looksLikeClause(core) {
    const t = core.replace(/\s+/g, ' ').trim();
    if (!t) return false;
    // 至少 2 个词
    if (t.split(' ').length < 2) return false;
    // 必须有谓语形式
    if (!FINITE_RE.test(t)) return false;
    // 不能以括号符号开头/结尾
    if (/^[)\]\u203a]/.test(t) || /[([\u2039]$/.test(t)) return false;
    return true;
  }

  // ==================== 划词触发 ====================
  let fab = null;

  function onMouseUp() {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { removeFab(); return; }
      const text = sel.toString().trim();
      if (text.length < 8 || !/[A-Za-z]{3}/.test(text)) { removeFab(); return; }
      if (panel && panel.contains(sel.anchorNode)) { removeFab(); return; }

      let rect;
      try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (e) { return; }
      if (!rect || (!rect.width && !rect.height)) { removeFab(); return; }

      if (!fab) {
        fab = document.createElement('button');
        fab.className = 'br-fab';
        fab.textContent = '括号法';
        fab.onmousedown = ev => {
          ev.preventDefault();
          ev.stopPropagation();
          showText(window.getSelection().toString().trim());
          removeFab();
        };
        document.documentElement.appendChild(fab);
      }
      fab.style.top = Math.max(4, rect.top + window.scrollY - 38) + 'px';
      fab.style.left = Math.max(4, Math.min(window.innerWidth - 86, rect.left + window.scrollX + rect.width / 2 - 32)) + 'px';
    }, 10);
  }
  function removeFab() { if (fab) { fab.remove(); fab = null; } }

  // ==================== 全页自动标注 ====================
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'CODE', 'PRE', 'KBD', 'SAMP', 'SVG', 'CANVAS', 'IFRAME']);
  const BR_CLASSES = ['br-mod', 'br-br', 'br-item', 'br-panel', 'br-fab', 'br-note', 'br-core', 'br-wrap'];

  let pageOn = false;
  let io = null;
  let mo = null;
  const queue = [];
  let working = false;
  let stats = { marked: 0, pending: 0 };

  function isSkippable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP_TAGS.has(el.tagName)) return true;
    const cl = el.className;
    if (typeof cl === 'string' && BR_CLASSES.some(c => cl.includes(c))) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // 判断一段文本值不值得标注
  function worthAnnotating(t) {
    if (!t || t.length < 20) return false;
    const letters = (t.match(/[A-Za-z]/g) || []).length;
    if (letters / t.length < 0.5) return false;
    // 至少要有两个词以上
    if ((t.trim().match(/\s/g) || []).length < 3) return false;
    return true;
  }

  function collectTextNodes(root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || isSkippable(p)) return NodeFilter.FILTER_REJECT;
        if (!worthAnnotating(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  // 把文本节点替换为标注后的 spans
  function annotateNode(textNode, cfg) {
    const raw = textNode.nodeValue;
    if (!raw || !raw.trim()) return;
    let r;
    try { r = BracketEngine.annotate(raw); } catch (e) { return; }
    if (!r.sentences.length) return;

    const frag = document.createDocumentFragment();
    for (const s of r.sentences) {
      const span = document.createElement('span');
      span.className = 'br-wrap';
      span.dataset.br = '1';
      span.innerHTML = treeToHtml(s.tree);
      frag.appendChild(span);
    }
    const parent = textNode.parentNode;
    if (!parent) return;
    parent.replaceChild(frag, textNode);
    stats.marked++;
  }

  function startPageAnnotate() {
    if (pageOn) return;
    pageOn = true;

    // 首屏优先：IntersectionObserver 只用来提前处理视口内的节点，
    // 其余节点仍然照常入队（不能只靠 observer，否则视口外的内容永远不处理）
    const ioSupported = 'IntersectionObserver' in window;
    if (ioSupported) {
      io = new IntersectionObserver(entries => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          // 视口内的元素，把它的文本节点提到队首
          const tn = [];
          const walker = document.createTreeWalker(en.target, NodeFilter.SHOW_TEXT, {
            acceptNode(n) {
              const pe = n.parentElement;
              if (!pe || isSkippable(pe)) return NodeFilter.FILTER_REJECT;
              if (!worthAnnotating(n.nodeValue)) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            },
          });
          let x;
          while ((x = walker.nextNode())) tn.push(x);
          for (const n of tn.reverse()) {
            const idx = queue.indexOf(n);
            if (idx >= 0) queue.splice(idx, 1);
            queue.unshift(n);
          }
          if (!working) processQueue();
        }
      }, { rootMargin: '200px 0px' });
    }

    // 现有内容全部入队（不等 observer，保证一定被处理）
    const nodes = collectTextNodes(document.body);
    for (const n of nodes) enqueue(n);
    if (ioSupported) for (const n of nodes) if (n.parentElement) io.observe(n.parentElement);

    // 动态内容
    mo = new MutationObserver(muts => {
      for (const m of muts) {
        for (const added of m.addedNodes) {
          if (added.nodeType === 1) {
            if (isSkippable(added)) continue;
            for (const n of collectTextNodes(added)) enqueue(n);
          } else if (added.nodeType === 3 && added.parentElement && !isSkippable(added.parentElement)) {
            if (worthAnnotating(added.nodeValue)) enqueue(added);
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    pulse();
    toast('本网站自动标注：已开启');
  }

  function stopPageAnnotate() {
    pageOn = false;
    if (io) { io.disconnect(); io = null; }
    if (mo) { mo.disconnect(); mo = null; }
    queue.length = 0;
    working = false;
    // 还原：重建纯文本时必须排除括号符号本身
    document.querySelectorAll('span.br-wrap[data-br]').forEach(el => {
      const parent = el.parentNode;
      if (!parent) return;
      const txt = plainTextOf(el);
      parent.replaceChild(document.createTextNode(txt), el);
    });
    // 合并相邻文本节点，恢复原始 DOM 形态
    document.body.normalize();
    if (stats) { stats.marked = 0; stats.pending = 0; }
    if (badge) { badge.remove(); badge = null; }
    toast('本网站自动标注：已关闭');
  }

  // 读取「不含括号符号」的纯文本
  function plainTextOf(el) {
    let s = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { s += n.nodeValue; continue; }
      if (n.nodeType !== 1) continue;
      if (n.classList && n.classList.contains('br-br')) continue;   // 括号符号跳过
      s += plainTextOf(n);
    }
    return s;
  }

  function enqueue(textNode) {
    if (!textNode || !textNode.nodeValue) return;
    // 已被处理过（在 br-wrap 里）
    const p = textNode.parentElement;
    if (!p || isSkippable(p)) return;
    if (p.closest('.br-wrap')) return;
    queue.push(textNode);
    stats.pending = queue.length;
    if (!working) processQueue();
  }

  function processQueue() {
    if (!pageOn) { queue.length = 0; working = false; return; }
    const node = queue.shift();
    if (!node) { working = false; pulse(); return; }
    working = true;
    stats.pending = queue.length;

    // 节点可能已脱离 DOM，或被其它脚本改过
    if (node.parentNode && !isSkippable(node.parentElement)) {
      try { annotateNode(node, getCfg()); } catch (e) { /* 单节点失败不影响其它 */ }
    }
    pulse();
    // 让出主线程，避免长页面卡顿
    setTimeout(processQueue, 0);
  }

  let pulseTimer = null;
  function pulse() {
    if (pulseTimer) return;
    pulseTimer = setTimeout(() => { pulseTimer = null; showBadge(); }, 120);
  }

  let badge = null;
  function showBadge() {
    if (!pageOn) { if (badge) { badge.remove(); badge = null; } return; }
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'br-badge';
      document.documentElement.appendChild(badge);
    }
    badge.textContent = stats.pending > 0
      ? `括号法 ${stats.marked} 段（队列 ${stats.pending}）`
      : `括号法 ${stats.marked} 段`;
    badge.classList.toggle('done', stats.pending === 0);
  }

  let toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'br-toast';
      document.documentElement.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => { if (toastEl) toastEl.classList.remove('show'); }, 1800);
  }

  // ==================== 样式 ====================
  function injectCSS() {
    const st = document.createElement('style');
    st.textContent = `
/* 标注本体 */
.br-mod{color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent);
  border-radius:3px;padding:1px 0}
.br-mod[data-lowconf]{opacity:.55}
.br-br{color:var(--c);opacity:.7;font-weight:600;user-select:none}
.br-item{margin-bottom:12px;line-height:1.85}
.br-item:last-child{margin-bottom:0}

/* 划词按钮 */
.br-fab{position:absolute;z-index:2147483646;background:#111827;color:#fff;border:0;border-radius:7px;
  padding:5px 11px;font:500 12px/1.4 -apple-system,sans-serif;cursor:pointer;
  box-shadow:0 3px 12px rgba(0,0,0,.32)}
.br-fab:hover{background:#374151}

/* 面板 */
.br-panel{position:fixed;right:20px;bottom:20px;width:min(600px,calc(100vw - 40px));max-height:66vh;
  z-index:2147483647;background:#fff;color:#111;border-radius:12px;
  box-shadow:0 12px 44px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;
  font:14px/1.8 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.br-head{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#f6f7f9;
  border-bottom:1px solid #e5e7eb;flex-wrap:wrap}
.br-title{font-weight:600;font-size:13px;letter-spacing:.3px}
.br-legend{display:flex;gap:8px;font-size:11px}
.br-legend i{font-style:normal;color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent);
  padding:1px 6px;border-radius:4px}
.br-spacer{flex:1}
.br-btn{border:0;background:#eef0f3;color:#333;border-radius:6px;padding:3px 9px;cursor:pointer;
  font-size:12px;font-family:inherit}
.br-btn:hover{background:#e2e5ea}
.br-btn.on{background:#2563eb;color:#fff}
.br-body{padding:14px 16px;overflow:auto;flex:1}
.br-foot{padding:10px 16px;border-top:1px dashed #e5e7eb;background:#fcfcfd}
.br-core-label{font-size:11px;color:#8b939e;letter-spacing:.6px;margin-bottom:3px}
.br-flag{color:#b45309;background:#fef3c7;border-radius:4px;padding:1px 6px;margin-left:8px;
  font-size:10px;letter-spacing:0}
.br-core{font-weight:600;color:#0f172a;font-size:15px;line-height:1.65}
.br-empty,.br-note{color:#8b939e;font-size:12px}
.br-note{margin-bottom:10px;background:#f3f4f6;padding:6px 10px;border-radius:6px}
.br-err{color:#dc2626;font-size:11px;margin-top:4px}

/* 设置 */
.br-settings{padding:12px 16px;border-top:1px solid #e5e7eb;background:#fafbfc;
  display:flex;flex-direction:column;gap:9px}
.br-settings[hidden]{display:none!important}

/* 括号贴紧内容，不要被空白推开 */
.br-mod>.br-br:first-child{margin-right:-.14em}
.br-mod>.br-br:last-child{margin-left:-.14em}
.br-settings label{display:flex;flex-direction:column;gap:3px;font-size:11px;color:#6b7280}
.br-settings label.br-check{flex-direction:row;align-items:center;gap:6px;color:#374151;font-size:12px}
.br-modes{display:flex;gap:16px;font-size:12px;color:#374151}
.br-modes label{flex-direction:row;align-items:center;gap:5px;color:#374151;font-size:12px}
.br-in{border:1px solid #d7dbe0;border-radius:6px;padding:5px 8px;font-size:12px;font-family:inherit}
.br-row{display:flex;align-items:center;gap:10px}
.br-hint{font-size:11px;color:#16a34a}

/* 全页标注 */
.br-badge{position:fixed;left:14px;bottom:14px;z-index:2147483645;background:#111827;color:#fff;
  border-radius:20px;padding:5px 12px;font:500 11px/1.4 -apple-system,sans-serif;
  box-shadow:0 3px 12px rgba(0,0,0,.28);opacity:.9}
.br-badge.done{background:#059669}
.br-toast{position:fixed;left:50%;bottom:70px;transform:translate(-50%,10px);z-index:2147483647;
  background:#111827;color:#fff;border-radius:8px;padding:8px 16px;font:500 12px/1.4 -apple-system,sans-serif;
  opacity:0;transition:opacity .2s,transform .2s;pointer-events:none}
.br-toast.show{opacity:1;transform:translate(-50%,0)}

@media(prefers-color-scheme:dark){
 .br-panel{background:#1c1f24;color:#e5e7eb}
 .br-head{background:#22262c;border-color:#2f343c}
 .br-btn{background:#2b3038;color:#d5d9df}
 .br-btn:hover{background:#343a43}
 .br-btn.on{background:#2563eb;color:#fff}
 .br-foot{background:#1a1d22;border-color:#2f343c}
 .br-core{color:#f1f3f6}
 .br-note{background:#262b32;color:#9aa3ad}
 .br-settings{background:#1a1d22;border-color:#2f343c}
 .br-in{background:#22262c;border-color:#3a4049;color:#e5e7eb}
 .br-settings label,.br-settings label.br-check,.br-modes,.br-modes label{color:#c3c9d1}
 .br-mod{background:color-mix(in srgb,var(--c) 22%,transparent)}
}`;
    (document.head || document.documentElement).appendChild(st);
  }

  // ==================== 启动 ====================
  injectCSS();

  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('scroll', removeFab, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { hidePanel(); removeFab(); }
  });

  // 配置里开了「本站自动」，或者已保存本站开关
  if (siteEnabled()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startPageAnnotate, { once: true });
    } else {
      startPageAnnotate();
    }
  }
})();

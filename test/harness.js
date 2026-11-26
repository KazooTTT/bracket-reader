// 无浏览器冒烟测试：用极简 DOM 桩跑 userscript，验证选中→面板渲染整条链路
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '../dist/bracket-reader.user.js');
const code = fs.readFileSync(dist, 'utf8');

// ---- 极简 DOM 桩 ----
class El {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.style = {}; this.dataset = {};
    this.className = ''; this._html = ''; this.hidden = false; this.textContent = '';
    this.attrs = {};
    this.offsetWidth = 90; this.offsetHeight = 32;
    this.offsetLeft = 0; this.offsetTop = 0;
    const self = this;
    this.classList = {
      add(...c) { self.className = [...new Set((self.className + ' ' + c.join(' ')).split(/\s+/).filter(Boolean))].join(' '); },
      remove(...c) { self.className = self.className.split(/\s+/).filter(x => x && !c.includes(x)).join(' '); },
      toggle(c, force) {
        const has = self.className.split(/\s+/).includes(c);
        const want = force === undefined ? !has : !!force;
        if (want) this.add(c); else this.remove(c);
        return want;
      },
      contains(c) { return self.className.split(/\s+/).includes(c); },
    };
  }
  closest() { return null; }
  contains() { return false; }
  set innerHTML(v) { this._html = v; }
  get innerHTML() { return this._html; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); }
  addEventListener() {}
  querySelector(sel) {
    const cls = sel.replace('.', '');
    const found = [];
    const walk = n => {
      if ((n.className || '').split(/\s+/).includes(cls)) found.push(n);
      (n.children || []).forEach(walk);
    };
    walk(this);
    return found[0] || new El('div');
  }
  getBoundingClientRect() { return { top: 100, left: 100, right: 300, bottom: 130 }; }
  setAttribute(k, v) { this.attrs[k] = v; }
}

const head = new El('head');
const docEl = new El('html');
const bodyEl = new El('body');
bodyEl.className = '';
global.document = {
  documentElement: docEl,
  head,
  body: bodyEl,
  readyState: 'complete',
  createElement: t => new El(t),
  createTextNode: t => ({ nodeType: 3, nodeValue: t }),
  addEventListener() {},
  querySelectorAll: () => [],
  createTreeWalker: () => ({ nextNode: () => null }),
};
global.location = { hostname: 'test.local', href: 'https://test.local/' };
global.NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
global.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
global.MutationObserver = class { observe() {} disconnect() {} };
global.IntersectionObserver = class { observe() {} disconnect() {} };

// 选中模拟
let selectedText = '';
global.window = {
  getSelection: () => ({
    toString: () => selectedText,
    getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 50, left: 50, right: 400, bottom: 70 }) }),
  }),
  scrollX: 0, scrollY: 0, innerWidth: 1200,
  addEventListener() {},
};
global.localStorage = { getItem: () => null, setItem() {} };
global.fetch = () => Promise.reject(new Error('no fetch in test'));

// 执行 userscript
try {
  new Function(code)();
} catch (e) {
  console.error('❌ 脚本执行失败：', e.message);
  process.exit(1);
}
console.log('✅ userscript 在桩环境中执行成功');

// 检查样式注入
const style = head.children.find(c => c.tagName === 'style');
if (!style || !style.textContent.includes('.br-panel')) {
  console.error('❌ 未注入样式');
  process.exit(1);
}
console.log('✅ 样式已注入 (' + style.textContent.length + ' 字符)');

// 检查引擎挂载
if (typeof globalThis.BracketEngine === 'undefined') {
  console.error('❌ BracketEngine 未挂载');
  process.exit(1);
}
const r = globalThis.BracketEngine.annotate(
  'After chatting with Laura on this matter, I returned to my office.'
);
console.log('✅ 引擎可用，主干：' + r.sentences[0].core);

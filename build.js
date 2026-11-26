#!/usr/bin/env node
// 把 content/engine.js 内联进 src/app.js，产出单文件 userscript。
const fs = require('fs');
const path = require('path');

const root = __dirname;
const engine = fs.readFileSync(path.join(root, 'content/engine.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

// 去掉 engine 的 module.exports 兼容尾巴，保留 IIFE（会挂到 globalThis.BracketEngine）
const cleaned = engine.replace(/\n\s*if \(typeof module[^\n]*\n/, '\n');

if (!app.includes('/* __ENGINE__ */')) {
  console.error('src/app.js 缺少 /* __ENGINE__ */ 占位符');
  process.exit(1);
}

const out = app.replace('/* __ENGINE__ */', cleaned);
const dest = path.join(root, 'dist/bracket-reader.user.js');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);

const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
console.log(`✅ ${dest}  (${kb} KB)`);

// 版本一致性：package.json 与 userscript 头部必须相同
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const m = out.match(/^\/\/ @version\s+(.+)$/m);
if (m && m[1].trim() !== pkg.version) {
  console.error(`❌ 版本不一致：package.json=${pkg.version}  userscript=${m[1].trim()}`);
  process.exit(1);
}
console.log(`✅ 版本 ${pkg.version}`);

// 冒烟测试：语法 + 引擎可用
try {
  new Function(cleaned);
  console.log('✅ engine 语法正常');
} catch (e) {
  console.error('❌ engine 语法错误：', e.message);
  process.exit(1);
}

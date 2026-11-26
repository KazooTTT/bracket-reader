// 验证并发实现：对固定延迟的 mock LLM 发 N 句，比较并发 1 与并发 5 的墙钟时间
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { startMockLLM } from './mock-llm.mjs';

const DELAY = 1500;          // 每句固定 1.5s
const N = 5;                 // 5 句
const dist = fs.readFileSync('dist/bracket-reader.user.js', 'utf8');

// 生成含 N 句的测试页
const sentences = [
  'After chatting with Laura on this matter for two hours, I returned to my office.',
  'Scientists who study ice cores have concluded that the climate shifted abruptly.',
  'The committee recommended that the university establish a permanent fund.',
  'Her first novel published last year was received with great enthusiasm.',
  'Government policies that encourage renewable energy have reduced emissions.',
].slice(0, N);
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<p id="multi">${sentences.join(' ')}</p></body></html>`;
fs.writeFileSync('test/e2e/.multi.html', html);

const webSrv = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise(r => webSrv.listen(18785, r));

const mock = await startMockLLM(18786, DELAY);

const GM = `window.GM_getValue=(k,d)=>{const v=localStorage.getItem('GM_'+k);return v==null?d:v;};
window.GM_setValue=(k,v)=>localStorage.setItem('GM_'+k,v);`;

const b = await chromium.launch();

async function run(concurrency) {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:18785/');
  await p.addScriptTag({ content: GM });
  await p.evaluate(c => {
    localStorage.setItem('GM_bracketReader.config', JSON.stringify({
      mode: 'ai', apiUrl: 'http://127.0.0.1:18786/v1', apiKey: '',
      model: 'mock', noThinking: true, concurrency: c,
    }));
    localStorage.removeItem('GM_bracketReader.sites');
    localStorage.removeItem('GM_bracketReader.cache');
  }, concurrency);
  await p.reload();
  await p.addScriptTag({ content: GM });
  await p.addScriptTag({ content: dist });
  await p.waitForTimeout(300);

  await p.evaluate(() => {
    const el = document.getElementById('multi');
    const r = document.createRange(); r.selectNodeContents(el);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await p.waitForTimeout(300);

  const before = mock.stats().maxInflight;
  const t0 = Date.now();
  await p.locator('.br-fab').click();

  // 等待所有句子完成：进度提示出现后消失，或主干条数达到 N
  let elapsed = null;
  for (let i = 0; i < 400; i++) {
    await p.waitForTimeout(250);
    const hasProgress = await p.locator('.br-panel .br-progress').count();
    const coreLines = await p.locator('.br-panel .br-core').count();
    if (!hasProgress && coreLines > 0) { elapsed = Date.now() - t0; break; }
  }
  if (!elapsed) elapsed = Date.now() - t0;

  const items = await p.locator('.br-panel .br-item').count();
  const peak = mock.stats().maxInflight;
  await ctx.close();
  return { concurrency, elapsed, items, peak };
}

const r1 = await run(1);
console.log(`并发 1: ${(r1.elapsed / 1000).toFixed(1)}s  句数 ${r1.items}  峰值并发 ${r1.peak}`);

const r5 = await run(5);
console.log(`并发 5: ${(r5.elapsed / 1000).toFixed(1)}s  句数 ${r5.items}  峰值并发 ${r5.peak}`);

console.log('');
const expect1 = N * DELAY / 1000;
const expect5 = Math.ceil(N / 5) * DELAY / 1000;
let pass = 0, total = 0;
const ok = (name, cond, extra) => { total++; if (cond) pass++; console.log(`${cond ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`); };

ok('并发1 达到串行耗时', r1.elapsed / 1000 > expect1 * 0.85, `实际 ${(r1.elapsed/1000).toFixed(1)}s，理论 ≥${expect1}s`);
ok('并发1 峰值并发为 1', r1.peak === 1, `peak=${r1.peak}`);
ok('并发5 峰值并发 > 1', r5.peak > 1, `peak=${r5.peak}`);
ok('并发5 明显快于并发1', r5.elapsed < r1.elapsed * 0.65, `${(r1.elapsed/1000).toFixed(1)}s → ${(r5.elapsed/1000).toFixed(1)}s`);
ok('两种并发都处理了全部句子', r1.items === N && r5.items === N, `${r1.items}/${N}, ${r5.items}/${N}`);

console.log(`\n总计 ${pass}/${total} 通过`);
await b.close();
webSrv.close();
mock.close();
process.exit(pass === total ? 0 : 1);

// 真实站点冒烟测试（headless + MV3 扩展，等价 Tampermonkey 的特权注入）
// 覆盖 CSP 严格的站点（GitHub / MDN / Wikipedia）。
// 需要联网，故不进 CI 默认流程。
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
fs.mkdirSync('test/e2e/.shots', { recursive: true });

const extPath = path.resolve('test/e2e/extension');

const b = await chromium.launchPersistentContext('', {
  channel: 'chromium',              // 新版 headless 支持扩展
  headless: true,
  args: [
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
  ],
  viewport: { width: 1100, height: 820 },
});

async function test(name, url, shot) {
  const p = await b.newPage();
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await p.evaluate(() => {
      localStorage.setItem('GM_bracketReader.config', JSON.stringify({ mode: 'rules' }));
      localStorage.setItem('GM_bracketReader.sites', JSON.stringify({ [location.hostname]: 1 }));
    });
    await p.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });

    let stable = 0, last = null;
    for (let i = 0; i < 40; i++) {
      await p.waitForTimeout(500);
      let d;
      try {
        d = await p.evaluate(() => ({
          wraps: document.querySelectorAll('span.br-wrap').length,
          mods: document.querySelectorAll('span.br-mod').length,
          badge: document.querySelector('.br-badge')?.textContent || '',
        }));
      } catch (e) { continue; }
      last = d;
      if (d.wraps > 0 && !/队列/.test(d.badge)) { if (++stable >= 2) break; }
      else stable = 0;
    }
    const w = last?.wraps ?? 0;
    console.log(`${w > 50 ? '✅' : w > 0 ? '🟡' : '⚠️'} ${name.padEnd(13)} ${String(w).padStart(4)} 段 / ${String(last?.mods ?? 0).padStart(5)} 处   ${last?.badge || ''}`);
    if (shot) await p.screenshot({ path: shot, fullPage: false });
    await p.close();
    return w;
  } catch (e) {
    console.log(`❌ ${name.padEnd(13)} ${e.message.slice(0, 60)}`);
    await p.close();
    return 0;
  }
}

let pass = 0, total = 0;
const results = [];
function record(name, wraps) {
  total++;
  if (wraps > 0) pass++;
  results.push([name, wraps]);
}

record('Wikipedia', await test('Wikipedia', 'https://en.wikipedia.org/wiki/Photosynthesis', 'test/e2e/.shots/hl-wiki.png'));
record('MDN', await test('MDN', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction', 'test/e2e/.shots/hl-mdn.png'));
record('GitHub', await test('GitHub', 'https://github.com/KazooTTT/bracket-reader', null));

await b.close();

const failed = results.filter(([, w]) => w === 0).length;
console.log(`\n总计 ${results.length - failed}/${results.length} 通过`);
if (failed) {
  console.log('失败站点：');
  for (const [n, w] of results) if (w === 0) console.log(`  - ${n}`);
}
process.exit(failed > 0 ? 1 : 0);

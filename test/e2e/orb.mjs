// 验证常驻悬浮球：存在、点击开面板、再点关闭、拖动保存位置、本站开关
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';
fs.mkdirSync('test/e2e/.shots',{recursive:true});
fs.copyFileSync('dist/bracket-reader.user.js','test/e2e/extension/bracket-reader.user.js');

const extPath=path.resolve('test/e2e/extension');
const html=fs.readFileSync('test/e2e/visual.html','utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(html);});
await new Promise(r=>srv.listen(18791,r));

const b=await chromium.launchPersistentContext('',{
  channel:'chromium', headless:true,
  args:[`--disable-extensions-except=${extPath}`,`--load-extension=${extPath}`],
  viewport:{width:760,height:900},
});
const results=[];
const ok=(n,c,e)=>{results.push([c,n,e||'']);console.log(`${c?'✅':'❌'} ${n}${e?'  '+e:''}`)};

const p=await b.newPage();
p.on('pageerror',e=>console.log('[ERR]',e.message.slice(0,120)));
await p.goto('http://127.0.0.1:18791/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1500);

// 1. 球存在（不需要划线、不需要手动开启）
ok('无需配置即出现悬浮球', await p.locator('.br-orb').count()===1);
// 2. 默认开启（绿色 on）
const cls = await p.locator('.br-orb').getAttribute('class');
ok('默认状态为开启', cls.includes('on'), cls);
// 3. 默认全页已标注
await p.waitForTimeout(1500);
const wraps = await p.locator('span.br-wrap').count();
ok('默认已标注全页', wraps>0, `${wraps} 段`);

// 4. 点球打开面板（没有选中任何文字）
await p.locator('.br-orb').click();
await p.waitForTimeout(600);
ok('点球打开面板', await p.locator('.br-panel').count()===1);
const core = (await p.locator('.br-panel .br-core').textContent().catch(()=>'')).trim();
ok('面板有内容（无需划线）', core.length>0, `主干「${core.slice(0,40)}」`);
await p.screenshot({path:'test/e2e/.shots/orb-open.png'});

// 5. 再点球关闭
await p.locator('.br-orb').click();
await p.waitForTimeout(400);
ok('再点球关闭面板', await p.locator('.br-panel').count()===0);

// 6. 拖动保存位置
const box0 = await p.locator('.br-orb').boundingBox();
await p.mouse.move(box0.x+box0.width/2, box0.y+box0.height/2);
await p.mouse.down();
await p.mouse.move(box0.x+box0.width/2-260, box0.y+box0.height/2-300, {steps:8});
await p.mouse.up();
await p.waitForTimeout(400);
const box1 = await p.locator('.br-orb').boundingBox();
ok('球可拖动', Math.abs(box1.x-box0.x)>100, `${Math.round(box0.x)} → ${Math.round(box1.x)}`);
const saved = await p.evaluate(()=>localStorage.getItem('GM_bracketReader.fabPos'));
ok('位置已保存', !!saved, saved||'');
// 拖动不应误触发开面板
ok('拖动不误触面板', await p.locator('.br-panel').count()===0);

// 7. 重载后位置保持
await p.reload({waitUntil:'domcontentloaded'});
await p.waitForTimeout(1800);
const box2 = await p.locator('.br-orb').boundingBox();
ok('重载后位置保持', Math.abs(box2.x-box1.x)<20, `${Math.round(box1.x)} vs ${Math.round(box2.x)}`);

// 8. 面板里点「本站」可关闭全页标注
await p.locator('.br-orb').click();
await p.waitForTimeout(500);
const wrapsBefore = await p.locator('span.br-wrap').count();
await p.locator('.br-panel .br-site').click();
await p.waitForTimeout(800);
const wrapsAfter = await p.locator('span.br-wrap').count();
ok('本站开关可关闭标注', wrapsBefore>0 && wrapsAfter===0, `${wrapsBefore} → ${wrapsAfter}`);

await b.close();
srv.close();
const failed=results.filter(r=>!r[0]).length;
console.log(`\n总计 ${results.length-failed}/${results.length} 通过`);
process.exit(failed?1:0);

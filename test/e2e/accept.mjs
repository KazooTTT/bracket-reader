import { chromium } from 'playwright';
import fs from 'fs';
const dist = fs.readFileSync('dist/bracket-reader.user.js','utf8');
fs.mkdirSync('test/e2e/.shots', { recursive: true });
const GM = `window.GM_getValue=(k,d)=>{const v=localStorage.getItem('GM_'+k);return v==null?d:v;};
window.GM_setValue=(k,v)=>localStorage.setItem('GM_'+k,v);`;
const ORIG = [
"After chatting with Laura on this matter for two hours from 2:00 to 4:00 in the afternoon, I returned to my office.",
"Scientists who study the ice cores that were drilled in Antarctica during the 1990s have concluded that the climate shifted more abruptly than anyone had expected.",
"Economists who study inequality point out that the gap between rich and poor has widened steadily since the financial crisis of 2008.",
"Her first novel, published when she was only twenty-three, was received with enthusiasm by critics who had expected very little from such a young writer.",
"The committee recommended that the university establish a permanent fund to support students from low-income families.",
"Students who are taught to question authority tend to perform better in later professional life."];

// 自动起测试服务（静态页 + CORS 中转）
import http from 'http';
import path from 'path';
const ROOT = 'test/e2e';
const WEB_PORT = 18777;
const PROXY_PORT = 18778;

const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.png':'image/png' };
const webSrv = http.createServer((req,res)=>{
  let u = req.url.split('?')[0];
  if (u === '/') u = '/page.html';
  const f = path.join(ROOT, u);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, {'Content-Type': types[path.extname(f)] || 'text/plain'});
  res.end(fs.readFileSync(f));
});
await new Promise(r => webSrv.listen(WEB_PORT, r));

// 模拟油猴 GM_xmlhttpRequest 的跨域能力
const proxySrv = http.createServer((req,res)=>{
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS',
      'Access-Control-Allow-Headers':'content-type,authorization'});
    return res.end();
  }
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const t = http.request({host:'127.0.0.1',port:3425,path:req.url,method:'POST',
      headers:{'Content-Type':'application/json'}}, r => {
      let b=''; r.on('data',c=>b+=c);
      r.on('end',()=>{ res.writeHead(r.statusCode,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}); res.end(b); });
    });
    t.on('error', e => { res.writeHead(502); res.end(JSON.stringify({error:{message:e.message}})); });
    t.write(body); t.end();
  });
});
await new Promise(r => proxySrv.listen(PROXY_PORT, r));

const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:1100,height:900}});
const errs=[];
const results=[];
function ok(name, pass, extra){ results.push([pass,name,extra||'']); console.log(`${pass?'✅':'❌'} ${name}${extra?'  '+extra:''}`); }

// ---------- 场景 1: 全页自动标注（规则）----------
{
  const p = await ctx.newPage();
  p.on('pageerror',e=>errs.push(e.message.slice(0,120)));
  await p.goto('http://127.0.0.1:18777/');
  await p.evaluate(()=>{
    localStorage.setItem('GM_bracketReader.config', JSON.stringify({mode:'rules'}));
    localStorage.setItem('GM_bracketReader.sites', JSON.stringify({'127.0.0.1':1}));
  });
  await p.reload();
  await p.addScriptTag({content:GM});
  await p.addScriptTag({content:dist});
  await p.waitForTimeout(2500);

  const wraps = await p.locator('span.br-wrap').count();
  const mods = await p.locator('span.br-mod').count();
  const badge = await p.locator('.br-badge').textContent().catch(()=>'');
  ok('全页标注已执行', wraps===6, `${wraps} 段 / ${mods} 处修饰`);
  ok('状态徽标', /括号法 6 段/.test(badge||''), badge);

  const plain = await p.evaluate(()=>{
    const strip = el => { let s=''; for(const n of el.childNodes){ if(n.nodeType===3)s+=n.nodeValue;
      else if(n.nodeType===1){ if(n.classList.contains('br-br'))continue; s+=strip(n);} } return s; };
    return ['p1','p2','p3','p4','p5','li1'].map(id=>{const e=document.getElementById(id);return e?strip(e).replace(/\s+/g,' ').trim():null;});
  });
  const intact = plain.filter((t,i)=>t===ORIG[i]).length;
  ok('原文零损坏', intact===6, `${intact}/6`);
  await p.screenshot({path:'test/e2e/.shots/acc-1-page.png', fullPage:true});
  await p.close();
}

// ---------- 场景 2: 划词 → 面板 → 关闭还原 ----------
{
  const p = await ctx.newPage();
  p.on('pageerror',e=>errs.push(e.message.slice(0,120)));
  await p.goto('http://127.0.0.1:18777/');
  await p.evaluate(()=>{
    localStorage.setItem('GM_bracketReader.config', JSON.stringify({mode:'rules'}));
    localStorage.setItem('GM_bracketReader.sites', JSON.stringify({'127.0.0.1':1}));
  });
  await p.reload();
  await p.addScriptTag({content:GM});
  await p.addScriptTag({content:dist});
  await p.waitForTimeout(2200);

  // 先关掉全页标注（还原）
  await p.evaluate(()=>{
    const el=document.getElementById('p1');
    const r=document.createRange(); r.selectNodeContents(el);
    const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
    document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  });
  await p.waitForTimeout(300);
  ok('划词按钮出现', (await p.locator('.br-fab').count())===1);
  await p.locator('.br-fab').click();
  await p.waitForTimeout(500);
  ok('面板打开', (await p.locator('.br-panel').count())===1);
  const core = (await p.locator('.br-panel .br-core').textContent().catch(()=>'')).trim();
  ok('显示主干', core.length>0, `「${core}」`);
  ok('标出修饰成分', (await p.locator('.br-panel .br-mod').count())>0);

  // 点本站开关 → 关闭全页标注并还原
  await p.locator('.br-panel .br-site').click();
  await p.waitForTimeout(800);
  const afterWraps = await p.locator('span.br-wrap').count();
  ok('关闭后完全还原', afterWraps===0, `wrap=${afterWraps}`);
  const restored = await p.evaluate(()=>document.getElementById('p1').textContent.replace(/\s+/g,' ').trim());
  ok('还原文本一致', restored===ORIG[0]);
  await p.close();
}

// ---------- 场景 3: AI 模式 ----------
// 需要本地网关 http://127.0.0.1:3425/v1；不可用则跳过
const gwOk = await (async () => {
  try {
    const r = await fetch('http://127.0.0.1:3425/v1/models', { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch (e) { return false; }
})();

if (!gwOk) {
  console.log('⏭  跳过 AI 场景（本地网关 127.0.0.1:3425 不可用）');
} else {
  const p = await ctx.newPage();
  p.on('pageerror',e=>errs.push(e.message.slice(0,120)));
  await p.goto('http://127.0.0.1:18777/');
  await p.evaluate(()=>{
    localStorage.setItem('GM_bracketReader.config', JSON.stringify({
      mode:'ai', apiUrl:'http://127.0.0.1:18778/v1', apiKey:'',
      model:'group/deepseek-free', noThinking:true}));
    localStorage.removeItem('GM_bracketReader.sites');
    localStorage.removeItem('GM_bracketReader.cache');
  });
  await p.reload();
  await p.addScriptTag({content:GM});
  await p.addScriptTag({content:dist});
  await p.waitForTimeout(300);

  // 用 p3（Economists ... point out）—— 规则的弱项
  await p.evaluate(()=>{
    const el=document.getElementById('p3');
    const r=document.createRange(); r.selectNodeContents(el);
    const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
    document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  });
  await p.waitForTimeout(300);
  await p.locator('.br-fab').click();
  console.log('   （等待 AI，约 15-30s）');
  await p.waitForTimeout(40000);

  const aiCore = (await p.locator('.br-panel .br-core').textContent().catch(()=>'')).trim();
  const aiMods = await p.locator('.br-panel .br-mod').count();
  const progress = await p.locator('.br-panel .br-progress').textContent().catch(()=>'');
  const errTxt = await p.locator('.br-panel .br-err').textContent().catch(()=>'');

  ok('AI 返回结果', aiMods>0 && !errTxt, `${aiMods} 处修饰${errTxt?' 错误:'+errTxt:''}`);
  ok('AI 主干含主句谓语 point', /point/i.test(aiCore), `「${aiCore}」`);
  ok('进度提示已清除', !progress, progress||'（已清除）');
  await p.screenshot({path:'test/e2e/.shots/acc-3-ai.png'});
  await p.close();
}

console.log('\n控制台错误:', errs.length? errs.join(' | ') : '✅ 无');
const failed = results.filter(r=>!r[1]).length;
console.log(`\n总计 ${results.length-failed}/${results.length} 通过`);
await b.close();
webSrv.close();
proxySrv.close();

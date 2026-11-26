import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';
fs.mkdirSync('test/e2e/.shots',{recursive:true});
fs.copyFileSync('dist/bracket-reader.user.js','test/e2e/extension/bracket-reader.user.js');

const extPath=path.resolve('test/e2e/extension');
const html=fs.readFileSync('test/e2e/visual.html','utf8');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(html);});
await new Promise(r=>srv.listen(18790,r));

const b=await chromium.launchPersistentContext('',{
  channel:'chromium', headless:true,
  args:[`--disable-extensions-except=${extPath}`,`--load-extension=${extPath}`],
  viewport:{width:760,height:900},
  colorScheme: process.env.DARK ? 'dark' : 'light',
});
const p=await b.newPage();
await p.goto('http://127.0.0.1:18790/',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>{
  localStorage.setItem('GM_bracketReader.config', JSON.stringify({mode:'rules'}));
  localStorage.setItem('GM_bracketReader.sites', JSON.stringify({[location.hostname]:1}));
});
await p.reload({waitUntil:'domcontentloaded'});
for(let i=0;i<20;i++){
  await p.waitForTimeout(400);
  const w=await p.evaluate(()=>document.querySelectorAll('span.br-wrap').length);
  if(w>0){await p.waitForTimeout(600);break;}
}
const tag = process.env.DARK ? 'dark' : 'light';
await p.screenshot({path:`test/e2e/.shots/visual-${tag}.png`, fullPage:true});
await b.close();
srv.close();
console.log('shot', tag);

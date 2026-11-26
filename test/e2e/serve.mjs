import http from 'http';
import fs from 'fs';
import path from 'path';
const root = path.resolve('tmp-test');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.png':'image/png' };
const srv = http.createServer((req,res)=>{
  let p = req.url.split('?')[0];
  if (p === '/') p = '/page.html';
  const f = path.join(root, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, {'Content-Type': types[path.extname(f)] || 'text/plain'});
  res.end(fs.readFileSync(f));
});
srv.listen(18777, ()=>console.log('listening 18777'));

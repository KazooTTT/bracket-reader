// 可控的假 LLM：每句固定延迟，用于测「客户端并发实现是否正确」
import http from 'http';

export function startMockLLM(port, delayMs = 2000) {
  let inflight = 0;
  let maxInflight = 0;
  const srv = http.createServer((req, res) => {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'content-type,authorization',
    };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

    if (req.url.startsWith('/__stats')) {
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
      return res.end(JSON.stringify({ maxInflight, inflight }));
    }

    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      let sentence = '';
      try {
        const j = JSON.parse(body);
        sentence = j.messages.find(m => m.role === 'user').content;
      } catch (e) {}

      setTimeout(() => {
        inflight--;
        // 原句原样返回，保证重建校验通过
        const arr = [['t', sentence]];
        res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(arr) } }] }));
      }, delayMs);
    });
  });
  return new Promise(resolve => {
    srv.listen(port, () => resolve({
      close: () => srv.close(),
      stats: () => ({ maxInflight, inflight }),
    }));
  });
}

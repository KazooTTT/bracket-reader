const E = require('../content/engine.js');

const CASES = [
  {
    name: '纯介词堆叠',
    text: 'After chatting with Laura on this matter for two hours from 2:00 to 4:00 in the afternoon, I returned to my office.',
    expectCore: 'I returned',
  },
  {
    name: '三层嵌套从句',
    text: 'Scientists who study the ice cores that were drilled in Antarctica during the 1990s have concluded that the climate shifted more abruptly than anyone had expected.',
    expectCore: 'Scientists have concluded',
  },
  {
    name: '并列介词短语',
    text: 'Governments of the people, by the people and for the people shall not perish from the earth.',
    expectCore: 'Governments shall not perish',
  },
  {
    name: '条件从句',
    text: 'If the government does not act soon, the problem will become much worse.',
    expectCore: 'the problem will become',
  },
  {
    name: '分词状语开头',
    text: 'To improve my English, I often listen to the English radio.',
    expectCore: 'I often listen',
  },
  {
    name: '从句在中间',
    text: 'Li Hui is a teacher who teaches English.',
    expectCore: 'Li Hui is a teacher',
  },
  {
    name: '从句到谓语终止',
    text: 'Yao Ming, who was a top basketball player, is studying in Shanghai now.',
    expectCore: 'Yao Ming is studying',
  },
  {
    name: '插入语',
    text: 'The findings, although preliminary, challenge the prevailing view.',
    expectCore: 'The findings challenge',
  },
  {
    name: '被动 + 介词',
    text: 'The report was published by the committee in March.',
    expectCore: 'The report was published',
  },
  {
    name: '关系代词省略',
    text: 'The book I bought yesterday was written by a famous author.',
    expectCore: 'The book was written',
  },
];

function coreWords(core) {
  return (core || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
}

let pass = 0;
const fails = [];
for (const c of CASES) {
  const r = E.annotate(c.text);
  const core = r.sentences.map(s => s.core).join(' ');
  const cw = coreWords(core);
  const ew = coreWords(c.expectCore);
  // 期望主干词是否全部出现在核心中，且顺序一致
  let idx = 0, ok = true;
  for (const w of cw) {
    if (idx < ew.length && w === ew[idx]) idx++;
  }
  ok = idx === ew.length;
  if (ok) pass++; else fails.push({ name: c.name, core, expect: c.expectCore });
  console.log((ok ? '✅' : '❌') + ' ' + c.name);
  console.log('   core: ' + core);
  if (!ok) console.log('   want: ' + c.expectCore);
}
console.log('\n' + pass + '/' + CASES.length + ' passed');

// 打印一个详细结构
console.log('\n--- 嵌套句结构 ---');
const r = E.annotate(CASES[1].text);
function show(n, d) {
  const pad = '  '.repeat(d);
  for (const c of n.children) {
    if (c.type === 'text') console.log(pad + JSON.stringify(c.text));
    else { console.log(pad + '[' + c.type + ' conf=' + c.conf + ']'); show(c, d + 1); }
  }
}
show(r.sentences[0].tree, 0);

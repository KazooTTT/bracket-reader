// 真实准确率：对 20 个真实句子手写标准主干，逐句核对
const E = require('../content/engine.js');

// gold = 正确答案（人工标注，去掉三道修饰成分后的主干）
const GOLD = [
  ['The rapid expansion of urban areas in developing countries has placed enormous pressure on infrastructure that was designed for far smaller populations.',
   'The rapid expansion has placed pressure'],
  ["Researchers have long suspected that the decline of bee populations, which pollinate a large share of the world's food crops, could trigger a crisis in global agriculture.",
   'Researchers have suspected that the decline could trigger a crisis'],
  ['Although the treaty was signed by more than one hundred nations, few of them have taken the concrete steps needed to meet its targets.',
   'few of them have taken the concrete steps'],
  ['What makes the discovery remarkable is not the fossil itself but the layers of sediment surrounding it, which preserve traces of an ancient river delta.',
   'What makes the discovery remarkable is not the fossil but the layers'],
  ['The author argues, in a series of closely reasoned chapters, that the industrial revolution began not in Britain but in the cotton mills of northern Italy.',
   'The author argues that the revolution began not in Britain but in the mills'],
  ['Despite decades of investment in public health, millions of children in sub-Saharan Africa still die each year from diseases that are entirely preventable.',
   'millions of children still die'],
  ['By the time the rescue team reached the summit, the climbers had been trapped in the storm for more than thirty-six hours.',
   'the climbers had been trapped'],
  ['Economists who study inequality point out that the gap between rich and poor has widened steadily since the financial crisis of 2008.',
   'Economists point out that the gap has widened'],
  ['Her first novel, published when she was only twenty-three, was received with enthusiasm by critics who had expected very little from such a young writer.',
   'Her first novel was received'],
  ['The committee recommended that the university establish a permanent fund to support students from low-income families.',
   'The committee recommended'],
  ['Because the data had been collected over such a long period, the researchers were able to detect patterns that shorter studies had missed.',
   'the researchers were able to detect patterns'],
  ['Nothing in the report suggests that the company acted illegally, but the scale of the losses raises questions that its directors have yet to answer.',
   'Nothing suggests that the company acted illegally but the scale raises questions'],
  ['Tom argued that the plan would fail, and his colleagues, though reluctant at first, eventually came to agree with him.',
   'Tom argued and his colleagues came to agree'],
  ['The paintings, many of which had never been displayed in public, were sold at auction for prices far above the estimates.',
   'The paintings were sold'],
  ['She had no sooner finished speaking than the audience rose to its feet and applauded for nearly five minutes.',
   'She had finished speaking than the audience rose and applauded'],
  ['After chatting with Laura on this matter for two hours from 2:00 to 4:00 in the afternoon, I returned to my office.',
   'I returned'],
  ['Government policies that encourage the adoption of renewable energy have substantially reduced carbon emissions in several European countries.',
   'Government policies have reduced carbon emissions'],
  ['The question of whether machines can genuinely understand language remains one of the most contested issues in contemporary philosophy.',
   'The question remains'],
  ['A report published last week by the World Health Organization warned that antibiotic resistance could kill ten million people a year by 2050.',
   'A report warned that antibiotic resistance could kill people'],
  ['Students who are taught to question authority, rather than simply memorize facts, tend to perform better in later professional life.',
   'Students tend to perform better'],
];

// 判定：gold 的所有实词是否按顺序出现在 core 中
function coverage(core, gold) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const c = norm(core), g = norm(gold);
  let i = 0;
  for (const w of c) if (i < g.length && w === g[i]) i++;
  return i / g.length;
}

let exact = 0, partial = 0;
const rows = [];
for (const [s, gold] of GOLD) {
  const r = E.annotate(s);
  const core = r.sentences.map(x => x.core).filter(Boolean).join(' ');
  const cov = coverage(core, gold);
  if (cov >= 0.999) { exact++; rows.push(['✅ 完全正确', cov, core, gold]); }
  else if (cov >= 0.6) { partial++; rows.push(['🟡 部分正确', cov, core, gold]); }
  else { rows.push(['❌ 错误', cov, core, gold]); }
}

console.log(`完全正确 ${exact}/${GOLD.length} = ${(exact / GOLD.length * 100).toFixed(0)}%`);
console.log(`含部分正确 ${exact + partial}/${GOLD.length} = ${((exact + partial) / GOLD.length * 100).toFixed(0)}%\n`);
for (const [tag, cov, core, gold] of rows) {
  if (tag.startsWith('✅')) continue;
  console.log(`${tag}  ${(cov * 100).toFixed(0)}%`);
  console.log(`  得到: ${core || '(空)'}`);
  console.log(`  期望: ${gold}`);
  console.log('');
}

// 两个独立测量：
// A) 修饰成分「边界识别」的 span 级 F1 —— 规则本身准不准
// B) 「主句主谓」识别的准确率 —— 只做这件事的话瓶颈还在不在
const E = require('../content/engine.js');

// ---------- A) span 级标注 ----------
// gold：人工标注的修饰成分片段（原文子串）。嵌套的也算。
const SPAN_CASES = [
  ['The rapid expansion of urban areas in developing countries has placed enormous pressure on infrastructure that was designed for far smaller populations.',
   ['of urban areas', 'in developing countries', 'on infrastructure', 'that was designed for far smaller populations', 'for far smaller populations']],
  ['Although the treaty was signed by more than one hundred nations, few of them have taken the concrete steps needed to meet its targets.',
   ['Although the treaty was signed by more than one hundred nations', 'by more than one hundred nations', 'of them', 'needed to meet its targets', 'to meet its targets']],
  ['Despite decades of investment in public health, millions of children in sub-Saharan Africa still die each year from diseases that are entirely preventable.',
   ['Despite decades of investment in public health', 'of investment', 'in public health', 'of children', 'in sub-Saharan Africa', 'each year', 'from diseases', 'that are entirely preventable']],
  ['Her first novel, published when she was only twenty-three, was received with enthusiasm by critics who had expected very little from such a young writer.',
   ['published when she was only twenty-three', 'when she was only twenty-three', 'with enthusiasm', 'by critics', 'who had expected very little from such a young writer', 'from such a young writer']],
  ['Because the data had been collected over such a long period, the researchers were able to detect patterns that shorter studies had missed.',
   ['Because the data had been collected over such a long period', 'over such a long period', 'to detect patterns', 'that shorter studies had missed']],
  ['A report published last week by the World Health Organization warned that antibiotic resistance could kill ten million people a year by 2050.',
   ['published last week', 'by the World Health Organization', 'that antibiotic resistance could kill ten million people a year by 2050', 'a year', 'by 2050']],
  ['Students who are taught to question authority, rather than simply memorize facts, tend to perform better in later professional life.',
   ['who are taught to question authority', 'to question authority', 'rather than simply memorize facts', 'to perform better', 'in later professional life']],
  ['The question of whether machines can genuinely understand language remains one of the most contested issues in contemporary philosophy.',
   ['of whether machines can genuinely understand language', 'whether machines can genuinely understand language', 'of the most contested issues', 'in contemporary philosophy']],
];

// 从引擎树里收集所有被括片段的纯文本
function collect(node, out) {
  for (const c of node.children) {
    if (c.type === 'text') continue;
    const txt = flat(c);
    if (txt.trim()) out.push(txt);
    collect(c, out);
  }
  return out;
}
function flat(node) {
  let s = '';
  for (const c of node.children) {
    if (c.type === 'text') s += c.text;
    else s += flat(c);
  }
  return s;
}

const norm = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

let tp = 0, fp = 0, fn = 0;
for (const [sent, gold] of SPAN_CASES) {
  const r = E.annotate(sent);
  const got = [];
  for (const s of r.sentences) collect(s.tree, got);
  const g = gold.map(norm);
  const p = got.map(norm);

  const usedGold = new Set();
  for (const x of p) {
    // 命中：与某个 gold 片段的词序列高度重合（>=80% 词相同）
    let best = -1, bestScore = 0;
    g.forEach((y, i) => {
      if (usedGold.has(i)) return;
      const xw = x.split(' '), yw = y.split(' ');
      const hit = xw.filter(w => yw.includes(w)).length;
      const score = hit / Math.max(xw.length, yw.length);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    if (bestScore >= 0.8) { tp++; usedGold.add(best); }
    else fp++;
  }
  fn += g.length - usedGold.size;
}

const prec = tp / (tp + fp || 1);
const rec = tp / (tp + fn || 1);
const f1 = 2 * prec * rec / (prec + rec || 1);
console.log('===== A) 修饰成分边界识别（span 级） =====');
console.log(`命中 ${tp} / 误报 ${fp} / 漏报 ${fn}`);
console.log(`精确率 ${(prec * 100).toFixed(0)}%  召回率 ${(rec * 100).toFixed(0)}%  F1 ${(f1 * 100).toFixed(0)}%\n`);

// ---------- B) 主句主谓识别 ----------
// gold：主句谓语动词（人工标注）
const MAIN_VERB = [
  ['The rapid expansion of urban areas in developing countries has placed enormous pressure on infrastructure that was designed for far smaller populations.', 'placed'],
  ["Researchers have long suspected that the decline of bee populations, which pollinate a large share of the world's food crops, could trigger a crisis in global agriculture.", 'suspected'],
  ['Although the treaty was signed by more than one hundred nations, few of them have taken the concrete steps needed to meet its targets.', 'taken'],
  ['What makes the discovery remarkable is not the fossil itself but the layers of sediment surrounding it, which preserve traces of an ancient river delta.', 'is'],
  ['The author argues, in a series of closely reasoned chapters, that the industrial revolution began not in Britain but in the cotton mills of northern Italy.', 'argues'],
  ['Despite decades of investment in public health, millions of children in sub-Saharan Africa still die each year from diseases that are entirely preventable.', 'die'],
  ['By the time the rescue team reached the summit, the climbers had been trapped in the storm for more than thirty-six hours.', 'been'],
  ['Economists who study inequality point out that the gap between rich and poor has widened steadily since the financial crisis of 2008.', 'point'],
  ['Her first novel, published when she was only twenty-three, was received with enthusiasm by critics who had expected very little from such a young writer.', 'received'],
  ['The committee recommended that the university establish a permanent fund to support students from low-income families.', 'recommended'],
  ['Because the data had been collected over such a long period, the researchers were able to detect patterns that shorter studies had missed.', 'were'],
  ['Nothing in the report suggests that the company acted illegally, but the scale of the losses raises questions that its directors have yet to answer.', 'suggests'],
  ['Tom argued that the plan would fail, and his colleagues, though reluctant at first, eventually came to agree with him.', 'argued'],
  ['The paintings, many of which had never been displayed in public, were sold at auction for prices far above the estimates.', 'sold'],
  ['After chatting with Laura on this matter for two hours from 2:00 to 4:00 in the afternoon, I returned to my office.', 'returned'],
  ['Government policies that encourage the adoption of renewable energy have substantially reduced carbon emissions in several European countries.', 'reduced'],
  ['The question of whether machines can genuinely understand language remains one of the most contested issues in contemporary philosophy.', 'remains'],
  ['A report published last week by the World Health Organization warned that antibiotic resistance could kill ten million people a year by 2050.', 'warned'],
  ['Students who are taught to question authority, rather than simply memorize facts, tend to perform better in later professional life.', 'tend'],
  ["She had no sooner finished speaking than the audience rose to its feet and applauded for nearly five minutes.", 'rose'],
];

// 简易主句谓语启发式：
// 跳过句首的从属从句（以从属连词开头 → 跳到其后第一个逗号）
// 之后找第一个「有限谓语」：aux，或非 -ed/-ing 结尾、前面不是 det/prep 的实词动词
const SUBS = /^(although|though|because|if|unless|when|while|since|before|after|as|once|whereas|whenever|wherever|even|despite|in spite of|by the time|until|till)$/i;

function guessMainVerb(sent) {
  const toks = E.tokenize(sent);
  E.classify(toks);
  const W = toks.filter(t => t.cat === 'word');

  // 1. 跳过开头的从属从句
  let i = 0;
  if (W[0] && SUBS.test(W[0].text)) {
    // 跳到第一个逗号
    let k = 0;
    for (; k < toks.length; k++) {
      if (toks[k].cat === 'punct' && toks[k].text === ',') break;
    }
    const afterComma = toks.slice(k + 1).find(t => t.cat === 'word');
    i = W.indexOf(afterComma);
    if (i < 0) i = 0;
  }
  // 2. 跳过开头的介词短语
  while (i < W.length && W[i].pos === 'prep') {
    let k = i + 1;
    while (k < W.length && /^(det|adj|adv|num|noun|pron)$/.test(W[k].pos)) k++;
    i = k;
  }

  // 3. 找第一个有限谓语
  for (let k = i; k < W.length; k++) {
    const w = W[k];
    const p = W[k - 1];
    if (w.pos === 'verb' || w.pos === 'verb?') {
      const lw = w.text.toLowerCase();
      if (/(ing|ed)$/.test(lw) && !(p && p.pos === 'aux')) continue;
      if (p && /^(det|prep)$/.test(p.pos)) continue;
      return w.text;
    }
  }
  return null;
}

let ok = 0;
const wrong = [];
for (const [s, gold] of MAIN_VERB) {
  const g = guessMainVerb(s);
  if (g && g.toLowerCase() === gold.toLowerCase()) ok++;
  else wrong.push({ s, got: g, want: gold });
}
console.log('===== B) 主句谓语识别 =====');
console.log(`正确 ${ok}/${MAIN_VERB.length} = ${(ok / MAIN_VERB.length * 100).toFixed(0)}%\n`);
for (const w of wrong) {
  console.log(`  得到「${w.got}」 期望「${w.want}」`);
  console.log(`    ${w.s.slice(0, 90)}`);
}

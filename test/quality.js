// 质量评估：主干是否"看起来像句子"（含谓语、不过短、没有残留标点）
const E = require('../content/engine.js');

const SENTENCES = [
  'The rapid expansion of urban areas in developing countries has placed enormous pressure on infrastructure that was designed for far smaller populations.',
  "Researchers have long suspected that the decline of bee populations, which pollinate a large share of the world's food crops, could trigger a crisis in global agriculture.",
  'Although the treaty was signed by more than one hundred nations, few of them have taken the concrete steps needed to meet its targets.',
  'What makes the discovery remarkable is not the fossil itself but the layers of sediment surrounding it, which preserve traces of an ancient river delta.',
  'The author argues, in a series of closely reasoned chapters, that the industrial revolution began not in Britain but in the cotton mills of northern Italy.',
  'Despite decades of investment in public health, millions of children in sub-Saharan Africa still die each year from diseases that are entirely preventable.',
  'By the time the rescue team reached the summit, the climbers had been trapped in the storm for more than thirty-six hours.',
  'Economists who study inequality point out that the gap between rich and poor has widened steadily since the financial crisis of 2008.',
  'Her first novel, published when she was only twenty-three, was received with enthusiasm by critics who had expected very little from such a young writer.',
  'The committee recommended that the university establish a permanent fund to support students from low-income families.',
  'Because the data had been collected over such a long period, the researchers were able to detect patterns that shorter studies had missed.',
  'Nothing in the report suggests that the company acted illegally, but the scale of the losses raises questions that its directors have yet to answer.',
  'Tom argued that the plan would fail, and his colleagues, though reluctant at first, eventually came to agree with him.',
  'The paintings, many of which had never been displayed in public, were sold at auction for prices far above the estimates.',
  'She had no sooner finished speaking than the audience rose to its feet and applauded for nearly five minutes.',
  'After chatting with Laura on this matter for two hours from 2:00 to 4:00 in the afternoon, I returned to my office.',
  'Government policies that encourage the adoption of renewable energy have substantially reduced carbon emissions in several European countries.',
  'The question of whether machines can genuinely understand language remains one of the most contested issues in contemporary philosophy.',
  'A report published last week by the World Health Organization warned that antibiotic resistance could kill ten million people a year by 2050.',
  'Students who are taught to question authority, rather than simply memorize facts, tend to perform better in later professional life.',
];

const AUXISH = /\b(is|are|was|were|be|been|being|am|has|have|had|do|does|did|will|would|shall|should|can|could|may|might|must|goes|went|come|came|make|makes|made|take|took|give|gave|get|got|seem|seems|become|becomes|became|remain|remains|show|shows|say|says|said|find|finds|found|keep|keeps|kept|leave|leaves|left|stand|stands|stood|hold|holds|held|bring|brings|brought|begin|begins|began|grow|grows|grew|lose|loses|lost|pay|pays|paid|meet|meets|met|run|runs|ran|sit|sits|sat|speak|speaks|spoke|write|writes|wrote|lose|win|wins|won|fall|falls|fell|rise|rises|rose|drive|drives|drove|eat|eats|ate|hear|hears|heard|send|sends|sent|build|builds|built|spend|spends|spent|die|dies|died|live|lives|lived|seem|seems|seemed|appear|appears|appeared|prove|proves|proved|argue|argues|argued|claim|claims|claimed|suggest|suggests|suggested|report|reports|reported|warn|warns|warned|point|points|pointed|tend|tends|tended|reduce|reduces|reduced|place|places|placed|expect|expects|expected|design|designs|designed|pollinate|pollinates|preserve|preserves|preserved|trigger|triggers|shift|shifts|shifted|conclude|concludes|concluded|drill|drills|drilled|study|studies|studied|return|returns|returned|trap|traps|trapped|receive|receives|received|take|takes|widen|widens|widened|act|acts|acted|raise|raises|raised|establish|establishes|miss|misses|missed|agree|agrees|agreed|sell|sells|sold|applaud|applauds|applauded|finish|finishes|finished|rise|rose|recommend|recommends|recommended|collect|collects|collected|detect|detects|detected|encourage|encourages|encouraged|adopt|adopts|adopted|kill|kills|killed|understand|understands|understood|perform|performs|performed|teach|teaches|taught|memorize|memorizes|memorized)\b/;

function assess(core) {
  const problems = [];
  const w = core.replace(/[.,;:]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!core.trim()) problems.push('空');
  if (w.length < 2) problems.push('过短');
  if (!AUXISH.test(core) && !/\b\w+(ed|s)\b/.test(core)) problems.push('无谓语');
  if (/[,;:—]/.test(core)) problems.push('残留标点');
  return problems;
}

let good = 0;
const bad = [];
for (const s of SENTENCES) {
  const r = E.annotate(s);
  const cores = r.sentences.map(x => x.core).filter(Boolean);
  const core = cores.join(' | ');
  const probs = assess(core);
  if (probs.length === 0) good++;
  else bad.push({ s, core, probs });
}

console.log(`可用率：${good}/${SENTENCES.length} = ${(good / SENTENCES.length * 100).toFixed(0)}%\n`);
console.log('需要 LLM 兜底的句子：');
for (const b of bad) {
  console.log(`  [${b.probs.join(',')}] ${b.core || '(空)'}`);
}

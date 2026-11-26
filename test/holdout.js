const E = require('../content/engine.js');

// 独立测试集：不复用之前调过的句子
const HOLD = [
  { t: 'Although the experiment failed, the researchers learned a great deal from it.', core: 'the researchers learned' },
  { t: 'The number of students enrolling in computer science has risen sharply over the past decade.', core: 'The number has risen' },
  { t: 'Companies that invest heavily in research and development tend to outperform their competitors.', core: 'Companies tend' },
  { t: 'Having finished his homework, Tom went out to play football with his friends.', core: 'Tom went out' },
  { t: 'The committee, after reviewing all the proposals, decided to postpone the final decision.', core: 'The committee decided' },
  { t: 'It is widely believed that climate change poses a serious threat to coastal cities.', core: 'It is widely believed' },
  { t: 'The medicine, which was developed over twenty years, has saved millions of lives in Africa.', core: 'The medicine has saved' },
  { t: 'Neither the students nor the teachers were informed about the sudden change in schedule.', core: 'Neither the students nor the teachers were informed' },
  { t: 'Because the train was delayed by heavy snow, we missed our connecting flight.', core: 'we missed' },
  { t: 'The scientists working in the remote station collected samples from the glacier every morning.', core: 'The scientists collected' },
  { t: 'What surprised everyone was the speed with which the government responded to the crisis.', core: 'What surprised everyone was' },
  { t: 'Prices for agricultural products have been rising because of the prolonged drought.', core: 'Prices have been rising' },
  { t: 'She spoke so softly that nobody in the audience could hear her.', core: 'She spoke' },
  { t: 'The proposal put forward by the union was rejected by the management board.', core: 'The proposal was rejected' },
  { t: 'In most developing countries, access to clean water remains a serious problem.', core: 'access remains' },
  { t: 'Anyone who has ever tried to learn a foreign language knows how difficult it can be.', core: 'Anyone knows' },
  { t: 'The book, published in 1998, is still regarded as the standard reference on the subject.', core: 'The book is still regarded' },
  { t: 'While the negotiations were continuing, both sides agreed to keep the details secret.', core: 'both sides agreed' },
  { t: 'The company announced that it would cut a quarter of its workforce by the end of the year.', core: 'The company announced' },
  { t: 'A growing number of researchers argue that the current model of peer review is fundamentally flawed.', core: 'A growing number argue' },
];

function words(s) {
  return (s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
}

let pass = 0;
const fails = [];
for (const c of HOLD) {
  const r = E.annotate(c.t);
  const core = r.sentences.map(s => s.core).join(' ');
  const cw = words(core), ew = words(c.core);
  let idx = 0;
  for (const w of cw) if (idx < ew.length && w === ew[idx]) idx++;
  const ok = idx === ew.length;
  if (ok) pass++; else fails.push({ text: c.t, core, want: c.core });
}
console.log(pass + '/' + HOLD.length + ' holdout passed');
console.log('');
for (const f of fails) {
  console.log('❌ ' + f.text);
  console.log('   got : ' + f.core);
  console.log('   want: ' + f.want);
  console.log('');
}

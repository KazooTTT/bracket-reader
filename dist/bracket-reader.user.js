// ==UserScript==
// @name         括号法阅读助手 (BracketReader)
// @namespace    https://github.com/KazooTTT/bracket-reader
// @version      0.3.0
// @description  用「括号法」阅读英文长难句：把介词短语、从句、非谓语括起来，露出主干。支持离线规则（即时）与 AI 精修（更准），可按网站开关自动标注。
// @author       kazoottt
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @connect      *
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/KazooTTT/bracket-reader/main/dist/bracket-reader.user.js
// @downloadURL  https://raw.githubusercontent.com/KazooTTT/bracket-reader/main/dist/bracket-reader.user.js
// ==/UserScript==

/* BracketReader — 括号法标注引擎
 * 纯规则引擎：识别 介词短语 / 从句 / 非谓语短语，括起来露出主干。
 * 零依赖，浏览器 content script 与 Node 通用。
 */
(function (root) {
  'use strict';

  // ================= 词表 =================
  const PREP = new Set(('aboard about above across after against along alongside amid amidst among amongst ' +
    'around at before behind below beneath beside besides between beyond by concerning considering ' +
    'despite down during except excepting excluding following for from in inside into like minus near ' +
    'notwithstanding of off on onto opposite out outside over past per plus regarding round save since ' +
    'through throughout thru till to toward towards under underneath unlike until up upon via with ' +
    'within without').split(/\s+/));

  const SUB = new Set(('that which who whom whose when where why how if whether because although though ' +
    'whilst once provided supposing given lest whereas').split(/\s+/));

  const COORD = new Set(['and', 'or', 'but', 'nor', 'yet']);

  const NUM_WORD = new Set(('one two three four five six seven eight nine ten eleven twelve thirteen ' +
    'fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy ' +
    'eighty ninety hundred thousand million billion trillion dozen half quarter double triple ' +
    'first second third fourth fifth sixth seventh eighth ninth tenth last next few several many ' +
    'both all some any each every').split(/\s+/));

  const MONTH = new Set(('january february march april may june july august september october ' +
    'november december jan feb mar apr jun jul aug sep sept oct nov dec ' +
    'monday tuesday wednesday thursday friday saturday sunday').split(/\s+/));

  const DET = new Set(('the a an this these those my your his her its our their some any no every each ' +
    'all both either neither another much many few little several such what whichever whatever ' +
    'enough').split(/\s+/));

  const AUX = new Set(('be am is are was were been being have has had having do does did doing ' +
    'will would shall should can could may might must ought').split(/\s+/));

  const PRON = new Set(('i you he she it we they me him her us them myself yourself himself herself ' +
    'itself ourselves yourselves themselves someone anyone everyone nobody ' +
    'somebody anybody everybody nothing something anything everything').split(/\s+/));

  const ADJ_COMMON = new Set(('big small large little long short high low old new young good bad great ' +
    'important different possible likely available clear main major recent various common certain ' +
    'specific particular general public private social economic political national international ' +
    'local global human natural physical mental modern ancient early late full empty free open closed ' +
    'hard soft strong weak easy difficult simple complex true false real whole same other ' +
    'first second third last next better best worse worst ' +
    'huge tiny vast wide narrow deep shallow warm cold hot cool dry wet rich poor safe dangerous ' +
    'effective efficient successful significant obvious serious heavy light bright dark quick slow ' +
    'able unable likely unlikely aware afraid alive alone asleep awake').split(/\s+/));

  const ADV_COMMON = new Set(('not very too quite rather almost just only even still yet already always ' +
    'never often sometimes usually again also however therefore thus hence moreover furthermore ' +
    'nevertheless instead otherwise meanwhile afterwards later soon now then here there abroad ahead ' +
    'apart aside away back else far forward home together twice well ever ' +
    'perhaps probably certainly clearly nearly hardly barely simply really actually truly fully ' +
    'completely entirely largely partly mostly mainly especially particularly generally typically ' +
    'approximately roughly exactly precisely merely consequently ' +
    'accordingly similarly likewise notably importantly surprisingly ultimately ' +
    'eventually initially originally recently previously currently presently somewhat rather ' +
    'increasingly significantly substantially considerably relatively highly extremely').split(/\s+/));

  const IRREG = new Set(('be was were been am is are being have had has do did done does go went gone ' +
    'make made take took taken give gave given get got gotten see saw seen say said know knew known ' +
    'think thought come came become became begin began begun find found tell told show showed ' +
    'shown leave left feel felt put keep kept let bring brought buy bought build built ' +
    'send sent spend spent grow grew grown hold held stand stood understand understood write wrote ' +
    'written read run ran sit sat speak spoke spoken pay paid meet met lead led ' +
    'lie lain lose lost fall fell fallen rise rose risen win won draw drew drawn ' +
    'break broke broken choose chose chosen drive drove driven eat ate eaten forget forgot forgotten ' +
    'hear heard hide hid hidden hit hurt lay laid mean meant prove proved proven ride rode ridden ' +
    'seek sought sell sold shake shook shaken shoot shot sleep slept slide slid throw threw thrown ' +
    'wake woke woken wear wore worn beat beaten bend bent bind bound bite bit bitten blow blew blown ' +
    'catch caught deal dealt dig dug fight fought fly flew flown forbid forbade forbidden ' +
    'freeze froze frozen hang hung lend lent shut sink sank sunk spread spread steal stole stolen ' +
    'stick stuck strike struck swear swore sworn sweep swept swing swung tear tore torn ' +
    'arise arose arisen bear bore borne breed bred cling clung creep crept deal dealt ' +
    'flee fled fling flung forbid forecast foresee foresaw foreseen grind ground kneel knelt know ' +
    'lay led leap leapt lend light lit mistake mistook mistaken overcome overcame overtake overtook ' +
    'overtaken prove quit quit rid rid saw sawed sawn seek sew sewed sewn shave shaved shaven ' +
    'shed shed shine shone shoe shod shrink shrank shrunk slay slew slain sow sowed sown speed sped ' +
    'spell spelt spill spilt spin spun spit spat split split spoil spoilt spring sprang sprung ' +
    'stink stank stunk strive strove striven swell swelled swollen swim swam swum swing swung ' +
    'teach taught tear tore torn throw threw thrown tread trod trodden undergo underwent undergone ' +
    'undertake undertook undertaken wake waken weave wove woven weep wept wet wet win won wind wound ' +
    'withdraw withdrew withdrawn withstand withstood wring wrung write wrote written').split(/\s+/));

  const BASE_VERBS = new Set(('accept achieve acquire adapt add address adjust admit adopt advance affect ' +
    'agree aim allow alter analyse analyze answer appear apply argue arrange arrive assess assume ' +
    'attach attempt attend attract avoid base believe belong benefit call care carry cause change ' +
    'charge check cite claim classify close collect combine compare compete complain complete compose ' +
    'concentrate conclude conduct confirm connect consider consist constitute construct consume contain ' +
    'continue contribute control convert convince cover create criticise criticize decide declare ' +
    'decline define deliver demand demonstrate deny depend derive describe deserve design destroy detect ' +
    'determine develop differ direct discover discuss display distinguish distribute divide dominate ' +
    'doubt drop earn emphasize employ enable encourage engage enjoy ensure enter establish estimate ' +
    'evaluate examine exceed exist expand expect experience explain explore express extend fail favor ' +
    'favour fear fill finish fit fix focus follow force form function gain generate govern grant ' +
    'guarantee guess guide handle happen help highlight hope identify ignore illustrate imagine imply ' +
    'impose improve include incorporate increase indicate influence inform insist inspire install ' +
    'intend interpret introduce investigate involve join judge justify lack land last launch learn ' +
    'limit link live locate look lose maintain manage mark matter measure mention mind move name need ' +
    'note notice obtain occur offer open operate oppose organize organise overcome own participate ' +
    'perform permit persuade place plan point possess prefer prepare present preserve prevent produce ' +
    'promote propose protect provide publish pull pursue push raise reach react realize realise ' +
    'recall receive recognize recognise recommend record reduce refer reflect refuse regard register ' +
    'reject relate release rely remain remember remind remove render repeat replace reply report ' +
    'represent require rescue resemble resist resolve respond restore restrict result retain return ' +
    'reveal review revise reward ride rise risk satisfy save seek seem select sell serve set settle ' +
    'share shift show sign sit solve sound speak specify spend stand start state stay step stop store ' +
    'stress strike study submit succeed suffer suggest supply support suppose survive suspect sustain ' +
    'switch teach tend test thank threaten train transfer transform treat trust try turn undergo ' +
    'understand undertake unite urge use vary view visit want warn wash watch work worry write yield ' +
    'abandon absorb accompany accuse acknowledge admire advise afford announce anticipate appeal ' +
    'approve assemble assert assure attribute await awaken beg behave blame boast boost border ' +
    'bother bounce breed calculate capture cast celebrate challenge chase cheer clarify collapse ' +
    'comment commit communicate compensate compile compromise conceal concede conceive concern condemn ' +
    'confess confine confront confuse congratulate conquer consent consult contradict convey cope ' +
    'correspond count crash crawl cross crush cure damage dare date deal debate decay ' +
    'deceive decorate dedicate defeat defend defer delay delete delight depart depict ' +
    'deposit deprive descend desire despair devote dictate dig diminish dip ' +
    'disagree disappear disappoint discipline disclose discourage dismiss dispose dispute dissolve ' +
    'distort distract disturb dive document drag drain draw dream dress drift drown dry dump dwell dye ' +
    'ease echo edit educate elect eliminate embrace emerge emit employ empty endure enforce enhance ' +
    'enquire enrich enroll entertain entitle envy equip erect erupt escape evacuate evolve exaggerate ' +
    'exchange excite exclude excuse execute exhaust exhibit exile expel expend ' +
    'experiment expire explode exploit expose extract fade fancy fasten fetch figure finance ' +
    'fire flee float flood flow fold forbid forecast foresee formalize foster found freeze frighten ' +
    'frustrate fulfil fulfill gather gaze glance graduate grasp greet grieve grin grip groan ' +
    'hail halt hand hang harm harvest hate haunt head heal heap heat hesitate hire ' +
    'hollow honour hook host hug hunt hurry hurt imitate immerse implement import impress imprison ' +
    'incline induce infect infer inflate inherit inhibit inject injure innovate inquire insert ' +
    'instruct insult insure integrate interact interfere interrupt intervene interview invade invent ' +
    'invest invite invoke joke journey jump kick kill kiss kneel knit knock label laugh ' +
    'lay lean leap lecture lend level licence license lick lift light like limit linger list load loan ' +
    'lock look loosen lower magnify mail march marry match measure melt mend ' +
    'merge migrate miss mix modify monitor motivate mount mourn murmur nail narrow ' +
    'listen lengthen lighten loosen tend outperform underperform outweigh pose prone ' +
    'neglect negotiate nod nominate normalise normalize nourish nurse obey object oblige ' +
    'observe obstruct occupy offend offset omit optimize order organize organise ' +
    'originate outline overlook owe pace pack paint pardon park part pass paste pause pay ' +
    'peel perceive persist phone pick picture plant please plot plunge polish ' +
    'pollute ponder possess post postpone pour practise pray preach precede predict prescribe ' +
    'press presume pretend prevail proceed process proclaim profit prohibit ' +
    'project prolong promise pronounce prosecute protest provoke pump punch punish purchase qualify ' +
    'quantify quarrel question quote race rain range rank rate read rebuild recede reckon recognize ' +
    'reconcile recover recruit recycle reform refrain refresh rehearse reign reinforce rejoice relax ' +
    'relieve remark remedy renew rent repair reproduce request research resent reserve reside resign ' +
    'resort respect rest restrain resume retire retreat reverse revive ring rip roam roar rob roll rot ' +
    'rub ruin rule rush sacrifice sail satisfy scan scare scatter schedule scold score scratch scream ' +
    'screen seal search secure seize sew shake shape sharpen shelter shine ' +
    'shiver shock shop shout shrink shrug sigh sight signal simplify sin sink ski skip slam slap ' +
    'slip slow smash smell smile smoke snap soak sort sow spare spark speculate spell ' +
    'spill spin spit split spoil sponsor spot spray spring squeeze stab stain stamp stare ' +
    'starve steer stem stick stimulate stir stitch straighten ' +
    'strangle stretch strip strip struggle stumble substitute subtract suck ' +
    'suit suppress surpass surrender surround survey suspend swallow swap swell swim swing sympathize ' +
    'tackle tag talk tap taste tear telephone tempt tend terminate thrive tie tighten tolerate touch ' +
    'tour trace track trade translate transport trap travel tremble trick trim trip triumph tuck tune ' +
    'twist type underline undermine undo unfold unlock unpack update upgrade uphold upset utilize ' +
    'utter value vanish venture verify vibrate violate volunteer vote wait walk wander warm waste wave ' +
    'weaken weep weigh welcome whip whisper widen wind wipe wish withdraw witness wonder wrap wreck ' +
    'yell zoom').split(/\s+/));

  // ================= 词性判断 =================
  // 名词后缀优先：development / government / environment / difference 别被 -ent 骗了
  const NOUN_SUFFIX = /(ment|ness|tion|sion|ity|ism|ance|ence|ship|hood|dom|age|ure|ist|logy|graphy|tude|sure|sion)$/i;
  const ADJ_SUFFIX = /(ous|ful|able|ible|ive|less|ish|ical|ular|ial|ean|ese|ary|ant|ent|al|ic)$/i;

  function stemSet(w) {
    const lw = w.toLowerCase();
    const out = new Set([lw]);
    let m;
    if ((m = lw.match(/^([a-z]+?)(ied)$/))) { out.add(m[1] + 'y'); }
    if ((m = lw.match(/^([a-z]+?)(ed)$/))) {
      out.add(m[1]); out.add(m[1] + 'e');
      const d = m[1].match(/^(.*?)([bdgklmnprstvz])\2$/); if (d) out.add(d[1] + d[2]);
    }
    if ((m = lw.match(/^([a-z]+?)(ing)$/))) {
      out.add(m[1]); out.add(m[1] + 'e');
      const d = m[1].match(/^(.*?)([bdgklmnprstvz])\2$/); if (d) out.add(d[1] + d[2]);
    }
    if ((m = lw.match(/^([a-z]+?)(ies)$/))) { out.add(m[1] + 'y'); out.add(m[1]); }
    if ((m = lw.match(/^([a-z]+?)(es)$/))) { out.add(m[1]); out.add(m[1] + 'e'); }
    if ((m = lw.match(/^([a-z]+?)(s)$/))) { out.add(m[1]); out.add(m[1] + 'e'); }
    return out;
  }

  function inLex(set, w) {
    if (set.has(w)) return true;
    for (const c of stemSet(w)) if (set.has(c)) return true;
    return false;
  }

  function isAdj(w) {
    const lw = w.toLowerCase();
    if (ADJ_COMMON.has(lw)) return true;
    if (NOUN_SUFFIX.test(lw)) return false;      // 名词后缀优先
    if (ADJ_SUFFIX.test(lw) && lw.length > 4) return true;
    return false;
  }

  function isAdv(w) {
    const lw = w.toLowerCase();
    if (ADV_COMMON.has(lw)) return true;
    if (/ly$/.test(lw) && lw.length > 4 && !/^(only|early|family|reply|apply|supply|rely|fly|ally)$/.test(lw)) return true;
    return false;
  }

  // 明确的名词性后缀（development / government / pressure）
  function isNounish(w) {
    const lw = w.toLowerCase();
    if (NOUN_SUFFIX.test(lw)) return true;
    if (/(tion|sion|ment|ness|ity|ance|ence|ship|hood|ism|ist|ogy)$/.test(lw) && lw.length > 5) return true;
    return false;
  }

  function isVerb(w) {
    const lw = w.toLowerCase();
    if (AUX.has(lw)) return true;
    if (IRREG.has(lw) || BASE_VERBS.has(lw)) return true;
    for (const c of stemSet(w)) if (IRREG.has(c) || BASE_VERBS.has(c)) return true;
    if (isAdj(w)) return false;
    if (/ed$/.test(lw) && lw.length > 3) return true;
    if (/ing$/.test(lw) && lw.length > 4) return true;
    return false;
  }

  // ================= 分词 =================
  function tokenize(text) {
    const toks = [];
    const re = /[A-Za-z][A-Za-z'\u2019\-]*|\d+(?:[:.,]\d+)*[A-Za-z]*|[^\s]|\s+/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const raw = m[0];
      const t = { text: raw, start: m.index, end: m.index + raw.length };
      if (/^\s+$/.test(raw)) t.ws = true;
      else t.cat = /^[^\w]$/.test(raw) || /^["'“”‘’()\[\]{},.;:!?—–\-…\/]$/.test(raw) ? 'punct' : 'word';
      toks.push(t);
      if (m.index + raw.length >= text.length) break;
    }
    return toks;
  }

  const isOpen = t => t && t.cat === 'punct' && /^[(\[{]$/.test(t.text);
  const isClose = t => t && t.cat === 'punct' && /^[)\]}]$/.test(t.text);
  const isHardEnd = t => t && t.cat === 'punct' && /^[.!?;:]$/.test(t.text);
  const isComma = t => t && t.cat === 'punct' && /^[,\u2014\u2013]$/.test(t.text);
  const isQuote = t => t && t.cat === 'punct' && /^["'\u201c\u201d\u2018\u2019]$/.test(t.text);

  // ===== classify：分六个阶段，顺序不可换 =====
  // 阶段 1 词表初判 → 2 多词连词 → 3 上下文消歧 → 4 小句级主谓判定 → 5 分词/名词收尾
  function classify(toks) {
    const W = toks.filter(t => t.cat === 'word');
    const wn = new Map(W.map((t, i) => [t, i]));

    // ---------- 1) 词表初判 ----------
    for (const t of toks) {
      if (!t.cat) continue;
      if (t.cat === 'punct') { t.pos = 'punct'; continue; }
      const w = t.text, lw = w.toLowerCase();
      if (/^[\d\u4e00-\u9fa5]/.test(w)) { t.pos = 'num'; continue; }
      if (NUM_WORD.has(lw)) { t.pos = 'num'; continue; }
      if (MONTH.has(lw)) { t.pos = 'noun'; continue; }
      if (DET.has(lw)) { t.pos = 'det'; continue; }
      if (AUX.has(lw)) { t.pos = 'aux'; continue; }
      if (COORD.has(lw)) { t.pos = 'coord'; continue; }
      if (SUB.has(lw)) { t.pos = 'sub'; continue; }
      if (PREP.has(lw)) { t.pos = 'prep'; continue; }
      if (PRON.has(lw)) { t.pos = 'pron'; continue; }
      if (isAdv(w)) { t.pos = 'adv'; continue; }
      if (isNounish(w)) { t.pos = 'noun'; continue; }
      if (isVerb(w)) { t.pos = 'verb?' ; continue; }   // ? = 待定，阶段 4 再判
      if (isAdj(w)) { t.pos = 'adj'; continue; }
      t.pos = 'noun';
    }

    // ---------- 2) 多词连词 ----------
    const MULTI_SUB = [
      ['even', 'though'], ['even', 'if'], ['so', 'that'], ['such', 'that'],
      ['as', 'long', 'as'], ['as', 'soon', 'as'], ['as', 'far', 'as'], ['as', 'much', 'as'],
      ['as', 'well', 'as'], ['now', 'that'], ['in', 'case'], ['in', 'order', 'that'],
      ['provided', 'that'], ['given', 'that'], ['except', 'that'], ['the', 'moment'],
      ['by', 'the', 'time'], ['every', 'time'], ['each', 'time'], ['no', 'matter'],
      ['on', 'condition', 'that'], ['no', 'sooner', 'than'], ['rather', 'than'],
    ];
    for (let i = 0; i < W.length; i++) {
      for (const seq of MULTI_SUB) {
        let ok = true;
        for (let k = 0; k < seq.length; k++) {
          const w = W[i + k];
          if (!w || w.text.toLowerCase() !== seq[k]) { ok = false; break; }
        }
        if (!ok) continue;
        W[i].pos = 'sub'; W[i].multi = seq.length;
        for (let k = 1; k < seq.length; k++) { W[i + k].pos = 'sub'; W[i + k].subpart = true; }
        i += seq.length - 1;
        break;
      }
    }

    // ---------- 3) 上下文消歧 ----------
    for (let i = 0; i < W.length; i++) {
      const t = W[i], lw = t.text.toLowerCase();
      const prev = W[i - 1], next = W[i + 1];

      if (lw === 'to') {
        if (next && (next.pos === 'verb?' || next.pos === 'verb' || next.pos === 'aux')) {
          if (prev && (prev.pos === 'aux' || prev.pos === 'prep') && false) {}
          const nw = next.text.toLowerCase();
          const looksBase = !/(ed|ing)$/.test(nw);
          t.pos = looksBase ? 'nonfinite' : 'prep';
        } else t.pos = 'prep';
      } else if (lw === 'that') {
        if (!prev) t.pos = 'pron';
        else if (prev.pos === 'verb' || prev.pos === 'verb?' || prev.pos === 'aux' || prev.pos === 'nonfinite') t.pos = 'sub';
        else if (prev.text === ',') t.pos = 'sub';
        else if (next && (next.pos === 'aux' || next.pos === 'verb?' || next.pos === 'verb') &&
                 prev.pos === 'noun') t.pos = 'sub';
        else if (next && (next.pos === 'noun' || next.pos === 'det' || next.pos === 'adj' || next.pos === 'num')) t.pos = 'det';
        else t.pos = 'sub';
      } else if (lw === 'as') {
        const n2 = next ? next.text.toLowerCase() : '';
        if (['well', 'if', 'though', 'long', 'soon', 'much', 'far'].includes(n2)) t.pos = 'sub';
        else if (next && /^(noun|pron|det|num)$/.test(next.pos) && verbAhead(W, i, 6)) t.pos = 'sub';
        else t.pos = 'prep';
      } else if (lw === 'than' || lw === 'like') {
        if (next && /^(noun|pron|det|num)$/.test(next.pos) && verbAhead(W, i, 5)) t.pos = 'sub';
        else t.pos = 'prep';
      } else if (['since', 'before', 'after', 'until', 'till', 'once'].includes(lw)) {
        if (next && /^(noun|pron|det|num)$/.test(next.pos) && verbAhead(W, i, 6)) t.pos = 'sub';
        else t.pos = 'prep';
      } else if (lw === 'for') {
        if (next && next.pos === 'pron' && verbAhead(W, i, 4)) t.pos = 'sub';
        else t.pos = 'prep';
      } else if (lw === 'but' || lw === 'yet') {
        t.pos = 'coord';
      } else if (lw === 'while' || lw === 'whilst' || lw === 'whereas') {
        t.pos = 'sub';
      }
    }

    // 3.2) 冠词/介词/形容词/数词之后的 verb? 一定是名词（this matter / a report / of study）
    for (let i = 1; i < W.length; i++) {
      const t = W[i], p = W[i - 1];
      if (t.pos !== 'verb?') continue;
      if (/^(det|prep|adj|num|pron)$/.test(p.pos)) t.pos = 'noun';
    }

    // ---------- 3.5) out/up 等小品词 ----------
    const PARTICLE = new Set('out up down off away back through along around about across by apart aside forth together home abroad over under'.split(' '));
    for (let i = 1; i < W.length; i++) {
      const t = W[i], prev = W[i - 1], next = W[i + 1];
      if (t.pos !== 'prep' || !PARTICLE.has(t.text.toLowerCase())) continue;
      const pv = prev && /(verb\?|verb|aux|nonfinite)/.test(prev.pos);
      if (!pv) continue;
      if (!next || /^(prep|nonfinite|adv|punct)$/.test(next.pos)) { t.pos = 'adv'; continue; }
      if (next.pos === 'num') { t.pos = 'adv'; continue; }
    }

    // ---------- 4) 小句级主谓判定（核心） ----------
    // 按 [,.;:!?——] 和 sub/coord 切小句；每个小句里第一个"实物"当主语，
    // 主语之后第一个 verb?/aux 当限定谓语，其余的 verb? 交给阶段 5
    markPredicates(toks, W);

    // ---------- 5) 分词 / 名词收尾 ----------
    for (let i = 0; i < W.length; i++) {
      const t = W[i], lw = t.text.toLowerCase();
      const prev = W[i - 1], next = W[i + 1];
      if (t.pos !== 'verb?' && t.pos !== 'verb') {
        if (t.pos === 'verb?') t.pos = 'verb';
        continue;
      }
      const prevAux = prev && prev.pos === 'aux';

      // Having done / Being asked
      if ((lw === 'having' || lw === 'being') && next && /ed$|ing$/.test(next.text.toLowerCase())) {
        t.pos = 'nonfinite'; t.nf = lw === 'having' ? 'perfect' : 'ing'; continue;
      }

      if (t.isPred) { t.pos = 'verb'; continue; }        // 已认定为谓语

      if (/ing$/.test(lw) && lw.length > 4) {
        if (prevAux) { t.pos = 'verb'; continue; }   // have been rising / is studying
        if (prev && /^(det|prep|adj|pron|num)$/.test(prev.pos)) { t.pos = 'noun'; continue; }
        if (!prev) { t.pos = 'noun'; continue; }
        if (next && /^(aux|det)$/.test(next.pos)) { t.pos = 'noun'; continue; }
        t.pos = 'nonfinite'; t.nf = 'ing'; continue;
      }

      if (prevAux) { t.pos = 'verb'; continue; }         // has been trapped

      if (/ed$/.test(lw) && lw.length > 3) {
        if (prev && /^(det|adv)$/.test(prev.pos)) { t.pos = 'adj'; continue; }
        if (prev && /^(noun|pron|num)$/.test(prev.pos)) { t.pos = 'nonfinite'; t.nf = 'ed'; continue; }
        if (prev && prev.text === ',') { t.pos = 'nonfinite'; t.nf = 'ed'; continue; }
        if (!prev) { t.pos = 'adj'; continue; }
        t.pos = 'verb'; continue;
      }

      // 其余 verb? 在句首或紧跟冠词后 → 名词
      if (!prev || (prev && prev.pos === 'det')) { t.pos = 'noun'; continue; }
      t.pos = 'verb';
    }

    // ---------- 6) that 后接谓动修正 ----------
    for (let i = 0; i < W.length; i++) {
      const t = W[i];
      if (t.text.toLowerCase() === 'that' && t.pos === 'det') {
        const nx = W[i + 1];
        if (nx && /^(verb|aux|verb\?)$/.test(nx.pos)) t.pos = 'sub';
      }
    }
    return toks;
  }

  // i 之后 n 个实词内是否有谓语候选
  function verbAhead(W, i, n) {
    for (let k = i + 1; k < Math.min(W.length, i + 1 + n); k++) {
      const w = W[k];
      if (w.pos === 'sub' || w.pos === 'coord') return false;
      if (w.pos === 'aux' || w.pos === 'verb' || w.pos === 'verb?') return true;
    }
    return false;
  }

  // 小句级主谓标注
  function markPredicates(toks, W) {
    // 先标出介词短语覆盖范围：介词后到它的头名词结束，这段里的词不参与主谓判定
    const inPP = new Set();
    for (let i = 0; i < W.length; i++) {
      if (W[i].pos !== 'prep') continue;
      const end = prepEndFrom(toks, toks.indexOf(W[i]));
      if (end < 0) continue;
      const endTok = toks[end];
      for (let k = i; k < W.length; k++) {
        inPP.add(W[k]);
        if (W[k] === endTok) break;
      }
    }

    // 按标点与关系词切段
    const segs = [];
    let cur = [];
    for (const t of toks) {
      if (t.cat === 'punct' && /^[,.;:!?\u2014\u2013\u002d]$/.test(t.text)) {
        if (cur.length) { segs.push(cur); cur = []; }
        continue;
      }
      if (t.cat !== 'word') continue;
      if (inPP.has(t)) { cur.push(t); continue; }   // 介词短语内部的词，保留但标记
      if ((t.pos === 'sub' && !t.subpart) || t.pos === 'coord') {
        if (cur.length) { segs.push(cur); cur = []; }
        cur.push(t);
        continue;
      }
      cur.push(t);
    }
    if (cur.length) segs.push(cur);

    for (const seg of segs) {
      let k = 0;
      if (seg[0] && (seg[0].pos === 'sub' || seg[0].pos === 'coord')) k = 1;
      let subjectSeen = false, predSeen = false;

      for (; k < seg.length; k++) {
        const w = seg[k];
        if (w.subpart) continue;
        if (inPP.has(w)) continue;              // 介词短语内部不判主谓

        if (!subjectSeen) {
          if (w.pos === 'noun' || w.pos === 'pron' || w.pos === 'num' || w.pos === 'det') {
            subjectSeen = true;
            continue;
          }
          if (w.pos === 'adv' || w.pos === 'prep') continue;
          if (w.pos === 'nonfinite' || w.pos === 'adj') { subjectSeen = true; continue; }
          if (w.pos === 'aux' || w.pos === 'verb' || w.pos === 'verb?') {
            const p = seg[k - 1];
            if (p && /^(det|prep|adj|num|pron)$/.test(p.pos)) {
              w.pos = 'noun';
              subjectSeen = true;
              continue;
            }
            const n1 = seg[k + 1];
            if (n1 && /^(noun|det|num|adj)$/.test(n1.pos)) {
              subjectSeen = true;
              continue;
            }
            w.isPred = true; predSeen = true; subjectSeen = true;
            continue;
          }
          continue;
        }

        if (predSeen) {
          if (w.pos === 'aux') w.isPred = false;
          continue;
        }

        if (w.pos === 'adv') continue;
        if (w.pos === 'aux' || w.pos === 'verb' || w.pos === 'verb?') {
          w.isPred = true;
          predSeen = true;
          continue;
        }
      }
    }
  }


  // ================= 句子切分 =================
  function splitSentences(text) {
    const out = [];
    let start = 0;
    const re = /([.!?]+)(["'\u201d\u2019)\]]*)(\s+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const end = m.index + m[1].length + m[2].length;
      const rest = text.slice(end);
      const trimmed = rest.replace(/^\s+/, '');
      if (!trimmed) break;
      const skip = rest.length - trimmed.length;
      const first = trimmed[0];
      const isAbbrev = /(?:^|\s)(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e|Fig|No|Inc|Ltd|U\.S|U\.K)\.$/i.test(text.slice(start, end));
      if (/[A-Z0-9"'“‘(\[]/.test(first) && !isAbbrev) {
        out.push([start, end]);
        start = end + skip;
      }
    }
    out.push([start, text.length]);
    return out.filter(([s, e]) => text.slice(s, e).trim().length > 0);
  }

  // ================= 短语边界预扫描 =================
  const HEADY = new Set(['det', 'adj', 'adv', 'num', 'noun', 'pron']);

  function prepEnd(toks, i) {
    let j = i + 1, lastNoun = -1, budget = 10, sawNoun = false;
    while (j < toks.length && budget-- > 0) {
      const t = toks[j];
      if (t.ws) { j++; continue; }
      if (isQuote(t)) { j++; continue; }
      if (t.cat !== 'word') break;
      if (t.pos === 'det' || t.pos === 'adv') {
        if (sawNoun) break;
        j++; continue;
      }
      if (t.pos === 'adj') {
        if (sawNoun) break;
        // between rich and poor / for the rich / among the poor
        // 形容词本身可以充当介词的宾语（名词化的形容词）
        const nx = nextWordAt(toks, j);
        if (!nx || !/^(noun|adj|num)$/.test(nx.pos) || nx.pos === 'adj') {
          lastNoun = j; sawNoun = true; j++; continue;
        }
        j++; continue;
      }
      if (t.pos === 'num') {
        if (sawNoun) break;
        lastNoun = j; j++; continue;  // from 2:00 / for three weeks
      }
      if (t.pos === 'noun' || t.pos === 'pron') {
        lastNoun = j; sawNoun = true; j++;
        // between rich and poor / in Asia and Africa：同名并列项并入本短语
        continue;
      }
      // and/or + 名词性成分：只有「当前头词是名词/形容词」时才并入并列项
      // （避免把 have been rising 的 rising、working 之类吞掉）
      if (t.pos === 'coord' && sawNoun && lastNoun >= 0) {
        const lastTok = toks[lastNoun];
        const lastIsNominal = lastTok && (lastTok.pos === 'noun' || lastTok.pos === 'adj' || lastTok.pos === 'pron');
        const nx = nextWordAt(toks, j);
        if (lastIsNominal && nx && (nx.pos === 'noun' || nx.pos === 'adj' || nx.pos === 'pron')) {
          // 并列项后面不能紧跟谓语（that X and Y has widened 里 Y 是名词）
          lastNoun = toks.indexOf(nx); j = toks.indexOf(nx) + 1; continue;
        }
        break;
      }
      // have been rising / is working：aux 之后的 -ing 是动词，不是介词宾语
      if (t.pos === 'nonfinite' && !sawNoun) {
        const prevT = prevWordAt(toks, j);
        if (prevT && (prevT.pos === 'aux' || prevT.pos === 'verb')) break;
        lastNoun = j; sawNoun = true; j++; continue;
      }
      if (t.pos === 'aux' || t.pos === 'verb' || t.pos === 'verb?') {
        if (lastNoun >= 0) break;    // of being able → 头在 being
        j++; continue;
      }
      break;
    }
    return lastNoun;
  }

  // 供 markPredicates 用：与 prepEnd 相同逻辑，但接受任意 token 下标
  function prepEndFrom(toks, i) {
    return prepEnd(toks, i);
  }

  // 从 token 下标 i 之前找上一个实词
  function prevWordAt(toks, i) {
    for (let k = i - 1; k >= 0; k--) {
      if (toks[k].cat === 'word') return toks[k];
    }
    return null;
  }

  // 从 token 下标 i 之后找下一个实词
  function nextWordAt(toks, i) {
    for (let k = i + 1; k < toks.length; k++) {
      if (toks[k].cat === 'word') return toks[k];
    }
    return null;
  }

  // ================= 树构建 =================
  function buildTree(toks) {
    const rootNode = { type: 'root', children: [] };
    const stack = [rootNode];
    const top = () => stack[stack.length - 1];
    const W = toks.filter(t => t.cat === 'word');
    const widx = new Map(W.map((t, i) => [t, i]));

    function pushText(t) {
      const p = top();
      const last = p.children[p.children.length - 1];
      if (last && last.type === 'text') last.text += t.text;
      else p.children.push({ type: 'text', text: t.text });
    }

    function open(type, conf, endIdx) {
      const n = { type, children: [], conf, endIdx: endIdx == null ? -1 : endIdx, verbs: 0, headVerbSeen: false };
      top().children.push(n);
      stack.push(n);
      return n;
    }
    function close() { if (stack.length > 1) stack.pop(); }

    // 从 token 下标 i 往后找第一个实词 token
    function nextWordToken(i) {
      for (let k = i + 1; k < toks.length; k++) {
        const t = toks[k];
        if (t.cat === 'word') return t;
      }
      return null;
    }
    // 从 i 往后 n 个实词内是否出现限定谓动
    function finiteVerbAhead(i, n) {
      let cnt = 0;
      for (let k = i + 1; k < toks.length && cnt < n; k++) {
        const t = toks[k];
        if (t.cat !== 'word') {
          if (t.cat === 'punct' && /^[.;!?]$/.test(t.text)) return false;
          continue;
        }
        cnt++;
        if (t.pos === 'aux' || t.pos === 'verb') return true;
        if (t.pos === 'sub') return false;
      }
      return false;
    }

    // 是否为“谓动组的开头”：aux 开头的 aux 链算起点；adv 夹在 aux 后仍属同组
    function startsVerbGroup(i) {
      const t = W[i];
      if (!t || (t.pos !== 'verb' && t.pos !== 'aux')) return false;
      let k = i - 1;
      // 跳过副词（does not act / has already gone）
      while (k >= 0 && W[k] && W[k].pos === 'adv') k--;
      const p = W[k];
      if (!p) return true;
      if (p.pos === 'aux') return false;
      if (p.pos === 'verb') return false;
      if (p.pos === 'nonfinite') return false;   // To improve / having done
      return true;
    }

    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];

      if (!t.ws) {
        // ---- 关闭判定 ----
        while (stack.length > 1) {
          const n = top();
          if (n.type === 'pp') {
            if (n.endIdx >= 0 && i > n.endIdx) { close(); continue; }
            // 未找到头名词的介词短语：只括介词本身
            if (n.endIdx < 0 && i > n._prepIdx) { close(); continue; }
            if (isHardEnd(t) || isComma(t) || isOpen(t) || isClose(t)) { close(); continue; }
            break;
          }
          // clause / nonfinite
          if (isHardEnd(t) || isClose(t) || isOpen(t)) { close(); continue; }
          // 逗号是否真的终止从句，要看逗号后面接什么：
          //   后接关系词/从属连词/非谓语 → 这是插入的修饰成分，从句继续
          //   后接谓动               → 插入语结束，从句到头了
          //   后接新主语(det/pron/noun) → 从句到头了
          if (isComma(t)) {
            const hasContent = n.children.some(c => c.type === 'text' && c.text.trim());
            if (!hasContent) break;
            const after = nextWordToken(i);
            if (!after) { close(); break; }
            if (after.pos === 'sub' || after.pos === 'nonfinite' || after.pos === 'coord') break;
            if (after.pos === 'verb' || after.pos === 'aux') { close(); break; }
            if (after.pos === 'det' || after.pos === 'pron' || after.pos === 'noun' || after.pos === 'num') {
              if (finiteVerbAhead(i, 7)) { close(); break; }
              break;
            }
            if (after.pos === 'prep' || after.pos === 'adv') break;
            break;
          }
          if (isQuote(t)) break;
          if (t.pos === 'coord') {
            const w = widx.get(t);
            const nx = W[w + 1];
            if (!nx) break;
            // and which… / and having… → 并列的新成分
            if (nx.pos === 'sub' || nx.pos === 'nonfinite') { close(); continue; }
            // and + 谓语 → 并列谓语，回主句（She ... rose and applauded）
            if (nx.pos === 'verb' || nx.pos === 'aux') { close(); continue; }
            if (n.type === 'nonfinite') { close(); continue; }
            break;
          }
          if (widx.has(t) && startsVerbGroup(widx.get(t))) {
            if (n.type === 'nonfinite') { close(); continue; }
            if (n.verbs >= 1) { close(); continue; }
            break;
          }
          break;
        }
      }

      // ---- 计数 ----
      if (t.cat === 'word' && widx.has(t)) {
        const wi = widx.get(t);
        if (startsVerbGroup(wi)) {
          const n = top();
          if (n.type === 'clause') n.verbs += 1;
          else if (n.type === 'nonfinite' && !n.headVerbSeen) { n.verbs = 1; n.headVerbSeen = true; }
        }
      }

      // ---- 打开判定 ----
      let opened = false;
      if (t.cat === 'word') {
        if (t.pos === 'prep') {
          const pe = prepEnd(toks, i);
          const hasContent = pe >= 0;
          open('pp', hasContent ? 0.95 : 0.5, pe);
          top()._prepIdx = i;
          opened = true;
        } else if (t.pos === 'sub') {
          open('clause', 0.9);
          opened = true;
        } else if (t.pos === 'nonfinite') {
          open('nonfinite', 0.8);
          top().headVerbSeen = true;
          top().verbs = 1;
          opened = true;
        }
      }

      pushText(t);
    }
    while (stack.length > 1) close();
    return rootNode;
  }

  // ================= 并列标记 =================
  function coordMarks(toks) {
    const W = toks.filter(t => t.cat === 'word');
    const marks = [];
    for (let i = 0; i < W.length; i++) {
      const t = W[i];
      if (t.pos !== 'coord') continue;
      marks.push({ start: t.start, end: t.end, kind: 'conj' });
      let L = i - 1;
      while (L >= 0 && W[L].pos !== 'punct') L--;
      L++;
      let R = i + 1;
      while (R < W.length && W[R].pos !== 'punct') R++;
      R--;
      if (L <= i - 1) marks.push({ start: W[L].start, end: W[i - 1].end, kind: 'item' });
      if (R >= i + 1) marks.push({ start: W[i + 1].start, end: W[R].end, kind: 'item' });
    }
    return marks;
  }

  // ================= 主页 =================
  const GAP = '\u0000';
  function coreText(node) {
    // 用 GAP 标记被括走的成分，便于判断并列词是否该丢
    let s = '';
    for (const c of node.children) {
      if (c.type === 'text') s += c.text;
      else s += GAP;
    }
    s = s
      .replace(/[\s,;:—–]+/g, ' ')
      .replace(new RegExp('\\s*' + GAP + '\\s*', 'g'), GAP)
      // 并列词紧邻被括成分 → 属于并列结构装饰，丢弃
      .replace(new RegExp(GAP + ' ?(and|or|but|nor)\\b', 'gi'), GAP)
      .replace(new RegExp('\\b(and|or|but|nor) ?' + GAP, 'gi'), GAP)
      .replace(new RegExp(GAP, 'g'), ' ')
      .replace(/^(and|or|but|nor)\s+/i, '')
      .replace(/\s+(and|or|but|nor)$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    return s;
  }

  function annotate(text) {
    const sentences = [];
    let marks = [];
    const ranges = splitSentences(text);
    for (const [s, e] of ranges) {
      const raw = text.slice(s, e);
      const toks = tokenize(raw);
      classify(toks);
      toks.forEach(t => { t.start += s; t.end += s; });
      const tree = buildTree(toks);
      marks = marks.concat(coordMarks(toks));
      sentences.push({ start: s, end: e, text: raw, tree, core: coreText(tree) });
    }
    return { sentences, coordMarks: marks };
  }

  const api = { annotate, tokenize, classify, buildTree, splitSentences, coreText };
  root.BracketEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);


(function () {
  'use strict';

  // ==================== 配置 ====================
  const CFG_KEY = 'bracketReader.config';
  const SITE_KEY = 'bracketReader.sites';
  const CACHE_KEY = 'bracketReader.cache';

  const DEFAULTS = {
    apiUrl: 'http://127.0.0.1:3425/v1',
    apiKey: '',
    model: 'group/deepseek-free',
    mode: 'rules',            // rules | ai
    noThinking: true,         // 关思考，快很多
    autoSite: false,          // 本网站是否自动标注
    markCore: true,           // 高亮主干
  };

  function gmGet(k, d) {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(k, d);
      const v = localStorage.getItem(k);
      return v == null ? d : v;
    } catch (e) { return d; }
  }
  function gmSet(k, v) {
    try {
      if (typeof GM_setValue === 'function') GM_setValue(k, v);
      else localStorage.setItem(k, v);
    } catch (e) { /* ignore */ }
  }

  function getCfg() {
    const raw = gmGet(CFG_KEY, '');
    let o = {};
    try { o = raw ? JSON.parse(raw) : {}; } catch (e) { o = {}; }
    return Object.assign({}, DEFAULTS, o);
  }
  function setCfg(patch) {
    const c = Object.assign(getCfg(), patch);
    gmSet(CFG_KEY, JSON.stringify(c));
    return c;
  }

  // 每个网站独立开关
  function hostKey() { return location.hostname || 'local'; }
  function siteEnabled() {
    const raw = gmGet(SITE_KEY, '');
    let m = {};
    try { m = raw ? JSON.parse(raw) : {}; } catch (e) { m = {}; }
    return !!m[hostKey()];
  }
  function setSiteEnabled(on) {
    const raw = gmGet(SITE_KEY, '');
    let m = {};
    try { m = raw ? JSON.parse(raw) : {}; } catch (e) { m = {}; }
    if (on) m[hostKey()] = 1; else delete m[hostKey()];
    gmSet(SITE_KEY, JSON.stringify(m));
  }

  // 句子级缓存，避免重复请求
  let cache = {};
  try { cache = JSON.parse(gmGet(CACHE_KEY, '') || '{}'); } catch (e) { cache = {}; }
  let cacheDirty = false;
  function cacheGet(s) { return cache[hash(s)]; }
  function cacheSet(s, v) {
    cache[hash(s)] = v; cacheDirty = true;
    if (!cacheTimer) cacheTimer = setTimeout(flushCache, 3000);
  }
  let cacheTimer = null;
  function flushCache() {
    cacheTimer = null;
    if (!cacheDirty) return;
    cacheDirty = false;
    // 限制缓存条数
    const keys = Object.keys(cache);
    if (keys.length > 3000) {
      const keep = {};
      for (const k of keys.slice(-2000)) keep[k] = cache[k];
      cache = keep;
    }
    gmSet(CACHE_KEY, JSON.stringify(cache));
  }
  function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  // ==================== 配色 ====================
  const COLORS = { pp: '#d97706', clause: '#2563eb', nonfinite: '#7c3aed' };
  const BRACKETS = { pp: ['(', ')'], clause: ['[', ']'], nonfinite: ['\u2039', '\u203a'] };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  // ==================== 渲染 ====================
  // 规则引擎的树 → HTML
  function treeToHtml(node) {
    let out = '';
    for (const c of node.children) {
      if (c.type === 'text') { out += esc(c.text); continue; }
      const col = COLORS[c.type] || '#888';
      const [op, cl] = BRACKETS[c.type] || ['(', ')'];
      const low = c.conf != null && c.conf < 0.7 ? ' data-lowconf="1"' : '';
      out += `<span class="br-mod" data-k="${c.type}" style="--c:${col}"${low}>` +
             `<span class="br-br">${op}</span>` + treeToHtml(c) + `<span class="br-br">${cl}</span>` +
             `</span>`;
    }
    return out;
  }

  // LLM 的嵌套数组 → HTML + 主干
  function llmToHtml(node, opts) {
    opts = opts || {};
    let html = '', core = '';
    if (!Array.isArray(node)) return { html: esc(String(node)), core: String(node) };
    for (const item of node) {
      if (!Array.isArray(item) || item.length < 2) {
        const s = Array.isArray(item) ? String(item[0] == null ? '' : item[0]) : String(item == null ? '' : item);
        html += esc(s); core += s; continue;
      }
      const kind = item[0], body = item[1];
      if (kind === 't') {
        const t = typeof body === 'string' ? body : String(body == null ? '' : body);
        html += esc(t); core += t; continue;
      }
      if (COLORS[kind]) {
        const inner = llmToHtml(body, opts);
        const [op, cl] = BRACKETS[kind];
        html += `<span class="br-mod" data-k="${kind}" style="--c:${COLORS[kind]}">` +
                `<span class="br-br">${op}</span>${inner.html}<span class="br-br">${cl}</span>` +
                `</span>`;
        continue;
      }
      const inner = llmToHtml(body, opts);
      html += inner.html; core += inner.core;
    }
    return { html, core };
  }

  function llmPlain(node) {
    if (typeof node === 'string') return node;
    if (!Array.isArray(node)) return String(node == null ? '' : node);
    return node.map(x => {
      if (Array.isArray(x) && x.length >= 2 && (COLORS[x[0]] || x[0] === 't')) return llmPlain(x[1]);
      if (Array.isArray(x)) return llmPlain(x);
      return String(x == null ? '' : x);
    }).join('');
  }

  const norm = s => String(s).replace(/\s+/g, ' ').trim();

  // ==================== LLM ====================
  const PROMPT = `Mark modifiers with brackets (括号法), keep the main clause plain.

Bracket these three types:
- pp: prepositional phrase. From the preposition to the first noun after it.
- clause: starts with that/which/who/whom/whose/when/where/why/because/if/although/though/since/as/while. It ENDS at the EARLIEST of: end of sentence, a comma, the next modifier, or the next MAIN-CLAUSE verb.
- nonfinite: starts with to-do / doing / done. Same end rules.

NEVER bracket: the main clause subject, the main clause verb, the main clause object, adjectives, or adverbs.

Output ONLY a JSON array. Each element is ["t","raw text"] for plain text, or ["pp"|"clause"|"nonfinite","raw text"] for a bracketed part.
Concatenating every second element in order MUST equal the input sentence exactly, including spaces and punctuation.

Example:
input:  The book that she bought in Paris last year was excellent.
output: [["t","The book "],["clause","that she bought"],["pp"," in Paris"],["pp"," last year"],["t"," was excellent."]]

Output the JSON array only. No prose, no markdown fences.`;

  function callLLM(sentence, cfg) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('未配置 API URL'));
      const url = cfg.apiUrl.replace(/\/+$/, '') + '/chat/completions';
      const payload = {
        model: cfg.model || undefined,
        temperature: 0,
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: sentence },
        ],
      };
      // 关键：关思考，否则会慢 10 倍以上
      if (cfg.noThinking) payload.reasoning_effort = 'none';
      const body = JSON.stringify(payload);

      const headers = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;

      const handle = text => {
        let j;
        try { j = JSON.parse(text); } catch (e) { return reject(new Error('返回不是 JSON')); }
        if (j.error) return reject(new Error(j.error.message || '接口报错'));
        const msg = j.choices && j.choices[0] && j.choices[0].message;
        const content = (msg && msg.content) || '';
        const m = content.match(/\[[\s\S]*\]/);
        if (!m) return reject(new Error('模型未返回 JSON 数组'));
        let arr;
        try { arr = JSON.parse(m[0]); } catch (e) { return reject(new Error('JSON 解析失败')); }
        if (!Array.isArray(arr)) return reject(new Error('格式不是数组'));
        // 硬校验：拼回来必须等于原句
        if (norm(llmPlain(arr)) !== norm(sentence)) return reject(new Error('RECONSTRUCT_MISMATCH'));
        resolve(arr);
      };

      if (typeof GM_xmlhttpRequest === 'function') {
        let settled = false;
        const done = fn => v => { if (!settled) { settled = true; clearTimeout(guard); fn(v); } };
        // 兜底：即便宿主不回调，也不能让面板永远卡在“分析中”
        const guard = setTimeout(() => {
          done(reject)(new Error('请求超时（30s）'));
        }, 30000);
        GM_xmlhttpRequest({
          method: 'POST', url, headers, data: body,
          onload: r => (r.status >= 200 && r.status < 300
            ? done(handle)(r.responseText)
            : done(reject)(new Error('HTTP ' + r.status))),
          onerror: () => done(reject)(new Error('网络错误')),
          ontimeout: () => done(reject)(new Error('超时')),
          timeout: 30000,
        });
      } else {
        fetch(url, { method: 'POST', headers, body })
          .then(r => r.text()).then(handle).catch(reject);
      }
    });
  }

  // ==================== 面板 ====================
  let panel = null;
  let currentText = '';

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.className = 'br-panel';
    panel.innerHTML = `
      <div class="br-head">
        <span class="br-title">括号法</span>
        <span class="br-legend">
          <i style="--c:${COLORS.pp}">介词</i>
          <i style="--c:${COLORS.clause}">从句</i>
          <i style="--c:${COLORS.nonfinite}">非谓语</i>
        </span>
        <span class="br-spacer"></span>
        <button class="br-btn br-site" title="在本网站自动标注">本站</button>
        <button class="br-btn br-refresh" title="重新分析">↻</button>
        <button class="br-btn br-cfg" title="设置">⚙</button>
        <button class="br-btn br-close" title="关闭 (Esc)">✕</button>
      </div>
      <div class="br-body"></div>
      <div class="br-foot"></div>
      <div class="br-settings" hidden>
        <div class="br-modes">
          <label><input type="radio" name="brmode" value="rules"> 离线规则（即时）</label>
          <label><input type="radio" name="brmode" value="ai"> AI 精修（更准，需接口）</label>
        </div>
        <label>API URL<input class="br-in br-url" placeholder="http://127.0.0.1:3425/v1"></label>
        <label>API Key<input class="br-in br-key" type="password" placeholder="留空则不需要"></label>
        <label>Model<input class="br-in br-model" placeholder="group/deepseek-free"></label>
        <label class="br-check"><input type="checkbox" class="br-nothink"> 关闭思考模式（快 10 倍）</label>
        <div class="br-row">
          <button class="br-btn br-save">保存</button>
          <span class="br-hint"></span>
        </div>
      </div>`;
    document.documentElement.appendChild(panel);

    panel.querySelector('.br-close').onclick = hidePanel;
    panel.querySelector('.br-refresh').onclick = () => showText(currentText);
    panel.querySelector('.br-site').onclick = () => {
      const on = !siteEnabled();
      setSiteEnabled(on);
      syncSiteBtn();
      if (on) startPageAnnotate(); else stopPageAnnotate();
    };
    panel.querySelector('.br-cfg').onclick = () => {
      const s = panel.querySelector('.br-settings');
      if (s.hidden) {
        const c = getCfg();
        panel.querySelector('.br-url').value = c.apiUrl;
        panel.querySelector('.br-key').value = c.apiKey;
        panel.querySelector('.br-model').value = c.model;
        panel.querySelector('.br-nothink').checked = c.noThinking;
        const r = panel.querySelector(`input[name="brmode"][value="${c.mode}"]`);
        if (r) r.checked = true;
      }
      s.hidden = !s.hidden;
    };
    panel.querySelector('.br-save').onclick = () => {
      const modeEl = panel.querySelector('input[name="brmode"]:checked');
      setCfg({
        apiUrl: panel.querySelector('.br-url').value.trim(),
        apiKey: panel.querySelector('.br-key').value.trim(),
        model: panel.querySelector('.br-model').value.trim(),
        noThinking: panel.querySelector('.br-nothink').checked,
        mode: modeEl ? modeEl.value : 'rules',
      });
      const h = panel.querySelector('.br-hint');
      h.textContent = '已保存';
      setTimeout(() => { h.textContent = ''; }, 1500);
      if (currentText) showText(currentText);
    };
    syncSiteBtn();
    return panel;
  }

  function syncSiteBtn() {
    if (!panel) return;
    const b = panel.querySelector('.br-site');
    if (!b) return;
    const on = siteEnabled();
    b.classList.toggle('on', on);
    b.textContent = on ? '本站·开' : '本站';
  }

  function hidePanel() {
    if (panel) { panel.remove(); panel = null; }
  }

  function showText(text) {
    const p = ensurePanel();
    currentText = text;
    p.hidden = false;
    p.style.display = 'flex';
    const cfg = getCfg();
    p.querySelector('.br-settings').hidden = true;

    if (!text.trim()) {
      p.querySelector('.br-body').innerHTML = '<div class="br-empty">请先选中一段英文</div>';
      p.querySelector('.br-foot').innerHTML = '';
      return;
    }
    run(text, p, cfg);
  }

  function run(text, p, cfg) {
    const body = p.querySelector('.br-body');
    const foot = p.querySelector('.br-foot');
    const r = BracketEngine.annotate(text);

    // 规则结果先落地（无论哪种模式，都先给结果，避免空窗）
    const ruleHtml = r.sentences.map(s => `<div class="br-item">${treeToHtml(s.tree)}</div>`).join('');
    const ruleCores = r.sentences.map(s => s.core).filter(Boolean);

    if (cfg.mode !== 'ai' || !cfg.apiUrl) {
      body.innerHTML = ruleHtml;
      renderCore(foot, ruleCores);
      if (cfg.mode === 'ai' && !cfg.apiUrl) {
        body.insertAdjacentHTML('afterbegin', '<div class="br-note">AI 模式需要先配 API</div>');
      }
      return;
    }

    // AI 模式：先显示规则结果，再逐句升级
    body.innerHTML = `<div class="br-note br-progress">AI 分析中…</div>` + ruleHtml;
    renderCore(foot, ruleCores);
    upgradeWithAI(text, p, cfg);
  }

  async function upgradeWithAI(text, p, cfg) {
    const body = p.querySelector('.br-body');
    const foot = p.querySelector('.br-foot');
    const r = BracketEngine.annotate(text);

    const htmls = r.sentences.map(s => treeToHtml(s.tree));
    const cores = r.sentences.map(s => s.core);
    let done = 0, failed = 0;

    const progress = () => {
      const n = body.querySelector('.br-progress');
      if (n) n.textContent = `AI 分析中… ${done}/${r.sentences.length}` + (failed ? `（${failed} 句回退到规则）` : '');
    };
    progress();

    // 串行，避免打爆网关；AI 模式追求准，不追求并行
    for (let i = 0; i < r.sentences.length; i++) {
      const s = r.sentences[i];
      if (p !== panel) break;    // 面板已被关闭
      const cached = cacheGet(s.text);
      if (cached) {
        htmls[i] = cached.html; cores[i] = cached.core;
        done++; progress(); repaint();
        continue;
      }
      try {
        const arr = await callLLM(s.text, cfg);
        const { html, core: c } = llmToHtml(arr);
        htmls[i] = html;
        cores[i] = c.replace(/\s+/g, ' ').trim();
        cacheSet(s.text, { html: htmls[i], core: cores[i] });
      } catch (e) {
        failed++;
        htmls[i] += `<div class="br-err">AI 失败（${esc(e.message)}），已保留离线结果</div>`;
      }
      done++; progress(); repaint();
    }

    const pr = body.querySelector('.br-progress');
    if (pr) {
      if (failed) pr.textContent = `${failed} 句 AI 失败，已用离线规则`;
      else pr.remove();
    }
    repaint();

    function repaint() {
      const keep = body.querySelector('.br-progress');
      const keepText = keep ? keep.textContent : null;
      body.innerHTML = htmls.map(h => `<div class="br-item">${h}</div>`).join('');
      if (keepText != null && failed) {
        body.insertAdjacentHTML('afterbegin', `<div class="br-note br-progress">${esc(keepText)}</div>`);
      }
      renderCore(foot, cores);
    }
  }

  function renderCore(foot, cores) {
    const clean = (cores || []).filter(c => c && c.trim());
    if (!clean.length) { foot.innerHTML = ''; return; }
    const suspicious = clean.filter(c => !looksLikeClause(c));
    foot.innerHTML =
      `<div class="br-core-label">主干` +
      (suspicious.length ? `<span class="br-flag">${suspicious.length} 句结构可疑，建议核对</span>` : '') +
      `</div>` +
      `<div class="br-core">${clean.map(c => esc(c)).join('<br>')}</div>`;
  }

  // 主干是否像个完整小句：必须有谓语，且不能出现两个谓语硬拼在一起
  const FINITE_RE = /\b(am|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|can|could|may|might|must|seems?|becomes?|remains?)\b|\b\w{3,}ed\b|\b\w{4,}s\b/i;
  function looksLikeClause(core) {
    const t = core.replace(/\s+/g, ' ').trim();
    if (!t) return false;
    // 至少 2 个词
    if (t.split(' ').length < 2) return false;
    // 必须有谓语形式
    if (!FINITE_RE.test(t)) return false;
    // 不能以括号符号开头/结尾
    if (/^[)\]\u203a]/.test(t) || /[([\u2039]$/.test(t)) return false;
    return true;
  }

  // ==================== 划词触发 ====================
  let fab = null;

  function onMouseUp() {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { removeFab(); return; }
      const text = sel.toString().trim();
      if (text.length < 8 || !/[A-Za-z]{3}/.test(text)) { removeFab(); return; }
      if (panel && panel.contains(sel.anchorNode)) { removeFab(); return; }

      let rect;
      try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (e) { return; }
      if (!rect || (!rect.width && !rect.height)) { removeFab(); return; }

      if (!fab) {
        fab = document.createElement('button');
        fab.className = 'br-fab';
        fab.textContent = '括号法';
        fab.onmousedown = ev => {
          ev.preventDefault();
          ev.stopPropagation();
          showText(window.getSelection().toString().trim());
          removeFab();
        };
        document.documentElement.appendChild(fab);
      }
      fab.style.top = Math.max(4, rect.top + window.scrollY - 38) + 'px';
      fab.style.left = Math.max(4, Math.min(window.innerWidth - 86, rect.left + window.scrollX + rect.width / 2 - 32)) + 'px';
    }, 10);
  }
  function removeFab() { if (fab) { fab.remove(); fab = null; } }

  // ==================== 全页自动标注 ====================
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'CODE', 'PRE', 'KBD', 'SAMP', 'SVG', 'CANVAS', 'IFRAME']);
  const BR_CLASSES = ['br-mod', 'br-br', 'br-item', 'br-panel', 'br-fab', 'br-note', 'br-core', 'br-wrap'];

  let pageOn = false;
  let io = null;
  let mo = null;
  const queue = [];
  let working = false;
  let stats = { marked: 0, pending: 0 };

  function isSkippable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP_TAGS.has(el.tagName)) return true;
    const cl = el.className;
    if (typeof cl === 'string' && BR_CLASSES.some(c => cl.includes(c))) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // 判断一段文本值不值得标注
  function worthAnnotating(t) {
    if (!t || t.length < 20) return false;
    const letters = (t.match(/[A-Za-z]/g) || []).length;
    if (letters / t.length < 0.5) return false;
    // 至少要有两个词以上
    if ((t.trim().match(/\s/g) || []).length < 3) return false;
    return true;
  }

  function collectTextNodes(root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || isSkippable(p)) return NodeFilter.FILTER_REJECT;
        if (!worthAnnotating(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  // 把文本节点替换为标注后的 spans
  function annotateNode(textNode, cfg) {
    const raw = textNode.nodeValue;
    if (!raw || !raw.trim()) return;
    let r;
    try { r = BracketEngine.annotate(raw); } catch (e) { return; }
    if (!r.sentences.length) return;

    const frag = document.createDocumentFragment();
    for (const s of r.sentences) {
      const span = document.createElement('span');
      span.className = 'br-wrap';
      span.dataset.br = '1';
      span.innerHTML = treeToHtml(s.tree);
      frag.appendChild(span);
    }
    const parent = textNode.parentNode;
    if (!parent) return;
    parent.replaceChild(frag, textNode);
    stats.marked++;
  }

  function startPageAnnotate() {
    if (pageOn) return;
    pageOn = true;

    // 首屏优先：IntersectionObserver 只用来提前处理视口内的节点，
    // 其余节点仍然照常入队（不能只靠 observer，否则视口外的内容永远不处理）
    const ioSupported = 'IntersectionObserver' in window;
    if (ioSupported) {
      io = new IntersectionObserver(entries => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          // 视口内的元素，把它的文本节点提到队首
          const tn = [];
          const walker = document.createTreeWalker(en.target, NodeFilter.SHOW_TEXT, {
            acceptNode(n) {
              const pe = n.parentElement;
              if (!pe || isSkippable(pe)) return NodeFilter.FILTER_REJECT;
              if (!worthAnnotating(n.nodeValue)) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            },
          });
          let x;
          while ((x = walker.nextNode())) tn.push(x);
          for (const n of tn.reverse()) {
            const idx = queue.indexOf(n);
            if (idx >= 0) queue.splice(idx, 1);
            queue.unshift(n);
          }
          if (!working) processQueue();
        }
      }, { rootMargin: '200px 0px' });
    }

    // 现有内容全部入队（不等 observer，保证一定被处理）
    const nodes = collectTextNodes(document.body);
    for (const n of nodes) enqueue(n);
    if (ioSupported) for (const n of nodes) if (n.parentElement) io.observe(n.parentElement);

    // 动态内容
    mo = new MutationObserver(muts => {
      for (const m of muts) {
        for (const added of m.addedNodes) {
          if (added.nodeType === 1) {
            if (isSkippable(added)) continue;
            for (const n of collectTextNodes(added)) enqueue(n);
          } else if (added.nodeType === 3 && added.parentElement && !isSkippable(added.parentElement)) {
            if (worthAnnotating(added.nodeValue)) enqueue(added);
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    pulse();
    toast('本网站自动标注：已开启');
  }

  function stopPageAnnotate() {
    pageOn = false;
    if (io) { io.disconnect(); io = null; }
    if (mo) { mo.disconnect(); mo = null; }
    queue.length = 0;
    working = false;
    // 还原：重建纯文本时必须排除括号符号本身
    document.querySelectorAll('span.br-wrap[data-br]').forEach(el => {
      const parent = el.parentNode;
      if (!parent) return;
      const txt = plainTextOf(el);
      parent.replaceChild(document.createTextNode(txt), el);
    });
    // 合并相邻文本节点，恢复原始 DOM 形态
    document.body.normalize();
    if (stats) { stats.marked = 0; stats.pending = 0; }
    if (badge) { badge.remove(); badge = null; }
    toast('本网站自动标注：已关闭');
  }

  // 读取「不含括号符号」的纯文本
  function plainTextOf(el) {
    let s = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { s += n.nodeValue; continue; }
      if (n.nodeType !== 1) continue;
      if (n.classList && n.classList.contains('br-br')) continue;   // 括号符号跳过
      s += plainTextOf(n);
    }
    return s;
  }

  function enqueue(textNode) {
    if (!textNode || !textNode.nodeValue) return;
    // 已被处理过（在 br-wrap 里）
    const p = textNode.parentElement;
    if (!p || isSkippable(p)) return;
    if (p.closest('.br-wrap')) return;
    queue.push(textNode);
    stats.pending = queue.length;
    if (!working) processQueue();
  }

  function processQueue() {
    if (!pageOn) { queue.length = 0; working = false; return; }
    const node = queue.shift();
    if (!node) { working = false; pulse(); return; }
    working = true;
    stats.pending = queue.length;

    // 节点可能已脱离 DOM，或被其它脚本改过
    if (node.parentNode && !isSkippable(node.parentElement)) {
      try { annotateNode(node, getCfg()); } catch (e) { /* 单节点失败不影响其它 */ }
    }
    pulse();
    // 让出主线程，避免长页面卡顿
    setTimeout(processQueue, 0);
  }

  let pulseTimer = null;
  function pulse() {
    if (pulseTimer) return;
    pulseTimer = setTimeout(() => { pulseTimer = null; showBadge(); }, 120);
  }

  let badge = null;
  function showBadge() {
    if (!pageOn) { if (badge) { badge.remove(); badge = null; } return; }
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'br-badge';
      document.documentElement.appendChild(badge);
    }
    badge.textContent = stats.pending > 0
      ? `括号法 ${stats.marked} 段（队列 ${stats.pending}）`
      : `括号法 ${stats.marked} 段`;
    badge.classList.toggle('done', stats.pending === 0);
  }

  let toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'br-toast';
      document.documentElement.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => { if (toastEl) toastEl.classList.remove('show'); }, 1800);
  }

  // ==================== 样式 ====================
  function injectCSS() {
    const st = document.createElement('style');
    st.textContent = `
/* 标注本体 */
.br-mod{color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent);
  border-radius:3px;padding:1px 0}
.br-mod[data-lowconf]{opacity:.55}
.br-br{color:var(--c);opacity:.7;font-weight:600;user-select:none}
.br-item{margin-bottom:12px;line-height:1.85}
.br-item:last-child{margin-bottom:0}

/* 划词按钮 */
.br-fab{position:absolute;z-index:2147483646;background:#111827;color:#fff;border:0;border-radius:7px;
  padding:5px 11px;font:500 12px/1.4 -apple-system,sans-serif;cursor:pointer;
  box-shadow:0 3px 12px rgba(0,0,0,.32)}
.br-fab:hover{background:#374151}

/* 面板 */
.br-panel{position:fixed;right:20px;bottom:20px;width:min(600px,calc(100vw - 40px));max-height:66vh;
  z-index:2147483647;background:#fff;color:#111;border-radius:12px;
  box-shadow:0 12px 44px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;
  font:14px/1.8 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.br-head{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#f6f7f9;
  border-bottom:1px solid #e5e7eb;flex-wrap:wrap}
.br-title{font-weight:600;font-size:13px;letter-spacing:.3px}
.br-legend{display:flex;gap:8px;font-size:11px}
.br-legend i{font-style:normal;color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent);
  padding:1px 6px;border-radius:4px}
.br-spacer{flex:1}
.br-btn{border:0;background:#eef0f3;color:#333;border-radius:6px;padding:3px 9px;cursor:pointer;
  font-size:12px;font-family:inherit}
.br-btn:hover{background:#e2e5ea}
.br-btn.on{background:#2563eb;color:#fff}
.br-body{padding:14px 16px;overflow:auto;flex:1}
.br-foot{padding:10px 16px;border-top:1px dashed #e5e7eb;background:#fcfcfd}
.br-core-label{font-size:11px;color:#8b939e;letter-spacing:.6px;margin-bottom:3px}
.br-flag{color:#b45309;background:#fef3c7;border-radius:4px;padding:1px 6px;margin-left:8px;
  font-size:10px;letter-spacing:0}
.br-core{font-weight:600;color:#0f172a;font-size:15px;line-height:1.65}
.br-empty,.br-note{color:#8b939e;font-size:12px}
.br-note{margin-bottom:10px;background:#f3f4f6;padding:6px 10px;border-radius:6px}
.br-err{color:#dc2626;font-size:11px;margin-top:4px}

/* 设置 */
.br-settings{padding:12px 16px;border-top:1px solid #e5e7eb;background:#fafbfc;
  display:flex;flex-direction:column;gap:9px}
.br-settings[hidden]{display:none!important}

/* 括号贴紧内容，不要被空白推开 */
.br-mod>.br-br:first-child{margin-right:-.14em}
.br-mod>.br-br:last-child{margin-left:-.14em}
.br-settings label{display:flex;flex-direction:column;gap:3px;font-size:11px;color:#6b7280}
.br-settings label.br-check{flex-direction:row;align-items:center;gap:6px;color:#374151;font-size:12px}
.br-modes{display:flex;gap:16px;font-size:12px;color:#374151}
.br-modes label{flex-direction:row;align-items:center;gap:5px;color:#374151;font-size:12px}
.br-in{border:1px solid #d7dbe0;border-radius:6px;padding:5px 8px;font-size:12px;font-family:inherit}
.br-row{display:flex;align-items:center;gap:10px}
.br-hint{font-size:11px;color:#16a34a}

/* 全页标注 */
.br-badge{position:fixed;left:14px;bottom:14px;z-index:2147483645;background:#111827;color:#fff;
  border-radius:20px;padding:5px 12px;font:500 11px/1.4 -apple-system,sans-serif;
  box-shadow:0 3px 12px rgba(0,0,0,.28);opacity:.9}
.br-badge.done{background:#059669}
.br-toast{position:fixed;left:50%;bottom:70px;transform:translate(-50%,10px);z-index:2147483647;
  background:#111827;color:#fff;border-radius:8px;padding:8px 16px;font:500 12px/1.4 -apple-system,sans-serif;
  opacity:0;transition:opacity .2s,transform .2s;pointer-events:none}
.br-toast.show{opacity:1;transform:translate(-50%,0)}

@media(prefers-color-scheme:dark){
 .br-panel{background:#1c1f24;color:#e5e7eb}
 .br-head{background:#22262c;border-color:#2f343c}
 .br-btn{background:#2b3038;color:#d5d9df}
 .br-btn:hover{background:#343a43}
 .br-btn.on{background:#2563eb;color:#fff}
 .br-foot{background:#1a1d22;border-color:#2f343c}
 .br-core{color:#f1f3f6}
 .br-note{background:#262b32;color:#9aa3ad}
 .br-settings{background:#1a1d22;border-color:#2f343c}
 .br-in{background:#22262c;border-color:#3a4049;color:#e5e7eb}
 .br-settings label,.br-settings label.br-check,.br-modes,.br-modes label{color:#c3c9d1}
 .br-mod{background:color-mix(in srgb,var(--c) 22%,transparent)}
}`;
    (document.head || document.documentElement).appendChild(st);
  }

  // ==================== 启动 ====================
  injectCSS();

  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('scroll', removeFab, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { hidePanel(); removeFab(); }
  });

  // 配置里开了「本站自动」，或者已保存本站开关
  if (siteEnabled()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startPageAnnotate, { once: true });
    } else {
      startPageAnnotate();
    }
  }
})();

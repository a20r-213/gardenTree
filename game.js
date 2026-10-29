/* ============================================================
   game.js — ゲームのしくみ(いちばんよく直すファイル)
   ・時間がたつと木が育つ(放っておいてOK)
   ・じょうろに水がたまる(実際の時間。アプリを閉じていてもたまる)
   ・水をかけると、少し早く育つ
   ・木を触ると、花びらが舞う
   ・メモを書くと、1日1回、どんぐりがもらえる
   ・画面は3つ。横にスワイプして切り替える(左:ずかん / 中:そだてる / 右:ジオラマ)
   木を描くのは tree-art.js の仕事です。ここでは「いま何段階めか」を渡すだけ。
   ============================================================ */

/* ---------- 設定:ここの数字を変えると、ゲームのバランスが変わります ---------- */
const CONFIG = {
  STEPS: 42,             // 満開までの段階の数。大きいほど、変化が細かくなります
  STEP_HOURS: 4,         // 放っておいたとき、1段階進むのにかかる時間(時間)。42段階×4時間 = 約1週間で満開
  WATER_STEPS: 1,        // 水を1杯かけると、進む段階の数(1段階 = 4時間ぶん)
  WATER_MAX: 3,          // じょうろにためておける水の数
  WATER_REGEN_HOURS: 3,  // 水が1杯たまるまでの時間(時間)
  MEMO_ACORNS: 3,        // メモを書いたとき(1日1回)もらえるどんぐりの数
  GACHA_COST: 5,         // ガチャ1回に必要などんぐりの数(ガチャは、まだ作っていません)
  SEED_FIRST: 'roza'     // 最初の木の「種」(文字を変えると木の形が変わります)
};

/* ============================================================
   保存データ(スマホ・ブラウザの中に残ります)
   まるごと1つの箱 DATA に入れて、'treegame_v2' という名前で保存します。
     DATA.tree    : いま育てている木(植えた時刻・水・種)
     DATA.placed  : 木のまわりに置いた装飾(まだ空。あとで使います)
     DATA.owned   : 持っている装飾(まだ空。あとで使います)
     DATA.acorns  : どんぐりの数
     DATA.dex     : ずかんに登録した木(まだ空。あとで使います)
     DATA.memos   : メモの一覧と、ごほうびをもらった日
   ============================================================ */
const SAVE_KEY = 'treegame_v2';
const OLD_SAVE_KEY = 'treegame_v1';        // 前のバージョンの木のデータ(引き継ぎ用)
const OLD_MEMO_KEY = 'treegame_memos_v1';  // 前のバージョンのメモのデータ(引き継ぎ用)
const STEP_MS = CONFIG.STEP_HOURS * 3600 * 1000;
const REGEN_MS = CONFIG.WATER_REGEN_HOURS * 3600 * 1000;

// 新しい木のデータ。start: 植えた時刻 / bonus: 水やりで進んだ段階 / stock: 水の数 / waterAt: stockを数えはじめた時刻
function newTree(seed) {
  const now = Date.now();
  return { start: now, bonus: 0, stock: CONFIG.WATER_MAX, waterAt: now, seed: seed };
}
// 木のデータが壊れていないか確かめて、きれいな形にそろえる(ダメなら null)
function cleanTree(s) {
  if (!s || !Number.isFinite(s.start)) return null;
  return {
    start: s.start,
    bonus: Math.max(0, Number(s.bonus) || 0),
    stock: Math.min(CONFIG.WATER_MAX, Math.max(0, Number(s.stock) || 0)),
    waterAt: Number.isFinite(s.waterAt) ? s.waterAt : Date.now(),
    seed: typeof s.seed === 'string' ? s.seed.slice(0, 20) : CONFIG.SEED_FIRST
  };
}
function cleanMemoList(list) {
  return Array.isArray(list) ? list.filter(m => m && typeof m.text === 'string' && Number.isFinite(m.t)).slice(0, 300) : [];
}
function freshData() {
  return { v: 2, tree: newTree(CONFIG.SEED_FIRST), placed: [], owned: [], acorns: 0, dex: [], memos: { list: [], rewardDay: '' } };
}
function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }

function loadData() {
  const d = freshData();
  const cur = readJSON(SAVE_KEY);
  if (cur && cur.v === 2) {
    // 新しい形のデータがあれば、それを使う
    d.tree = cleanTree(cur.tree) || d.tree;
    d.placed = Array.isArray(cur.placed) ? cur.placed : [];
    d.owned = Array.isArray(cur.owned) ? cur.owned : [];
    d.acorns = Math.max(0, Math.floor(Number(cur.acorns) || 0));
    d.dex = Array.isArray(cur.dex) ? cur.dex : [];
    if (cur.memos) d.memos = { list: cleanMemoList(cur.memos.list), rewardDay: typeof cur.memos.rewardDay === 'string' ? cur.memos.rewardDay : '' };
    return d;
  }
  // 新しい形がなければ、前のバージョンのデータを引き継ぐ(木とメモ。古いデータは消さずに残します)
  d.tree = cleanTree(readJSON(OLD_SAVE_KEY)) || d.tree;
  const oldMemos = readJSON(OLD_MEMO_KEY);
  if (oldMemos) d.memos.list = cleanMemoList(oldMemos.list); // ごほうびの日は引き継がない → 今日からどんぐりがもらえる
  return d;
}
const DATA = loadData();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(DATA)); } catch (e) {} }
persist(); // 引き継ぎをしたときに、すぐ新しい形で保存しておく

/* ---------- いまの成長・水の数を、時刻から計算する ---------- */
// 成長 = (植えてからの時間 ÷ 1段階の時間) + 水やりで進んだぶん。満開(STEPS)で止まる
const growthAt = now => Math.min(CONFIG.STEPS, Math.max(0, (now - DATA.tree.start) / STEP_MS) + DATA.tree.bonus);
// 水の数 = 保存した数 + 時間でたまったぶん。WATER_MAXで止まる
const stockAt = now => DATA.tree.stock >= CONFIG.WATER_MAX ? CONFIG.WATER_MAX
  : Math.min(CONFIG.WATER_MAX, DATA.tree.stock + Math.max(0, now - DATA.tree.waterAt) / REGEN_MS);

/* ---------- 木(tree-art.js に渡すデータ) ---------- */
// decor: false = 「育つにつれて、飾りや動物が自動で出てくる」しくみを止めています(絵のコードは tree-art.js に残っています)
const TREE = {
  id: 'main',
  props: { species: 'tree', seed: DATA.tree.seed, ps: 4, steps: CONFIG.STEPS, sky: 'auto', auto: 0, decor: false, seasons: false, seasonLen: 4, fade: 10, pad: 0 },
  state: { g: 0 }
};

/* ---------- 画面の部品 ---------- */
const $id = id => document.getElementById(id);
const treeCv = $id('tree'), fxCv = $id('fx'), stageEl = $id('stage'), canCv = $id('can');
let treeCtx = null, fxCtx = null, LW = 0, LH = 0;
const DOT = TREE.props.ps; // 木のドット1個の大きさ(画面のpx)

function resizeStage() {
  const r = stageEl.getBoundingClientRect();
  const w = Math.max(16, Math.floor(r.width / DOT)), h = Math.max(24, Math.floor(r.height / DOT));
  if (w === LW && h === LH) return;
  LW = w; LH = h;
  treeCv.width = fxCv.width = LW; treeCv.height = fxCv.height = LH;
  treeCtx = treeCv.getContext('2d'); fxCtx = fxCv.getContext('2d');
  particles.length = 0;
}

function showMsg(text) {
  const m = $id('msg'); m.textContent = text;
  m.classList.remove('show'); void m.offsetWidth; m.classList.add('show');
}

/* ============================================================
   3つの画面(横スワイプ)
   横にならんだ3枚の画面(#pager)を、スクロールで切り替えています。
   0 = ずかん / 1 = そだてる / 2 = ジオラマ
   ============================================================ */
const pagerEl = $id('pager'), dotEls = Array.from(document.querySelectorAll('#dots button'));
let pageIdx = 1;
// 画面を切り替える。smooth = true だと、すーっと動く
function goPage(i, smooth) {
  pagerEl.scrollTo({ left: i * pagerEl.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
}
// 今どの画面かを計算して、上の点の色を変える
function updateDots() {
  pageIdx = Math.round(pagerEl.scrollLeft / Math.max(1, pagerEl.clientWidth));
  dotEls.forEach((el, i) => el.classList.toggle('on', i === pageIdx));
}
pagerEl.addEventListener('scroll', updateDots, { passive: true });
dotEls.forEach(el => el.addEventListener('click', () => goPage(Number(el.dataset.page), true)));
window.addEventListener('resize', () => goPage(pageIdx, false)); // 画面の幅が変わっても、いまの画面にとどまる

/* ============================================================
   じょうろ(ドット絵)
   ============================================================ */
const CAN_PAL = { b: '#4f86d0', l: '#8fbaf2', d: '#2f5a99', h: '#3b4a6b', s: '#4f86d0', w: '#6cc3ff' };
const CAN_ROWS = [
  '.............s',
  '............ss',
  '...........ss.',
  'hhhh.bbbbbbss.',
  'h..h.lbbbbbbs.',
  'h..h.lbbbbbb..',
  'hhhh.bbbbbbd..',
  '.....bbbbbbd..',
  '.....bbbbddd..',
  '......dddddd..'
];
const CAN_W = 22, CAN_H = 18, SRC_CX = 7, SRC_CY = 5, DST_CX = 10, DST_CY = 9;
let canAnim = null; // { t0, kind: 'pour' | 'no' }

function drawCan(now) {
  const c = canCv.getContext('2d');
  c.clearRect(0, 0, CAN_W, CAN_H);
  let ang = 0, drip = false, shake = 0;
  if (canAnim) {
    const t = (now - canAnim.t0) / 1000;
    if (canAnim.kind === 'pour') {
      // 0〜0.25秒でかたむき、0.25〜0.85秒そのまま、0.85〜1.1秒でもどる
      const deg = t < 0.25 ? t / 0.25 : t < 0.85 ? 1 : Math.max(0, 1 - (t - 0.85) / 0.25);
      ang = deg * 38 * Math.PI / 180; drip = t >= 0.2 && t < 0.9;
      if (t > 1.1) canAnim = null;
    } else {
      shake = Math.round(Math.sin(t * 40) * 1); // 水がないときは、ぶるっと震える
      if (t > 0.3) canAnim = null;
    }
  }
  const empty = stockAt(Date.now()) < 1 && TREE.state.g < CONFIG.STEPS;
  const co = Math.cos(ang), si = Math.sin(ang);
  for (let y = 0; y < CAN_H; y++) for (let x = 0; x < CAN_W; x++) {
    const dx = x - DST_CX, dy = y - DST_CY;
    const sx = Math.round(dx * co + dy * si + SRC_CX), sy = Math.round(-dx * si + dy * co + SRC_CY);
    if (sy < 0 || sy >= CAN_ROWS.length || sx < 0 || sx >= CAN_ROWS[0].length) continue;
    const ch = CAN_ROWS[sy][sx]; if (ch === '.') continue;
    c.globalAlpha = empty ? 0.45 : 1; c.fillStyle = CAN_PAL[ch]; c.fillRect(x + shake, y, 1, 1);
  }
  c.globalAlpha = 1;
  if (drip) { // 注ぎ口(右上)から水のつぶ
    const tx = Math.round((13 - SRC_CX) * co - (0 - SRC_CY) * si + DST_CX), ty = Math.round((13 - SRC_CX) * si + (0 - SRC_CY) * co + DST_CY);
    const k = Math.floor(now / 90) % 4;
    for (let i = 0; i < 3; i++) { const yy = ty + 1 + ((k + i * 2) % 6); if (yy < CAN_H) { c.fillStyle = CAN_PAL.w; c.fillRect(Math.min(CAN_W - 1, tx + 1), yy, 1, 1); } }
  }
}

/* ============================================================
   水やり
   ============================================================ */
function pour() {
  const now = Date.now();
  if (canAnim && canAnim.kind === 'pour') return; // 注いでいる最中は無視
  const bloomed = growthAt(now) >= CONFIG.STEPS;
  if (!bloomed) {
    const st = stockAt(now);
    if (st < 1) { canAnim = { t0: performance.now(), kind: 'no' }; showMsg('まだ たまってないよ'); return; }
    DATA.tree.stock = st - 1; DATA.tree.waterAt = now;   // 水を1杯つかう(ここから次の1杯のカウントが始まる)
    DATA.tree.bonus += CONFIG.WATER_STEPS;               // そのぶん木が育つ
    persist();
  }
  canAnim = { t0: performance.now(), kind: 'pour' };
  // 木の上から水滴が落ちる演出(tree-art.js が描いてくれる)
  const fx = plFx(TREE.id), t = performance.now() / 1000;
  for (let i = 0; i < 9; i++) fx.push({ k: 'drop', xf: 0.2 + Math.random() * 0.6, t0: t + 0.25, dl: Math.random() * 0.35 });
  fx.push({ k: 'burst', t0: t + 1.15 });
}
$id('can-btn').addEventListener('click', pour);

/* ============================================================
   木を触ったときの反応(花びら・葉っぱが舞う)
   ============================================================ */
const particles = [];
function leafColors() {
  const p = PAL[TREE.props.species] || PAL.tree;
  return [p.leaf[3], p.leaf[2], p.leaf[3], p.bloom || p.leaf[3]];
}
function onTap(e) {
  const r = fxCv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * LW, y = (e.clientY - r.top) / r.height * LH;
  if (y > LH * 0.93) return; // 地面は反応しない
  const cols = leafColors();
  for (let i = 0; i < 16; i++) {
    particles.push({ x: x + (Math.random() - 0.5) * 14, y: y - Math.random() * 8, vx: (Math.random() - 0.5) * 6, vy: 3 + Math.random() * 5, ph: Math.random() * 6.28, c: cols[i % cols.length], life: 1.6 + Math.random() * 1.2, age: 0 });
  }
  particles.push({ spark: true, x: x, y: y, age: 0, life: 0.3 }); // タップした場所に小さなキラッ
}
// 'click' = 指をちょんと触れて離したとき。スワイプ(指を動かして画面を切り替える)のときは反応しません
fxCv.addEventListener('click', onTap);

let lastFxT = 0;
function drawFx(nowMs) {
  const dt = Math.min(0.1, Math.max(0, (nowMs - lastFxT) / 1000)); lastFxT = nowMs;
  fxCtx.clearRect(0, 0, LW, LH);
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i]; q.age += dt;
    if (q.age >= q.life) { particles.splice(i, 1); continue; }
    if (q.spark) {
      fxCtx.fillStyle = '#fff6a0'; const a = 1 - q.age / q.life; fxCtx.globalAlpha = a;
      const x = Math.round(q.x), y = Math.round(q.y);
      fxCtx.fillRect(x, y - 2, 1, 5); fxCtx.fillRect(x - 2, y, 5, 1); fxCtx.globalAlpha = 1; continue;
    }
    q.x += (q.vx + Math.sin(nowMs / 400 + q.ph) * 4) * dt; q.y += q.vy * dt;
    if (q.y > LH * 0.93) { particles.splice(i, 1); continue; }
    fxCtx.globalAlpha = Math.min(1, (q.life - q.age) * 2); fxCtx.fillStyle = q.c; fxCtx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
  }
  fxCtx.globalAlpha = 1;
}

/* ============================================================
   画面の文字・バーの更新(1秒に4回くらい)
   ============================================================ */
function fmtDur(ms) {
  const m = Math.ceil(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d > 0 ? `${d}日${h}時間` : h > 0 ? `${h}時間${String(mm).padStart(2, '0')}分` : `${mm}分`;
}
function updateUI(now) {
  const g = growthAt(now), bloomed = g >= CONFIG.STEPS;
  $id('prog-fill').style.width = (g / CONFIG.STEPS * 100) + '%';
  $id('prog-label').textContent = bloomed ? '満開!' : `満開まで あと約${fmtDur((CONFIG.STEPS - g) * STEP_MS)}`;
  $id('acorn-n').textContent = DATA.acorns;
  const st = stockAt(now), full = Math.floor(st + 1e-9);
  document.querySelectorAll('#pips i').forEach((el, i) => el.classList.toggle('on', i < full));
  const frac = st >= CONFIG.WATER_MAX ? 0 : st - Math.floor(st);
  $id('wbar-fill').style.width = (st >= CONFIG.WATER_MAX ? 100 : frac * 100) + '%';
  $id('wlabel').textContent = bloomed ? 'ゆっくり眺めてね。水はいらないよ'
    : st >= CONFIG.WATER_MAX ? '水は満タン! かけてあげよう'
    : `次の水まで あと${fmtDur((1 - frac) * REGEN_MS)}`;
}

/* ============================================================
   メインループ(1秒に60回くらい呼ばれる)
   ============================================================ */
let lastBloomed = null, lastUiT = 0;
function frame() {
  const nowMs = performance.now(), now = Date.now();
  const g = growthAt(now);
  TREE.state.g = Math.floor(g + 1e-9);
  if (treeCtx) plantFrame(treeCtx, TREE, LW, LH);
  if (fxCtx) drawFx(nowMs);
  drawCan(nowMs);
  const bloomed = g >= CONFIG.STEPS;
  if (lastBloomed === false && bloomed) showMsg('満開!'); // 起動直後は出さない
  lastBloomed = bloomed;
  if (nowMs - lastUiT > 250) { lastUiT = nowMs; updateUI(now); }
  requestAnimationFrame(frame);
}

/* ---------- 「木を植え直す」(新しい種で、木をはじめから)。いまは開発用パネルの中だけにあります ---------- */
$id('reset').addEventListener('click', () => {
  if (!confirm('いまの木を片づけて、新しい種を植えますか?')) return;
  const seed = 's' + Math.random().toString(36).slice(2, 7); // ランダムな種 → 毎回ちがう形の木になる
  DATA.tree = newTree(seed); TREE.props.seed = seed; PLV.delete(TREE.id); plFx(TREE.id).length = 0;
  lastBloomed = null; persist(); closeSheets();
});

/* ============================================================
   ドット絵のアイコン(文字で描いた絵を、色に置きかえて表示します)
   ============================================================ */
const ICON_PAL = { o: '#4a2a1c', y: '#f0b84a', Y: '#c98a2a', p: '#e88a9a', K: '#3a2a2a', w: '#fff3dc', r: '#c4574a', R: '#8e3a30', g: '#9aa0aa', G: '#6a707a', B: '#7a4a2a', b: '#a8693a' };
const ICONS = {
  // えんぴつ
  note: [
    '........oo..',
    '.......oppo.',
    '......oyyoo.',
    '.....oyYyo..',
    '....oyYyo...',
    '...oyYyo....',
    '..oyYyo.....',
    '.oyYyo......',
    '.oowYo......',
    '.oKKo.......',
    '.oo.........',
    '............'
  ],
  // どんぐり
  acorn: [
    '.....oo.....',
    '...oooooo...',
    '..oBbBbBBo..',
    '.oBbBBBbBBo.',
    '.oBBBBBBBBo.',
    '.oooooooooo.',
    '.oyyyyyyyYo.',
    '.oyyyyyyYYo.',
    '..oyyyyYYo..',
    '...oyyYYo...',
    '....oYYo....',
    '.....oo.....'
  ],
  // 歯車
  gear: [
    '.....oo.....',
    '..oo.oo.oo..',
    '..ogoggogo..',
    '...oggggo...',
    '.oogGooGgoo.',
    'ooggGooGggoo',
    'ooggGooGggoo',
    '.oogGooGgoo.',
    '...oggggo...',
    '..ogoggogo..',
    '..oo.oo.oo..',
    '.....oo.....'
  ]
};
function drawIcons() {
  document.querySelectorAll('canvas.ico').forEach(cv => {
    const rows = ICONS[cv.dataset.ico]; if (!rows) return;
    const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && ICON_PAL[ch]) { c.fillStyle = ICON_PAL[ch]; c.fillRect(x, y, 1, 1); } }));
  });
}

/* ============================================================
   シート(メモ・設定の小窓)
   ============================================================ */
function openSheet(id) { $id(id).hidden = false; }
function closeSheets() { document.querySelectorAll('.overlay').forEach(o => { o.hidden = true; }); }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheets));
document.querySelectorAll('.overlay').forEach(o => o.addEventListener('pointerdown', e => { if (e.target === o) closeSheets(); })); // 外側をタッチで閉じる

/* ============================================================
   メモ(任意。書くと、1日1回だけ どんぐり がもらえる)
   メモの小窓には「書く」と「き録(読み返し)」の2つのタブがあります
   ============================================================ */
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
// 今日のごほうびは、もうもらったか?
const memoRewarded = now => DATA.memos.rewardDay === dayKey(now);

function showTab(name) {
  document.querySelectorAll('#sheet-memo .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
  $id('pane-write').hidden = name !== 'write';
  $id('pane-read').hidden = name !== 'read';
  if (name === 'read') renderLog();
}
function openMemo() {
  $id('memo-hint').textContent = memoRewarded(Date.now())
    ? '今日のごほうびはもらったよ。何度書いてもOK!'
    : `書くと、今日はどんぐりが${CONFIG.MEMO_ACORNS}個もらえるよ。書かなくてもOK!`;
  showTab('write');
  openSheet('sheet-memo');
}
function saveMemo() {
  const ta = $id('memo-text'), text = ta.value.trim().slice(0, 500);
  if (!text) { ta.focus(); return; }
  const now = Date.now(), first = !memoRewarded(now);
  DATA.memos.list.unshift({ t: now, text: text }); DATA.memos.list = DATA.memos.list.slice(0, 300);
  let msg = 'メモを書いたよ';
  if (first) {
    DATA.acorns += CONFIG.MEMO_ACORNS;
    DATA.memos.rewardDay = dayKey(now); msg = `どんぐり +${CONFIG.MEMO_ACORNS}`;
  }
  persist(); ta.value = ''; closeSheets(); showMsg(msg);
}
function renderLog() {
  const box = $id('log-list'); box.textContent = '';
  if (!DATA.memos.list.length) { const p = document.createElement('p'); p.className = 'note'; p.textContent = 'まだメモがないよ。「書く」から書いてみよう'; box.appendChild(p); return; }
  const z = n => String(n).padStart(2, '0');
  DATA.memos.list.forEach(m => {
    const d = new Date(m.t), item = document.createElement('div'), small = document.createElement('small'), body = document.createElement('div');
    item.className = 'log-item'; small.textContent = `${d.getMonth() + 1}/${d.getDate()} ${z(d.getHours())}:${z(d.getMinutes())}`; body.textContent = m.text;
    item.appendChild(small); item.appendChild(body); box.appendChild(item);
  });
}
$id('open-memo').addEventListener('click', openMemo);
$id('memo-save').addEventListener('click', saveMemo);
document.querySelectorAll('#sheet-memo .tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
$id('open-settings').addEventListener('click', () => openSheet('sheet-settings'));

/* ---------- 開発用パネル(アドレスの最後に #debug を付けると、設定の中に出ます) ---------- */
function setupDebug() {
  const box = $id('debug'); box.hidden = location.hash !== '#debug';
  window.addEventListener('hashchange', () => { box.hidden = location.hash !== '#debug'; });
  box.querySelectorAll('[data-adv]').forEach(b => b.addEventListener('click', () => {
    DATA.tree.start -= Number(b.dataset.adv) * 3600 * 1000; DATA.tree.waterAt -= Number(b.dataset.adv) * 3600 * 1000; persist();
  }));
  $id('dbg-water').addEventListener('click', () => { DATA.tree.stock = CONFIG.WATER_MAX; DATA.tree.waterAt = Date.now(); persist(); });
  $id('dbg-acorn').addEventListener('click', () => { DATA.acorns += 10; persist(); });
}

/* ---------- 起動 ---------- */
window.addEventListener('resize', resizeStage);
setupDebug();
drawIcons();
resizeStage();
goPage(1, false); // はじめは、まんなかの「そだてる」画面から
updateDots();
window.__game = { DATA, TREE, pour, growthAt, stockAt, CONFIG, goPage }; // テスト用
frame();

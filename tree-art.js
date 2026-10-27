/* ============================================================
   tree-art.js — ドット絵の木を描くところ(ここは基本さわりません)
   overlay-maker.html の「育つ木」のコードを、そのまま移したものです。
   game.js から「いまの成長具合」を渡すと、木の絵を描いてくれます。
   ============================================================ */
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const hash = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const PAL = {
  tree:   { name: '若葉の木', leaf: ['#1d4a2a', '#2f7d3e', '#58b04a', '#a6e870'], trunk: ['#3a2416', '#5b3a22', '#80573a'], fruit: '#e0463b', petals: false, bloom: null },
  sakura: { name: '桜',       leaf: ['#7c2e55', '#c4567f', '#f08fb2', '#ffd6e4'], trunk: ['#38242f', '#573748', '#7b5367'], fruit: '#fff4f8', petals: true,  bloom: '#fff4f8' },
  autumn: { name: '紅葉',     leaf: ['#6a230f', '#b5461a', '#e8862c', '#f7c95a'], trunk: ['#33211a', '#52382a', '#74523c'], fruit: '#ffe58f', petals: true,  bloom: null }
};
const PALX = { summer: { name: '夏', leaf: ['#123b1d', '#206a35', '#37a047', '#86d95c'], trunk: ['#3a2416', '#5b3a22', '#80573a'], fruit: '#e0463b', petals: false, bloom: null } };
const SEASONS = ['春', '夏', '秋', '冬'];
const SKY = {
  day:    ['#5fb0e6', '#7cc2ee', '#9ad2f2', '#b9e0f6', '#d8f0fa'],
  dawn:   ['#5d6fb0', '#8d85bd', '#d196b0', '#efb399', '#f8d6a6'],
  sunset: ['#444a8c', '#85569a', '#d4647a', '#ee8c60', '#f7bd6a'],
  night:  ['#080c26', '#0e1536', '#151f46', '#1b2856', '#243566']
};
const BAY = [0, 0.5, 0.75, 0.25];
const PLFX = new Map();
const plFx = id => { let a = PLFX.get(id); if (!a) { a = []; PLFX.set(id, a); } return a; };
let PLMSG = null;
const PLC = new Map();
const rng = seed => { let a = parseInt(hash(String(seed)), 36) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const hsh = (x, y, k) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(k | 0, 1013904223)) | 0; h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const ease = x => x * x * (3 - 2 * x);
const plSteps = p => Math.max(3, Math.round(p.steps) || 20);
const plThr = (p, k) => Math.max(k + 1, Math.round(plSteps(p) * (0.15 + 0.85 * k / (DECOR.length - 1))));
const plUnl = w => { if (!w.props.decor) return 0; let n = 0; for (let k = 0; k < DECOR.length; k++) if ((w.state.g | 0) >= plThr(w.props, k)) n++; return n; };
function plSeasonIdx(w) { const p = w.props, g = w.state.g | 0, st = plSteps(p); return !p.seasons || g < st ? -1 : Math.floor((g - st) / Math.max(1, p.seasonLen)); }
function plSeason(w) { const i = plSeasonIdx(w); return i < 0 ? -1 : i % 4; }
function plInfo(w) {
  const g = w.state.g | 0, st = plSteps(w.props), n = plUnl(w);
  let t = `成長 ${g} / ${st}(${Math.min(100, Math.round(g / st * 100))}%)`;
  const si = plSeasonIdx(w);
  if (si >= 0) { const len = Math.max(1, w.props.seasonLen); t += ` ／ 季節: ${SEASONS[si % 4]}(あと${len - ((g - plSteps(w.props)) % len)}回で${SEASONS[(si + 1) % 4]})`; }
  if (w.props.decor) t += ` ／ デコレーション・動物 ${n}/${DECOR.length}` + (n ? ':' + DECOR.slice(0, n).join('・') : '') + (n < DECOR.length ? ` ／ 次は「${DECOR[n]}」(${plThr(w.props, n)}回で解放)` : '');
  return t;
}
function waterPlant(w, dir) {
  const before = plUnl(w), sBefore = plSeasonIdx(w), fx = plFx(w.id), now = performance.now() / 1000;
  w.state.g = clamp((w.state.g | 0) + (dir > 0 ? 1 : -1), 0, 9999);
  if (dir > 0) {
    for (let i = 0; i < 9; i++) fx.push({ k: 'drop', xf: 0.2 + Math.random() * 0.6, t0: now, dl: Math.random() * 0.35 });
    fx.push({ k: 'burst', t0: now + 0.9 });
    const after = plUnl(w), sAfter = plSeasonIdx(w);
    if (sAfter > sBefore) PLMSG = { id: w.id, text: sAfter === 0 ? '満開!' : SEASONS[sAfter % 4], t: Date.now() };
    else if (after > before) PLMSG = { id: w.id, text: 'NEW  ' + DECOR[after - 1], t: Date.now() };
  }
}
function skyPhase(mode) {
  if (mode !== 'auto') return mode;
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  return h >= 5 && h < 7 ? 'dawn' : h >= 7 && h < 16.5 ? 'day' : h >= 16.5 && h < 18.5 ? 'sunset' : 'night';
}
function plLayout(p, Lw, Lh) {
  const key = [p.seed, p.species, Lw, Lh].join('|'); let L = PLC.get(key); if (L) return L;
  const R = rng(key), gy = Lh - Math.max(6, Math.round(Lh * 0.05));
  const cx = Math.round(Lw / 2 + (R() - .5) * Lw * 0.08), U = Math.max(12, Math.min(Lw, gy * 0.33)), Hc = Math.max(10, Math.min(gy * 0.34, U * 1.5)), TH = Math.max(4, Math.round(Math.min(gy * 0.26, U * 0.9)));
  const J = () => (R() - .5) * .08;
  const limbs = [{ t: .70, ex: -.27 + J(), ey: .30 + J() }, { t: .76, ex: .28 + J(), ey: .36 + J() }, { t: .88, ex: -.14 + J(), ey: .64 + J() }, { t: .92, ex: .15 + J(), ey: .70 + J() }, { t: 1.0, ex: J(), ey: 1.0 }];
  const clumps = [
    ...limbs.map((l, i) => ({ ex: l.ex, ey: l.ey, r: (i === 4 ? .19 : .17) + R() * .03 })),
    { ex: 0, ey: .45, r: .22 }, { ex: -.30, ey: .52, r: .15 }, { ex: .30, ey: .56, r: .15 }, { ex: -.08, ey: .82, r: .17 }, { ex: .12, ey: .22, r: .16 }, { ex: -.12, ey: .2, r: .15 }
  ].map(c => Object.assign(c, { ex: c.ex + (R() - .5) * .04, id: Math.floor(R() * 1000) }));
  L = { gy, cx, U, Hc, TH, limbs, clumps, wob: R() * 6.28,
    stars: Array.from({ length: 14 }, () => ({ x: Math.floor(R() * Lw), y: Math.floor(R() * gy * 0.6), ph: R() * 6.28 })),
    clouds: Array.from({ length: 3 }, () => ({ y: Math.floor(gy * (0.05 + R() * 0.35)), x0: R() * (Lw + 14), sp: 0.5 + R() * 0.7 })),
    decor: DECOR.map(() => ({ x: Math.floor(3 + R() * Math.max(1, Lw - 6)), c: Math.floor(R() * 3) })) };
  if (PLC.size > 20) PLC.clear();
  PLC.set(key, L); return L;
}
const NAMES = { flower: '花', mush: 'キノコ', stone: '石', bunny: 'うさぎ', fly: 'ちょうちょ', fence: '柵', squirrel: 'リス', lantern: 'ランタン', bird: '小鳥', owl: 'ふくろう', hedgehog: 'ハリネズミ', firefly: 'ほたる', fox: 'きつね', deer: 'しか', fruit: '実り' };
const ORDER = Object.keys(NAMES);
const DECOR = ORDER.map(k => NAMES[k]);
const SPR = {
  bunny: { c: { b: '#b69a82', p: '#f0a8b8', K: '#1b1b1b', n: '#e08aa0', w: '#ffffff', f: '#8a7260' }, r: ['......bp', '......bp', '....bbbb', '.bbbbbKb', 'wbbbbbbn', '.bbbbbb.', '.ff..ff.'] },
  squirrel: { c: { t: '#d6823a', l: '#f2b878', b: '#a8541f', K: '#1b1b1b', n: '#3a2a2a', f: '#6b3a18' }, r: ['tt......', 'ttt..bb.', 'tlt.bbbb', 'ttbbbbKb', '.tbbbbbn', '..bbbbb.', '..bbbbb.', '..f..f..'] },
  hedgehog: { c: { s: '#5a4636', S: '#8a6e52', b: '#e0c4a0', K: '#111111', n: '#222222', f: '#3a2c20' }, r: ['..sssss..', '.sSsSsSs.', 'sSsSsSsbb', 'ssssssbKn', '.f.f.f.f.'] },
  fox: { c: { o: '#e07b2a', w: '#fff3e0', K: '#1b1b1b', n: '#2a1a12', f: '#4a2a14', d: '#b35a1a' }, r: ['........o.o.', '........ooo.', 'oo....ooooKo', 'ooow.oooooon', 'woooooooowww', '.dooooooooo.', '..f.f..f.f..'] },
  deer: { c: { a: '#cdb89a', o: '#b07a45', O: '#8d5e32', K: '#1b1b1b', n: '#2a1a12', w: '#f3e6d0', f: '#5a3d22' }, r: ['......a.a..', '......aaa.a', '.......aaa.', '........oo.', '.......oKon', '......ooooo', '.....ooo...', '....oooo...', 'ww.ooooooo..', 'wooooooooo..', '.oooooooOo..', '.oooooooOo..', '.f.f...f.f..', '.f.f...f.f..'] },
  owl: { c: { b: '#7a5c3e', w: '#fff3d6', K: '#1b1b1b', Y: '#ffd84a', y: '#ffb347', c: '#d8c3a0' }, r: ['bb...bb', 'bbbbbbb', 'bwwbwwb', 'bwKbKwb', 'bbbybbb', 'bcccccb', 'bcbcbcb', '.bcccb.', '..y.y..'] },
  owlz: { c: { b: '#7a5c3e', w: '#fff3d6', K: '#1b1b1b', Y: '#ffd84a', y: '#ffb347', c: '#d8c3a0' }, r: ['bb...bb', 'bbbbbbb', 'bbbbbbb', 'bKKbKKb', 'bbbybbb', 'bcccccb', 'bcbcbcb', '.bcccb.', '..y.y..'] }
};
const PLV = new Map();
function plVis(id, tg, ts, fade, now) {
  let v = PLV.get(id); if (!v) { v = { g: tg, s: ts, t: now }; PLV.set(id, v); return v; }
  const dt = Math.min(0.25, Math.max(0, now - v.t)); v.t = now;
  v.g += (tg - v.g) * Math.min(1, dt * 1.1);
  if (Math.abs(tg - v.g) < 0.003) v.g = tg;
  if (ts < 0 || v.s < 0 || fade <= 0) v.s = ts;
  else { const d = ts - v.s, stp = dt / fade * Math.max(1, Math.abs(d)); v.s = Math.abs(d) <= stp ? ts : v.s + Math.sign(d) * stp; }
  return v;
}
function plSeasonState(sv) {
  if (sv < 0) return { k: -1, tN: 0, mode: 'plain', snow: 0, twig: false, leaves: true };
  const fl = Math.floor(sv + 1e-9), k = fl % 4, tN = Math.max(0, Math.min(1, sv - fl));
  return { k, tN, mode: ['mix', 'mix', 'fall', 'bud'][k], snow: k === 2 ? Math.max(0, (tN - 0.5) * 2) : k === 3 ? 1 - tN : 0, twig: (k === 2 && tN > 0.02) || k === 3, leaves: !(k === 3 && tN <= 0) };
}
function plantFrame(ctx, w, Lw, Lh) {
  const p = w.props, g = w.state.g | 0, steps = plSteps(p), now = performance.now() / 1000;
  const tS = plSeasonIdx(w), vis = plVis(w.id, g, tS, Math.max(0, +p.fade), now), gv = vis.g, s = Math.min(1, gv / steps), ss = plSeasonState(vis.s), base = PAL[p.species] || PAL.tree;
  const palOf = k => k === 1 ? PALX.summer : k === 2 ? PAL.autumn : base;
  const palA = ss.k < 0 ? base : palOf(ss.k), palB = ss.k < 0 ? base : palOf((ss.k + 1) % 4);
  const L = plLayout(p, Lw, Lh), gy = L.gy, cx = L.cx, snowy = ss.snow > 0.5;
  const rect = (x, y, ww, hh, c, a) => { ctx.globalAlpha = a === undefined ? 1 : a; ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), ww, hh); ctx.globalAlpha = 1; };
  const px = (x, y, c, a) => rect(x, y, 1, 1, c, a);
  const disc = (x, y, r, c) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + 1) px(x + i, y + j, c); };
  const u = key => p.decor && g >= plThr(p, ORDER.indexOf(key));
  const D = key => L.decor[ORDER.indexOf(key)];
  const away = x => Math.min(Lw - 3, Math.max(2, Math.abs(x - cx) < 5 ? x + (x >= cx ? 6 : -6) : x));
  const sprite = (def, x0, baseY, flip, cmap) => { const rows = def.r, wd = rows[0].length, h = rows.length, cm = cmap || def.c; for (let j = 0; j < h; j++) for (let i = 0; i < wd; i++) { const ch = rows[j][flip ? wd - 1 - i : i]; if (ch !== '.' && cm[ch]) px(x0 + i - (wd >> 1), baseY - h + j, cm[ch]); } };
  const wander = (idx, cycle, frac) => { const n = Math.floor(now / cycle), ph = (now % cycle) / cycle, sc = [0.18, 0.82, 0.5, 0.3, 0.7][idx - 1] * Lw, r = k => Math.min(Lw - 7, Math.max(6, sc + (hsh(k, idx, 23) - 0.5) * 2 * Lw * 0.3)), a = r(n - 1), b = r(n), mv = ph < frac; return { x: a + (b - a) * (mv ? ease(ph / frac) : 1), dir: b >= a ? 1 : -1, mv }; };
  ctx.clearRect(0, 0, Lw, Lh);
  const phase = p.sky === 'none' ? 'none' : skyPhase(p.sky), night = phase === 'night', dim = night || phase === 'dawn' || phase === 'sunset';
  if (phase !== 'none') {
    const bands = SKY[phase], bh = gy / bands.length;
    bands.forEach((c, i) => rect(0, Math.floor(i * bh), Lw, Math.ceil(bh) + 1, c));
    if (night) L.stars.forEach(st => px(st.x, st.y, '#ffffff', 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 1.3 + st.ph))));
    const sx = Math.round(Lw * (phase === 'dawn' ? 0.22 : 0.78)), sy = phase === 'sunset' || phase === 'dawn' ? Math.round(gy * 0.78) : Math.round(gy * 0.07) + 4;
    if (night) { disc(sx, sy, 3, '#f4f1d0'); disc(sx + 2, sy - 1, 3, SKY.night[0]); }
    else disc(sx, sy, 3, phase === 'day' ? '#fff2a8' : '#ffd27a');
    if (!night) L.clouds.forEach(c => { const x = Math.round(((c.x0 + now * c.sp) % (Lw + 14)) - 7), cc = dim ? '#f3d9d0' : '#ffffff', sh = dim ? '#d9b5b0' : '#d5e6f3'; rect(x + 1, c.y, 4, 1, cc); rect(x, c.y + 1, 6, 1, cc); rect(x + 1, c.y + 2, 4, 1, sh); });
  }
  // 地面
  const gH = Lh - gy;
  rect(0, gy, Lw, gH, '#5a3d28'); rect(0, gy, Lw, 1, '#6dbb4e'); rect(0, gy + 1, Lw, 1, '#3f8a3a');
  for (let x = 0; x < Lw; x++) {
    for (let r = 2; r < gH; r++) { const v = hsh(x, r, 7); if (v < 0.12) px(x, gy + r, '#47301f'); else if (v < 0.22) px(x, gy + r, '#6e4a31'); }
    if (ss.snow < 0.3 && hsh(x, 0, 5) < 0.16) px(x, gy - 1, '#4f9d3f');
    if (ss.snow > 0 && hsh(x, 0, 15) < ss.snow * 1.15) { px(x, gy, '#f2f8ff'); px(x, gy + 1, hsh(x, 1, 16) < 0.5 ? '#f2f8ff' : '#cfe0f2'); if (ss.snow > 0.7 && hsh(x, 2, 17) < 0.5) px(x, gy - 1, '#f2f8ff'); }
  }
  // 地面のデコレーション
  if (u('fence')) { const x0 = Math.min(2, Lw - 16), n = Math.min(14, Math.floor(Lw / 3)); rect(x0, gy - 2, n, 1, '#8a6238'); for (let i = 0; i <= n; i += 3) rect(x0 + i, gy - 4, 1, 4, '#b98a52'); if (snowy) rect(x0, gy - 3, n, 1, '#f2f8ff'); }
  if (u('stone')) { const x = away(D('stone').x); rect(x, gy - 1, 3, 1, '#8a8f99'); px(x + 1, gy - 2, '#a9aeb8'); px(x + 2, gy - 1, '#5f646e'); if (snowy) px(x + 1, gy - 3, '#f2f8ff'); }
  if (u('mush')) { const x = away(D('mush').x); rect(x - 1, gy - 3, 3, 1, '#d94a3d'); rect(x - 2, gy - 2, 5, 1, '#d94a3d'); px(x, gy - 3, '#fff'); px(x + 1, gy - 2, '#fff'); px(x, gy - 1, '#f2e8d5'); }
  if (u('flower') && ss.snow < 0.5) {
    const FL = ['#ff8fb1', '#ffe066', '#ffffff', '#b79bff'], d = D('flower');
    [0, 4, 9].forEach((o, i) => { const x = away(d.x + o), h = 2 + (i % 2), c = FL[(d.c + i) % 4]; for (let j = 0; j < h; j++) px(x, gy - 1 - j, '#3c8f3a'); const y = gy - 1 - h; px(x - 1, y, c); px(x + 1, y, c); px(x, y - 1, c); px(x, y, '#fff6a0'); });
  }
  // 木
  let ccx = cx, ccy = gy - 4, top = null, cls = null, cAmt = 0;
  const colTop = new Array(Lw).fill(1e9);
  if (g <= 0 && gv < 0.05) { rect(cx - 1, gy - 1, 2, 1, '#5b3a22'); px(cx - 1, gy - 1, '#80573a'); }
  else {
    const U = L.U, Hc = L.Hc, T = base.trunk;
    const sg = ease(Math.min(1, s / 0.8)), th = Math.round(2 + (L.TH - 2) * sg), c = ease(Math.max(0, Math.min(1, (s - 0.06) / 0.94)));
    const sway = Math.sin(now * 0.9) * 0.6 + Math.sin(now * 0.37) * 0.5;
    const tx = y => cx + Math.round(Math.sin(y * 0.1 + L.wob) * 1.0);
    const line = (x0, y0, x1, y1, thick, col) => { const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; px(x, y, col); if (thick && k < n * 0.6) px(x + 1, y, col); } };
    const wb = Math.max(3, Math.min(7, Math.round(U * 0.075))) * (0.4 + 0.6 * sg);
    for (let i = 0; i < th; i++) {
      const y = gy - 1 - i, wd = Math.max(2, Math.round(wb * (1 - 0.4 * i / th))), x0 = Math.round(tx(y) - wd / 2), fl = Math.max(0, 2 - i), xa = x0 - fl, xb = x0 + wd + fl - 1;
      for (let x = xa; x <= xb; x++) { let col = x === xa ? T[2] : x === xb ? T[0] : T[1]; if (col === T[1] && hsh(x, y, 12) < 0.14) col = T[0]; px(x, y, col); }
    }
    const forkY = gy - th;
    ccx = cx; ccy = Math.round(forkY - Hc * c * 0.5); cAmt = c;
    if (c < 0.12) {
      const x = tx(forkY), pl = palA;
      px(x, forkY - 1, pl.leaf[1]); px(x - 1, forkY - 1, pl.leaf[2]); px(x + 1, forkY - 1, pl.leaf[3]); px(x - 2, forkY - 2, pl.leaf[1]); px(x + 2, forkY - 2, pl.leaf[2]);
    } else {
      const cl = L.clumps.map(k => ({ k, x: cx + Math.round(k.ex * U * c + sway * (0.4 + k.ey)), y: Math.round(forkY - k.ey * Hc * c - 2), r: k.r * U * (0.2 + 0.8 * c) }));
      cls = cl;
      const starts = L.limbs.map(l => { const ay = gy - Math.max(1, Math.round(th * l.t)); return { x: tx(ay), y: ay }; });
      L.limbs.forEach((l, i) => { line(starts[i].x, starts[i].y, cl[i].x, cl[i].y, true, T[1]); line(starts[i].x, starts[i].y + 1, cl[i].x, cl[i].y + 1, false, T[0]); });
      if (ss.twig) {
        cl.forEach(o => { for (let j = 0; j < 4; j++) { const a = ((o.k.id * 0.37 + j * 1.6) % 6.28), len = Math.max(2, o.r * 0.9); line(o.x, o.y, o.x + Math.cos(a) * len, o.y + Math.sin(a) * len * 0.9, false, T[1]); } });
        if (ss.snow > 0.3) cl.forEach(o => { px(o.x, o.y - 1, '#f4f9ff'); px(o.x + 1, o.y - 1, '#f4f9ff'); });
      }
      if (ss.leaves) {
        const full = u('fruit') && ss.snow < 0.5;
        cl.slice().sort((a, b) => a.k.ey - b.k.ey).forEach(o => {
          const kx = o.x, ky = o.y, kr = o.r, id = o.k.id; if (kr < 1.5) return;
          const rr = a => kr * (1 + 0.16 * Math.sin(3 * a + id) + 0.1 * Math.sin(5 * a + id * 1.7));
          const inn = (x, y) => { const dx = x - kx, dy = (y - ky) * 1.05, r2 = rr(Math.atan2(dy, dx)); return dx * dx + dy * dy <= r2 * r2; };
          for (let y = Math.floor(ky - kr * 1.4); y <= Math.ceil(ky + kr * 1.4); y++) for (let x = Math.floor(kx - kr * 1.4); x <= Math.ceil(kx + kr * 1.4); x++) {
            if (x < 0 || x >= Lw || !inn(x, y)) continue;
            const q = Math.min(1, 0.65 * hsh(x >> 1, y >> 1, 20) + 0.35 * hsh(id, 0, 22));
            let pl = palA;
            if (ss.mode === 'mix') { if (q < ss.tN) pl = palB; }
            else if (ss.mode === 'fall') { if (q < ss.tN) continue; }
            else if (ss.mode === 'bud') { if (q >= ss.tN) continue; }
            const l = ((kx - x) * 0.5 + (ky - y) * 0.8) / kr, v = l + (BAY[(x & 1) + ((y & 1) << 1)] - 0.5) * 0.35 + (hsh(x, y, 0) - 0.5) * 0.2;
            let tone = v > 0.45 ? 3 : v > 0 ? 2 : v > -0.5 ? 1 : 0;
            if (hsh(x >> 1, y >> 1, 6) < 0.16) tone = Math.min(3, tone + 1); else if (hsh(x >> 1, y >> 1, 7) < 0.1) tone = Math.max(1, tone - 1);
            const edge = !inn(x + 1, y) || !inn(x, y + 1);
            if (edge) tone = 0; else if (hsh(x, y, 1) < 0.05 && Math.sin(now * 1.5 + hsh(x, y, 2) * 20) > 0.92) tone = 3;
            let col = pl.leaf[tone];
            if (pl.bloom && tone > 0 && hsh(x, y, 3) < (full ? 0.22 : 0.12) * s) col = pl.bloom;
            px(x, y, col);
            if (full && !pl.bloom && tone > 0 && hsh(x, y, 4) < 0.012) rect(x, y, 2, 2, pl.fruit);
            if (y < colTop[x]) colTop[x] = y;
          }
        });
      }
      // 電飾(冬)
      if (ss.snow > 0.15) {
        const cols = ['#ff5a5a', '#ffd84a', '#5ab8ff', '#7dff8a'], pts = [];
        L.limbs.forEach((l, i) => { const a = starts[i], b = cl[i], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4)); for (let k = 1; k <= n; k++) pts.push({ x: a.x + (b.x - a.x) * k / n + 1, y: a.y + (b.y - a.y) * k / n }); });
        const show = Math.ceil(pts.length * Math.min(1, (ss.snow - 0.15) * 1.5));
        pts.slice(0, show).forEach((q, i) => { const a = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * 2.2 + i * 1.3)), col = cols[(i + Math.floor(now * 0.8)) % 4]; if (dim) rect(q.x - 1, q.y - 1, 3, 3, col, 0.18 * a); px(q.x, q.y, col, a); });
      }
      const bx = Math.min(Lw - 1, Math.max(0, Math.round(cx + U * 0.12)));
      top = colTop[bx] < 1e9 ? { x: bx, y: colTop[bx] } : { x: cl[4].x, y: cl[4].y };
    }
  }
  // 雪だるま
  if (ss.snow > 0.6) { const x = Math.min(Lw - 4, cx + Math.max(10, Math.round(Lw * 0.22))); disc(x, gy - 3, 2, '#f6faff'); px(x + 2, gy - 2, '#cfe0f2'); px(x + 1, gy - 1, '#cfe0f2'); disc(x, gy - 6, 1, '#f6faff'); px(x + 1, gy - 5, '#cfe0f2'); rect(x - 1, gy - 5, 3, 1, '#d9473d'); px(x - 1, gy - 6, '#222'); px(x + 1, gy - 6, '#222'); px(x + 2, gy - 6, '#ff8a3d'); rect(x - 1, gy - 8, 3, 1, '#2a2a30'); rect(x - 2, gy - 7, 5, 1, '#2a2a30'); px(x, gy - 3, '#333'); }
  // 動物
  if (u('bunny')) { const a = wander(1, 6, 0.35), hop = a.mv ? Math.round(Math.abs(Math.sin(now * 9)) * 2.2) : 0, cm = snowy ? Object.assign({}, SPR.bunny.c, { b: '#eef1f6', f: '#c9d0da' }) : null; sprite(SPR.bunny, Math.round(a.x), gy - hop, a.dir < 0, cm); }
  if (u('squirrel') && !snowy) { const a = wander(2, 8, 0.3); sprite(SPR.squirrel, Math.round(a.x), gy, a.dir < 0); }
  if (u('hedgehog') && !snowy) { const a = wander(3, 16, 0.2); sprite(SPR.hedgehog, Math.round(a.x), gy, a.dir < 0); }
  if (u('fox')) { const a = wander(4, 22, 0.45); sprite(SPR.fox, Math.round(a.x), gy - (a.mv && Math.floor(now * 6) % 2 ? 1 : 0), a.dir < 0); }
  if (u('deer')) { const a = wander(5, 28, 0.4); sprite(SPR.deer, Math.round(a.x), gy - (a.mv && Math.floor(now * 4) % 2 ? 1 : 0), a.dir < 0); }
  if (u('owl') && cls && cAmt >= 0.5) { const o = cls[0], awake = dim; sprite(awake ? SPR.owl : SPR.owlz, o.x, o.y + 3, false, awake ? Object.assign({}, SPR.owl.c, { K: '#ffd84a' }) : null); }
  if (phase !== 'none' && night) { ctx.globalCompositeOperation = 'source-atop'; rect(0, 0, Lw, Lh, '#0a1030', 0.3); ctx.globalCompositeOperation = 'source-over'; }
  // 花びら・落ち葉・雪
  let pn = 0, pp = palA;
  if (ss.k < 0) pn = base.petals && s > 0.5 ? Math.round(12 * s) : 0;
  else if (ss.k === 0) { pn = base.petals ? Math.round(12 * (1 - ss.tN)) : 0; pp = base; }
  else if (ss.k === 2) { pn = Math.round(10 + 14 * ss.tN); pp = PAL.autumn; }
  else if (ss.k === 3) { pn = base.petals ? Math.round(10 * ss.tN) : 0; pp = base; }
  for (let i = 0; i < pn; i++) { const x = (hsh(i, 0, 9) * Lw + Math.sin(now * 0.7 + i) * 4 + Lw * 4) % Lw, y = (now * 3 + hsh(i, 1, 9) * gy) % gy; px(x, y, i % 2 ? pp.leaf[3] : pp.leaf[2]); }
  for (let i = 0, n = Math.round(30 * Math.min(1, ss.snow * 1.3)); i < n; i++) { const x = (hsh(i, 0, 13) * Lw + Math.sin(now * 0.8 + i) * 2 + Lw * 4) % Lw, y = (now * 4 + hsh(i, 1, 13) * gy) % gy; px(x, y, '#ffffff', 0.9); }
  // 空を舞うもの
  if (u('lantern')) { const x = Math.max(2, Lw - 6); rect(x, gy - 5, 1, 5, '#4a4a52'); rect(x - 1, gy - 7, 3, 2, dim ? '#ffd166' : '#c9a24a'); if (dim) for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (i * i + j * j <= 16) px(x + i, gy - 6 + j, '#ffd166', 0.07); }
  if (u('fly') && !night && ss.snow < 0.5) { const d = D('fly'), bx = cx + Math.sin(now * 0.7 + d.c) * Lw * 0.33, by = gy * 0.72 + Math.sin(now * 1.3) * gy * 0.05, f = Math.floor(now * 5) % 2, col = ['#ff9f43', '#6ec3ff', '#ff7fb0'][d.c]; px(bx, by, '#3a2a2a'); px(bx - 1, by - f, col); px(bx + 1, by - f, col); }
  if (u('bird') && top) { const hop = Math.floor(now * 0.6) % 8 === 0 ? 1 : 0, bx = top.x, by = top.y - hop; rect(bx - 1, by - 2, 3, 2, '#5a7fd6'); px(bx + 2, by - 3, '#7fa0ea'); px(bx + 3, by - 3, '#ffb347'); px(bx - 2, by - 1, '#3f5fb0'); px(bx + 1, by - 3, '#7fa0ea'); }
  if (u('firefly') && dim && ss.snow < 0.5) for (let i = 0; i < 8; i++) {
    const x = (D('firefly').x + i * Lw / 8 + Math.sin(now * 0.5 + i * 1.7) * 6 + Lw) % Lw, y = gy - 6 - ((i * 53) % Math.max(8, Math.floor(gy * 0.25))) + Math.sin(now * 0.8 + i) * 3, a = 0.3 + 0.7 * Math.max(0, Math.sin(now * 2.1 + i * 2.3));
    rect(x - 1, y - 1, 3, 3, '#fff3a0', a * 0.18); px(x, y, '#fff3a0', a);
  }
  // 水やりの演出
  const fx = plFx(w.id), keep = [];
  for (const f of fx) {
    if (f.k === 'drop') {
      const yf = (now - f.t0 - f.dl) * 0.9;
      if (yf < 0) { keep.push(f); continue; }
      if (yf >= 1) { keep.push({ k: 'sp', xf: f.xf, t0: now }); continue; }
      rect(f.xf * Lw, yf * gy, 1, 2, '#6cc3ff'); keep.push(f);
    } else if (f.k === 'sp') {
      const a = (now - f.t0) / 0.45; if (a >= 1) continue;
      const x = Math.round(f.xf * Lw), r = Math.round(a * 3), y = gy - 1 - Math.round(Math.sin(a * 3) * 2);
      px(x - r, y, '#bfe7ff'); px(x + r, y, '#bfe7ff'); keep.push(f);
    } else if (f.k === 'burst') {
      const a = (now - f.t0) / 0.9; if (a < 0) { keep.push(f); continue; } if (a >= 1) continue;
      for (let i = 0; i < 8; i++) { const ang = i * 0.785 + a, r = 3 + a * 10; px(ccx + Math.cos(ang) * r, ccy + Math.sin(ang) * r * 0.8, '#fff6a0', 1 - a); }
      keep.push(f);
    }
  }
  fx.length = 0; keep.forEach(k => fx.push(k));
}

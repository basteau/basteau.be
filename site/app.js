import { defineSound } from './audio.js';
import { ICONS } from './icons.js';
import { TECH, PALETTE, COLORS, deal, shapeOf, glyph } from './board.js';

const root = document.documentElement;
// layout viewport (unlike innerWidth it never grows with overflowing content)
const vw = () => root.clientWidth, vh = () => root.clientHeight;
const $ = s => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

/* =====================================================================
   sound: @web-kits/audio definitions, following the create-sound recipe
   (click/tap <= 0.1s, toggles two notes 25ms apart, success as an arpeggio,
   layer gains summing under ~0.6). Nothing plays until the visitor acts.
   ===================================================================== */
let soundOn = store.get('basteau:sound', 'on') === 'on';
// C-major pentatonic ladder: every match climbs one step, so a whole game plays a little melody
const LADDER = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.32];
const blip = (f, d, g, delay = 0) => ({ source: { type: 'sine', frequency: f }, envelope: { attack: 0, decay: d, sustain: 0, release: .006 }, gain: g, delay });
const SFX = {
  // a tile sounds like it looks: its colour picks the note (pentatonic, so any run of flips stays consonant),
  // its shape picks the timbre (round = soft sine pop, square = woody, squircle = softer wood, pebble = rounded knock,
  // quarter/dome/leaf = small bells)
  flip: ([color, kind]) => {
    const f = { magenta: 1046.5, cyan: 1318.51, orange: 1567.98, violet: 1760 }[color];
    const env = { attack: 0, decay: .03, sustain: 0, release: .012 };
    const timbre = {
      circle: { source: { type: 'sine', frequency: { start: f * .75, end: f } }, envelope: env, gain: .12 },
      ring: { source: { type: 'sine', frequency: { start: f * .75, end: f } }, envelope: env, gain: .11 },
      square: { source: { type: 'triangle', frequency: f * .5 }, envelope: { ...env, decay: .024 }, filter: { type: 'lowpass', frequency: 2400 }, gain: .14 },
      quarter: { source: { type: 'sine', frequency: f, fm: { ratio: 1.41, depth: 260 } }, envelope: { ...env, decay: .04 }, gain: .08 },
      dome: { source: { type: 'sine', frequency: f, fm: { ratio: 2, depth: 180 } }, envelope: { ...env, decay: .04 }, gain: .08 },
      leaf: { source: { type: 'sine', frequency: f, fm: { ratio: 3.5, depth: 140 } }, envelope: { ...env, decay: .045 }, gain: .07 },
      squircle: { source: { type: 'triangle', frequency: f * .5 }, envelope: { ...env, decay: .03 }, filter: { type: 'lowpass', frequency: 1700 }, gain: .15 },
      pebble: { source: { type: 'sine', frequency: { start: f * .9, end: f }, fm: { ratio: 1.5, depth: 90 } }, envelope: { ...env, decay: .035 }, gain: .1 },
    }[kind];
    return defineSound(timbre);
  },
  unflip: defineSound({ source: { type: 'sine', frequency: { start: 900, end: 640 } },
                        envelope: { attack: 0, decay: .035, sustain: 0, release: .012 }, gain: .06 }),
  miss: defineSound({ source: { type: 'triangle', frequency: { start: 330, end: 247 } },
                      envelope: { attack: .002, decay: .09, sustain: 0, release: .03 }, filter: { type: 'lowpass', frequency: 1800 }, gain: .12 }),
  match: i => defineSound({ layers: [
      { source: { type: 'sine', frequency: { start: LADDER[i] * 1.012, end: LADDER[i] } }, envelope: { attack: .002, decay: .17, sustain: 0, release: .06 }, gain: .15 },
      { source: { type: 'sine', frequency: LADDER[i] * 2 }, envelope: { attack: .002, decay: .07, sustain: 0, release: .03 }, delay: .028, gain: .05 },
    ], effects: [{ type: 'reverb', decay: .35, damping: .5, mix: .1 }] }),
  win: defineSound({ layers: [523.25, 659.25, 783.99, 1046.5, 1318.51].map((f, i) => (
      { source: { type: 'sine', frequency: f }, envelope: { attack: .004, decay: .42, sustain: 0, release: .14 }, delay: i * .07, gain: .11 })),
    effects: [{ type: 'reverb', decay: .6, damping: .4, mix: .14 }] }),
  // tapping the name: a soft water drop (a sine that bends up, a touch of reverb)
  bloop: defineSound({ layers: [{ source: { type: 'sine', frequency: { start: 240, end: 620 } }, envelope: { attack: .002, decay: .14, sustain: 0, release: .05 }, gain: .14 }],
                       effects: [{ type: 'reverb', decay: .4, damping: .5, mix: .12 }] }),
  deal: defineSound({ layers: Array.from({ length: 6 }, (_, i) => blip(1700 + i * 140, .01, .035, i * .028)) }),
  toggleOn: defineSound({ layers: [blip(2093, .012, .1), blip(3136, .012, .1, .025)] }),
  toggleOff: defineSound({ layers: [blip(3136, .012, .1), blip(2093, .012, .1, .025)] }),
  // theme: a soft filtered-noise swell under the toggle pair; dark sweeps down, light sweeps up
  dusk: defineSound({ layers: [
      { source: { type: 'noise', color: 'pink' }, filter: { type: 'bandpass', frequency: 600, resonance: .9, envelope: { attack: .05, peak: 2600, decay: .32 } },
        envelope: { attack: .06, decay: .34, sustain: 0, release: .08 }, gain: .07 },
      blip(1568, .03, .06, .04), blip(1046.5, .05, .06, .09),
    ] }),
  dawn: defineSound({ layers: [
      { source: { type: 'noise', color: 'pink' }, filter: { type: 'bandpass', frequency: 900, resonance: .9, envelope: { attack: .05, peak: 4200, decay: .3 } },
        envelope: { attack: .06, decay: .32, sustain: 0, release: .08 }, gain: .06 },
      blip(1046.5, .03, .06, .04), blip(1568, .05, .06, .09),
    ] }),
};
const play = (name, arg, opts) => {
  if (!soundOn) return;
  try { (arg === undefined ? SFX[name] : SFX[name](arg))(opts); } catch {}
};

/* =====================================================================
   layout: a full-height 4 x 6 column beside the name on desktop, a 4 x 5
   board on top on phones. Cells stay square; everything else follows them.
   ===================================================================== */
function spec() {
  const W = vw(), H = vh(), m = W < 760;
  const [cols, rows] = m ? [4, 5] : [4, 6];
  const cell = Math.max(44, Math.floor(m ? Math.min((W - 30) / 4, H * .56 / 5) : Math.min((Math.max(H, 560) - 48) / 6, W * .42 / 4)));
  return { cols, rows, cell, holes: [], m, key: `${cols}x${rows}` };
}

/* =====================================================================
   game
   ===================================================================== */
const board = $('#board'), live = $('#live');
let S, cards = [], grid = [], open = [], pairs = 12, matched = 0, moves = 0, missTimer = 0, seed = Date.now() >>> 0, locked = false;

function newGame({ animate = true } = {}) {
  clearTimeout(missTimer); open = []; matched = 0; moves = 0; locked = false;
  $('#shuffle').removeAttribute('data-attn');
  S = spec();
  const model = deal(S.cols, S.rows, S.holes, seed = (seed * 31 + 7) >>> 0);
  pairs = model.pairs;
  board.textContent = '';
  board.style.setProperty('--cols', S.cols);
  grid = Array.from({ length: S.rows }, () => Array(S.cols).fill(null));
  cards = [];
  for (const m of model.cells) {
    const { x, y } = m;
    if (m.hole) {
      const t = document.createElement('div');
      t.className = 'score-tile'; t.setAttribute('aria-hidden', 'true');
      t.innerHTML = `<span class="n" data-n>00</span><span class="of">OF ${pairs}</span>`;
      board.append(t); grid[y][x] = { hole: true, el: t, x, y };
      continue;
    }
    const el = document.createElement('button');
    el.className = 'card'; el.type = 'button'; el.tabIndex = -1; el.dataset.state = 'down';
    el.setAttribute('role', 'gridcell'); el.setAttribute('aria-label', 'Hidden card');
    const P = PALETTE[m.color];
    el.style.cssText = `--c:${P.css};--up:${P.up};--tone:${P.tone};--ghost:${P.ghost}`;
    el.innerHTML = `<span class="inner"><span class="face back"></span><span class="face front">` +
      `<svg class="ghost" viewBox="${glyph(m.slug, 1).vb}" aria-hidden="true"><path d="${ICONS[m.slug]}"/></svg>` +
      `<svg class="glyph" viewBox="${glyph(m.slug, 1).vb}" aria-hidden="true"><path d="${ICONS[m.slug]}"/></svg></span></span>`;
    const c = { ...m, el, state: 'down' };
    if (c.kind === 'ring') el.classList.add('ring');
    el.addEventListener('click', e => onCard(c, e.detail === 0));
    board.append(el); grid[y][x] = c; cards.push(c);
  }
  cards[0].el.tabIndex = 0;
  root.style.setProperty('--of', pairs);
  document.querySelectorAll('[data-of]').forEach(n => { n.textContent = ` / ${pad(pairs)}`; });
  size(); score(false);
  if (animate) dealIn();
}

// lay everything out at the current viewport without touching game state
function size() {
  const W = vw();
  root.style.setProperty('--cell', S.cell + 'px');
  const cell = S.cell;
  for (const c of cards) {
    const st = c.el.style, { shape, done } = shapeOf(c, cell, S.cols, S.rows);
    st.setProperty('--shape', shape); st.setProperty('--shape-done', done);
    const g = glyph(c.slug, cell);
    st.setProperty('--gw', g.w.toFixed(1) + 'px'); st.setProperty('--gh', g.h.toFixed(1) + 'px');
    st.setProperty('--ox', g.ox.toFixed(2) + 'px'); st.setProperty('--oy', g.oy.toFixed(2) + 'px');
  }
  // the name fills the space left of the board (capped so it never shouts louder than the board)
  const name = $('#name');
  const avail = S.m ? W - 48 : W - 96 - 24 - 48 - S.cols * S.cell - 8, cap = S.m ? 104 : 200;
  name.style.fontSize = '100px';
  const w100 = name.getBoundingClientRect().width;
  root.style.setProperty('--name', Math.min(cap, Math.floor(100 * avail / w100)) + 'px');
  name.style.fontSize = '';
  water();
}

function dealIn() {
  if (reduce.matches) return;
  for (const c of cards) {
    c.el.querySelector('.back').animate(
      [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }],
      { duration: 380, delay: 120 + (c.x + c.y) * 34, easing: 'cubic-bezier(.23, 1, .32, 1)', fill: 'backwards' });
  }
}

function setState(c, state, instant) {
  c.state = state; c.el.dataset.state = state;
  c.el.setAttribute('aria-label', state === 'down' ? 'Hidden card' : state === 'up' ? c.name : `${c.name}, matched`);
  if (instant) { c.el.classList.add('instant'); requestAnimationFrame(() => requestAnimationFrame(() => c.el.classList.remove('instant'))); }
}

function onCard(c, keyboard) {
  if (c.state !== 'down' || locked) return;
  if (open.length === 2) settleMiss(true);              // a third card is interruptible: put the miss back at once
  setState(c, 'up', keyboard); open.push(c);
  play('flip', [c.color, c.kind], { jitter: { detune: 12 } });
  if (open.length === 2) {
    moves++;
    const [a, b] = open;
    if (a.name === b.name) { open = []; setTimeout(() => onMatch(a, b), keyboard || reduce.matches ? 0 : 300); }
    else missTimer = setTimeout(() => { play('miss'); settleMiss(false); }, 760);
  }
}

function settleMiss(now) {
  clearTimeout(missTimer);
  for (const c of open) setState(c, 'down', now);
  if (!now && open.length) setTimeout(() => play('unflip'), 120);
  open = [];
}

function onMatch(a, b) {
  setState(a, 'done'); setState(b, 'done');
  play('match', Math.min(matched, LADDER.length - 1));
  matched++; score(true);
  live.textContent = `${a.name}, matched. ${matched} of ${pairs}.`;
  for (const c of [a, b]) {
    const r = c.el.getBoundingClientRect();
    field.ripple(r.left + r.width / 2, r.top + r.height / 2, PALETTE[c.color].hex);
    if (reduce.matches) continue;
    c.el.querySelector('.front').animate([{ scale: 1 }, { scale: .93 }, { scale: 1 }],
      { duration: 420, delay: 180, easing: 'cubic-bezier(.23, 1, .32, 1)' });
    // riso registration: a partner-colour ghost slips off-register and snaps back as the glyph sinks in
    c.el.querySelector('.ghost').animate([{ opacity: 0, translate: '0 0' }, { opacity: .95, translate: '4px 3px', offset: .25 }, { opacity: 0, translate: '0 0' }],
      { duration: 640, delay: 160, easing: 'cubic-bezier(.23, 1, .32, 1)', composite: 'add' });
  }
  if (matched === pairs) setTimeout(() => onWin(b), 380);
}

function onWin(last) {
  play('win');
  live.textContent = `All ${pairs} pairs in ${moves} moves.`;
  $('#shuffle').setAttribute('data-attn', '');
  if (reduce.matches) return;
  // the board breathes once, outward from the last pair; the name answers with a little wave
  for (const c of cards) {
    const d = Math.hypot(c.x - last.x, c.y - last.y);
    c.el.animate([{ scale: 1 }, { scale: .94 }, { scale: 1 }], { duration: 520, delay: d * 55, easing: 'cubic-bezier(.23, 1, .32, 1)' });
  }
  [...$('#name').children].forEach((s, i) => s.animate(
    [{ transform: 'none' }, { transform: 'translateY(-.07em)' }, { transform: 'none' }],
    { duration: 560, delay: i * 45, easing: 'cubic-bezier(.77, 0, .175, 1)' }));
  const r = last.el.getBoundingClientRect();
  field.ripple(r.left + r.width / 2, r.top + r.height / 2, PALETTE.violet.hex, 1.8);
}

const pad = n => String(n).padStart(2, '0');
function score(animate) {
  water();
  document.querySelectorAll('[data-n]').forEach(n => {
    n.textContent = pad(matched);
    if (animate && !reduce.matches) n.animate([{ opacity: 0, transform: 'translateY(45%)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'none' }],
      { duration: 220, easing: 'cubic-bezier(.23, 1, .32, 1)' });
  });
}

function shuffle() {
  const btn = $('#shuffle');
  btn.classList.add('spin'); setTimeout(() => btn.classList.remove('spin'), 420);
  play('deal');
  const shown = cards.some(c => c.state !== 'down');
  clearTimeout(missTimer); open = []; locked = true;
  if (shown && !reduce.matches) {
    for (const c of cards) setState(c, 'down');
    setTimeout(() => newGame(), 320);
  } else newGame();
}

// arrows walk the grid (roving tabindex); Enter / Space flip through the button's own click
board.addEventListener('keydown', e => {
  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (!moves) return;
  const cur = cards.find(c => c.el === document.activeElement); if (!cur) return;
  e.preventDefault();
  let y = cur.y, x = cur.x;
  do { y += moves[0]; x += moves[1]; } while (grid[y]?.[x]?.hole);
  const next = grid[y]?.[x]; if (!next) return;
  cur.el.tabIndex = -1; next.el.tabIndex = 0; next.el.focus();
});

/* =====================================================================
   the ground: a 24px dot grid. Near the pointer the dots swell, pick up
   the logo colours and lean away; matches send a ring through the field.
   Touch screens get the same lens under the finger.
   ===================================================================== */
const field = (() => {
  const cv = $('#field'), ctx = cv.getContext('2d');
  const STEP = 24, pal = COLORS.map(c => PALETTE[c].hex);
  let W, H, dpr, base, running = false, last = 0;
  const p = { x: -999, y: -999, sx: -999, sy: -999, k: 0, on: false };
  const rings = [];
  function colors() { base = root.dataset.theme === 'dark' ? [255, 255, 255, .11] : [11, 11, 12, .16]; }
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = vw(); H = vh();
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(performance.now());
  }
  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    const R = W < 760 ? 96 : 124, push = reduce.matches ? 0 : 10;
    const [br, bg, bb, ba] = base;
    for (let y = STEP / 2, gy = 0; y < H + STEP; y += STEP, gy++) {
      for (let x = STEP / 2, gx = 0; x < W + STEP; x += STEP, gx++) {
        let e = 0, dx = 0, dy = 0, tint = null, te = 0;
        if (p.k > .001) {
          const ddx = x - p.sx, ddy = y - p.sy, d = Math.hypot(ddx, ddy);
          if (d < R) { const t = 1 - d / R; e = t * t * (3 - 2 * t) * p.k; if (d > 0) { dx += ddx / d * push * e; dy += ddy / d * push * e; } }
        }
        for (const r of rings) {
          const age = (now - r.t0) / 1000, rad = age * 640 * r.s, band = 70 * r.s;
          const ddx = x - r.x, ddy = y - r.y, d = Math.hypot(ddx, ddy), off = Math.abs(d - rad);
          if (off < band) { const w = (1 - off / band) * Math.max(0, 1 - age / (1.25 * r.s));
            if (d > 0) { dx += ddx / d * 7 * w; dy += ddy / d * 7 * w; }
            if (w > te) { te = w; tint = r.c; } }
        }
        const amt = Math.max(e, te);
        const rad = 1 + 3 * amt;
        if (amt > .1) {
          ctx.fillStyle = te > e ? tint : pal[(gx * 7 + gy * 13) % 4];
          ctx.globalAlpha = .18 + .82 * amt;
        } else { ctx.fillStyle = `rgb(${br} ${bg} ${bb})`; ctx.globalAlpha = ba; }
        ctx.beginPath(); ctx.arc(x + dx, y + dy, rad, 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    const a = 1 - Math.exp(-dt * 14), b = 1 - Math.exp(-dt * (p.on ? 9 : 5));
    if (p.sx < -900) { p.sx = p.x; p.sy = p.y; }
    p.sx += (p.x - p.sx) * a; p.sy += (p.y - p.sy) * a; p.k += ((p.on ? 1 : 0) - p.k) * b;
    for (let i = rings.length - 1; i >= 0; i--) if ((now - rings[i].t0) / 1000 > 1.25 * rings[i].s) rings.splice(i, 1);
    draw(now);
    const settled = Math.abs(p.x - p.sx) < .2 && Math.abs(p.y - p.sy) < .2 && (p.on ? p.k > .999 : p.k < .002);
    if (settled && !rings.length) { running = false; return; }
    requestAnimationFrame(tick);
  }
  function wake() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); } }
  addEventListener('pointermove', e => { p.x = e.clientX; p.y = e.clientY; p.on = true; wake(); }, { passive: true });
  addEventListener('pointerdown', e => { p.x = e.clientX; p.y = e.clientY; if (p.sx < -900 || e.pointerType !== 'mouse') { p.sx = p.x; p.sy = p.y; } p.on = true; wake(); }, { passive: true });
  addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') { p.on = false; wake(); } }, { passive: true });
  document.addEventListener('pointerleave', () => { p.on = false; wake(); });
  addEventListener('blur', () => { p.on = false; wake(); });
  colors(); resize();
  return {
    resize, recolor() { colors(); draw(performance.now()); },
    ripple(x, y, c, s = 1) { if (reduce.matches) return; rings.push({ x, y, c, s, t0: performance.now() }); wake(); },
  };
})();

/* =====================================================================
   chrome: sound, theme, contact
   ===================================================================== */
const soundBtn = $('#sound');
function paintSound() { soundBtn.setAttribute('aria-pressed', String(soundOn)); soundBtn.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Turn sound on'); }
soundBtn.addEventListener('click', () => {
  if (soundOn) { play('toggleOff'); soundOn = false; } else { soundOn = true; play('toggleOn'); }
  store.set('basteau:sound', soundOn ? 'on' : 'off'); paintSound();
});
paintSound();

const themeBtn = $('#theme');
function paintTheme() {
  const dark = root.dataset.theme === 'dark';
  themeBtn.setAttribute('aria-pressed', String(dark)); themeBtn.setAttribute('aria-label', dark ? 'Light mode' : 'Dark mode');
}
themeBtn.addEventListener('click', e => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  play(next === 'dark' ? 'dusk' : 'dawn');
  const apply = () => { root.dataset.theme = next; store.set('basteau:theme', next); paintTheme(); field.recolor(); };
  if (!document.startViewTransition || reduce.matches) { apply(); return; }
  // the new theme grows out of the button as a circle (an occasional action, so it gets a real moment)
  const r = themeBtn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const end = Math.hypot(Math.max(x, vw() - x), Math.max(y, vh() - y));
  document.startViewTransition(apply).ready.then(() => {
    root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
      { duration: 560, easing: 'cubic-bezier(.23, 1, .32, 1)', pseudoElement: '::view-transition-new(root)' });
  });
});
paintTheme();

$('#shuffle').addEventListener('click', shuffle);

// Say hello: open the mail app as usual, and also copy the address for visitors without one
const toast = $('#toast');
let toastTimer = 0;
$('#cta').addEventListener('click', () => {
  navigator.clipboard?.writeText('basteau@proton.me').then(() => {
    toast.querySelector('span').textContent = 'basteau@proton.me copied';
    toast.setAttribute('data-show', ''); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.removeAttribute('data-show'), 2600);
  }, () => {});
});

let rz = 0;
addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(() => {
    field.resize();
    const next = spec();
    if (next.key !== S.key) newGame({ animate: false });
    else { S = next; size(); }
  }, 80);
});

// e, a and u hold water (eau): each its own level, about half the x-height (wave speeds are in the CSS)
const WATER = [.48, .52, .44];
let splash = 0;
// where each surface sits: from the font's own metrics (baseline inside the .85 line box, x-height), lifted a little
// by game progress and by a splash when the name is tapped
function water() {
  const name = $('#name'), size = parseFloat(getComputedStyle(name).fontSize);
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `800 ${size}px Geist`;
  const m = ctx.measureText('x'), asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent, xh = m.actualBoundingBoxAscent;
  const baseline = (size * .85 - (asc + desc)) / 2 + asc;
  const lift = (pairs ? matched / pairs : 0) * .16 + splash;
  name.querySelectorAll('.w').forEach((w, k) => {
    const lvl = Math.min(.95, WATER[k] + lift);
    // the wave path's crest sits ~.02em below the top of its tile
    w.style.setProperty('--top', (baseline - xh * lvl - size * .02).toFixed(1) + 'px');
  });
}
// tap the name and the water splashes up, then settles
function slosh() {
  splash = .2; water(); play('bloop');
  setTimeout(() => { splash = 0; water(); }, 650);
}
$('#name').addEventListener('click', slosh);
$('#name').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); slosh(); } });

document.fonts.ready.then(() => newGame());

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
  drop(k) { try { localStorage.removeItem(k); } catch {} },
};

/* =====================================================================
   sound: @web-kits/audio definitions, following the create-sound recipe
   (click/tap <= 0.1s, toggles two notes 25ms apart, success as an arpeggio,
   layer gains summing under ~0.6). Nothing plays until the visitor acts.
   ===================================================================== */
// on by default, but off for visitors who ask for reduced motion (they can still turn it on)
let soundOn = store.get('basteau:sound', reduce.matches ? 'off' : 'on') === 'on';
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
  // (both stretched over the ~850ms reveal: the swell peaks a quarter in and fades with the edge, the second note
  // lands as the wash passes mid-screen)
  dusk: defineSound({ layers: [
      { source: { type: 'noise', color: 'pink' }, filter: { type: 'bandpass', frequency: 600, resonance: .9, envelope: { attack: .14, peak: 2400, decay: .6 } },
        envelope: { attack: .12, decay: .62, sustain: 0, release: .16 }, gain: .06 },
      blip(1568, .04, .055, .05), blip(1046.5, .07, .055, .24),
    ] }),
  dawn: defineSound({ layers: [
      { source: { type: 'noise', color: 'pink' }, filter: { type: 'bandpass', frequency: 900, resonance: .9, envelope: { attack: .14, peak: 3800, decay: .58 } },
        envelope: { attack: .12, decay: .6, sustain: 0, release: .16 }, gain: .055 },
      blip(1046.5, .04, .055, .05), blip(1568, .07, .055, .24),
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
  const W = vw(), H = vh(), m = W < 760 || (W < 1100 && H > W);   // same breakpoint as the CSS
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
    const el = document.createElement('button');
    el.className = 'card'; el.type = 'button'; el.tabIndex = -1; el.dataset.state = 'down';
    el.setAttribute('aria-label', 'Hidden card');
    const { vb } = glyph(m.slug, 1), mark = `viewBox="${vb}" aria-hidden="true"><path d="${ICONS[m.slug]}"/></svg>`;
    // breathing: 94.5-96.5% deep, a 3.5-6s period and a random start, per tile
    const bp = 3.5 + Math.random() * 2.5;
    el.style.cssText = `--bs:${(.945 + Math.random() * .02).toFixed(3)};--bp:${bp.toFixed(2)}s;--bd:${(-Math.random() * bp).toFixed(2)}s`;
    el.innerHTML = `<span class="inner"><span class="face back"></span><span class="face front">` +
      `<svg class="ghost" ${mark}<svg class="glyph" ${mark}</span></span>`;
    const c = { ...m, el, state: 'down' };
    paint(c, c.color);
    if (c.kind === 'ring') el.classList.add('ring');
    el.addEventListener('click', e => onCard(c, e.detail === 0));
    board.append(el); grid[y][x] = c; cards.push(c);
  }
  cards[0].el.tabIndex = 0;
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
    const st = c.el.style;
    cutCard(c);
    const g = glyph(c.slug, cell);
    st.setProperty('--gw', g.w.toFixed(1) + 'px'); st.setProperty('--gh', g.h.toFixed(1) + 'px');
    st.setProperty('--ox', g.ox.toFixed(2) + 'px'); st.setProperty('--oy', g.oy.toFixed(2) + 'px'); st.setProperty('--sw', g.sw);
  }
  // the name fills the space left of the board (capped so it never shouts louder than the board)
  const name = $('#name');
  const avail = S.m ? W - 48 : W - 96 - 24 - 48 - S.cols * S.cell - 8;
  // phones 104px, portrait tablets up to 150px, desktop 200px growing to 260px on tall screens beside a bigger board
  const cap = S.m ? (W < 760 ? 104 : 150) : Math.round(Math.min(260, Math.max(200, vh() * .22)));
  name.style.fontSize = '100px';
  const w100 = name.getBoundingClientRect().width;
  root.style.setProperty('--name', Math.min(cap, Math.floor(100 * avail / w100)) + 'px');
  name.style.fontSize = '';
  water();
}

// a tile's back cut and its face plate, from its radii and gaps at the current cell size
function cutCard(c) {
  const { shape, done } = shapeOf(c, S.cell);
  c.el.style.setProperty('--shape', shape); c.el.style.setProperty('--shape-done', done);
}

/* every few seconds, while nobody is playing, one tile turns a quarter: any shape whose corners show the swing (a
   circle or ring would look still), never a flip (nothing gets revealed), no sound (nothing plays unprompted), and
   off for reduced motion. The tile rotates 90deg clockwise as one rigid piece and then settles as its next
   orientation: its radii and gaps turn with it, swapped in the same frame the rotation is dropped, so nothing about
   the shape changes on the way (edge tiles too: every side has its gap). The last few tiles sit out the draw, so
   the turns wander the board */
const idle = c => c.state === 'down' && !c.turning;
const TURNS = new Set(['quarter', 'dome', 'leaf', 'pebble', 'square', 'squircle']);
let lastInput = 0;
addEventListener('pointerdown', () => { lastInput = performance.now(); }, { passive: true });
addEventListener('keydown', () => { lastInput = performance.now(); });
// a random pick (a card or a pair) from the pool, skipping recently used cards while there's anything else to pick
function draw(pool, recent, keep) {
  const fresh = pool.filter(x => ![x].flat().some(c => recent.includes(c)));
  const from = fresh.length ? fresh : pool, x = from[Math.floor(Math.random() * from.length)];
  if (x) { recent.push(...[x].flat()); recent.splice(0, recent.length - keep); }
  return x;
}
const turned = [];
function idleTurn() {
  setTimeout(idleTurn, 1500 + Math.random() * 1000);
  if (!S || reduce.matches || document.hidden || open.length || locked || performance.now() - lastInput < 2500) return;
  const c = draw(cards.filter(c => idle(c) && TURNS.has(c.kind)), turned, 4); if (!c) return;
  c.turning = true;
  const spin = c.el.querySelector('.back').animate([{ rotate: '0deg' }, { rotate: '90deg' }],
    { duration: 900, easing: 'cubic-bezier(.77, 0, .175, 1)', fill: 'forwards' });
  spin.onfinish = () => {
    const [r, j] = [c.radius, c.jitter];
    c.radius = [r[3], r[0], r[1], r[2]]; c.jitter = [j[3], j[0], j[1], j[2]];   // tl tr br bl, t r b l: all a step clockwise
    cutCard(c); spin.cancel(); c.turning = false;
  };
}
setTimeout(idleTurn, 3000);

/* and, on its own clock, two touching face-down tiles of different colours trade colours: the same quiet rules as the
   turn. The whole palette moves with the colour (face, mark tones, flip sound, ripple), so a card flipped later
   belongs to its new tile. The crossfade runs on the computed colours, so a theme switch never animates the board */
const OKLAB = CSS.supports('color', 'color-mix(in oklab, red, blue)');
function paint(c, color) {
  const P = PALETTE[c.color = color], st = c.el.style;
  st.setProperty('--c', P.css); st.setProperty('--up', P.up); st.setProperty('--tone', P.tone); st.setProperty('--ghost', P.ghost);
}
const swapped = [];
function idleSwap() {
  setTimeout(idleSwap, 1800 + Math.random() * 1200);
  if (!S || reduce.matches || document.hidden || open.length || locked || performance.now() - lastInput < 2500) return;
  const near = [];   // every touching pair (right and below neighbours) of idle tiles that differ in colour
  for (const a of cards) {
    if (!idle(a)) continue;
    for (const b of [grid[a.y][a.x + 1], grid[a.y + 1]?.[a.x]]) if (b && idle(b) && b.color !== a.color) near.push([a, b]);
  }
  const pair = draw(near, swapped, 4); if (!pair) return;
  const colors = pair.map(c => c.color).reverse();
  pair.forEach((c, i) => {
    const back = c.el.querySelector('.back'), from = getComputedStyle(back).backgroundColor;
    paint(c, colors[i]);
    const to = getComputedStyle(back).backgroundColor;
    // stepped through OKLab: a straight sRGB fade sags to mud halfway (orange to violet passes a dull brown)
    const steps = OKLAB ? [0, 25, 50, 75, 100].map(p => `color-mix(in oklab, ${to} ${p}%, ${from})`) : [from, to];
    back.animate(steps.map(backgroundColor => ({ backgroundColor })), { duration: 700, easing: 'cubic-bezier(.45, 0, .55, 1)' });
  });
}
setTimeout(idleSwap, 4500);

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
  if (open.length === 2) settleMiss(true);              // a third card is interruptible: the miss turns back at once
  setState(c, 'up', keyboard); open.push(c);
  play('flip', [c.color, c.kind], { jitter: { detune: 12 } });
  if (open.length === 2) {
    moves++;
    const [a, b] = open;
    if (a.name === b.name) { open = []; setTimeout(() => onMatch(a, b), keyboard || reduce.matches ? 0 : 300); }
    else missTimer = setTimeout(() => { play('miss'); settleMiss(false); }, 760);
  }
}

// now: the visitor already moved on, so skip the wait (and the unflip sound) but still let the cards turn back
function settleMiss(now) {
  clearTimeout(missTimer);
  for (const c of open) setState(c, 'down');
  if (!now && open.length) setTimeout(() => play('unflip'), 120);
  open = [];
}

function onMatch(a, b) {
  if (!a.el.isConnected) return;                       // the board was reshuffled in the meantime
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
  if (!last.el.isConnected) return;
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
  y += moves[0]; x += moves[1];
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
    // plain dots go into one path and one fill; only the few the lens or a ring touches are drawn on their own
    const plain = new Path2D(), lit = [];
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
        const amt = Math.max(e, te), rad = 1 + 3 * amt;
        if (amt > .1) lit.push(x + dx, y + dy, rad, te > e ? tint : pal[(gx * 7 + gy * 13) % 4], .18 + .82 * amt);
        else { plain.moveTo(x + dx + rad, y + dy); plain.arc(x + dx, y + dy, rad, 0, 6.2832); }
      }
    }
    ctx.fillStyle = `rgb(${br} ${bg} ${bb})`; ctx.globalAlpha = ba; ctx.fill(plain);
    for (let i = 0; i < lit.length; i += 5) {
      ctx.fillStyle = lit[i + 3]; ctx.globalAlpha = lit[i + 4];
      ctx.beginPath(); ctx.arc(lit[i], lit[i + 1], lit[i + 2], 0, 6.2832); ctx.fill();
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
// the theme follows the system unless the visitor picks the other one; picking the system's own theme again clears
// the choice, so a later OS switch (say, automatic dark mode at night) carries the site with it
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const systemTheme = () => systemDark.matches ? 'dark' : 'light';
function setTheme(t) {
  root.dataset.theme = t; paintTheme(); field.recolor();
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = t === 'dark' ? '#0B0B0C' : '#FFFFFF'; });
}
systemDark.addEventListener('change', () => { if (!store.get('basteau:theme', null)) setTheme(systemTheme()); });
function paintTheme() {
  const dark = root.dataset.theme === 'dark';
  themeBtn.setAttribute('aria-pressed', String(dark)); themeBtn.setAttribute('aria-label', dark ? 'Light mode' : 'Dark mode');
}
themeBtn.addEventListener('click', e => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  play(next === 'dark' ? 'dusk' : 'dawn');
  const apply = () => {
    if (next === systemTheme()) store.drop('basteau:theme'); else store.set('basteau:theme', next);
    setTheme(next);
  };
  if (!document.startViewTransition || reduce.matches) { apply(); return; }
  // the new theme grows out of the button as a soft-edged circle (an occasional action, so it gets a real moment):
  // a radial mask whose size and position animate together, so its centre stays on the button and the feathered
  // edge (the last ~8% of the radius) washes over the page instead of cutting across it
  const r = themeBtn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const S = 2 * Math.hypot(Math.max(x, vw() - x), Math.max(y, vh() - y)) / .92;   // solid part covers the far corner
  const from = { size: '0px 0px', pos: `${x}px ${y}px` }, to = { size: `${S}px ${S}px`, pos: `${x - S / 2}px ${y - S / 2}px` };
  document.startViewTransition(apply).ready.then(() => {
    root.animate({
      maskSize: [from.size, to.size], maskPosition: [from.pos, to.pos],
      webkitMaskSize: [from.size, to.size], webkitMaskPosition: [from.pos, to.pos],
    }, { duration: 850, easing: 'cubic-bezier(.45, 0, .15, 1)', fill: 'both', pseudoElement: '::view-transition-new(root)' });
  }, () => {});   // a transition skipped by a quick second toggle (or a hidden tab) just applies the theme
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
  const ctx = water.ctx ??= document.createElement('canvas').getContext('2d');
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

document.fonts.ready.then(() => newGame());

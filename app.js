import { defineSound } from './audio.js';
import { ICONS } from './icons.js';
import { PALETTE, deal, shapeOf, glyph, stretch, drift } from './board.js';
import { root, vw, vh, reduce, strike, tick, player, wireSound, wireTheme } from './chrome.js';
import { createField } from './field.js';

const $ = s => document.querySelector(s);

/* =====================================================================
   sound: @web-kits/audio definitions, voiced to stay clear of the piercing
   2-5 kHz band: soft onsets, pure overtones, and the rarer the moment the
   louder it may be. All of it leaves through chrome.js's room and limiter.
   ===================================================================== */
// C-major pentatonic ladder: every match climbs one step, so a whole game plays a little melody
const LADDER = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
const SFX = {
  // a tile sounds like it looks: its colour picks the note (pentatonic, so any run of flips stays consonant),
  // its shape picks the timbre (round = soft sine pop, square = woody, squircle = softer wood, pebble = rounded knock,
  // quarter/dome/leaf = small bells)
  flip: ([color, kind]) => {
    const f = { magenta: 523.25, cyan: 659.25, orange: 783.99, violet: 880 }[color];
    const pop = gain => [{ source: { type: 'sine', frequency: { start: f * .78, end: f } }, envelope: { attack: .003, decay: .055, sustain: 0, release: .02 }, gain }];
    const voice = {
      circle: pop(.095),
      ring: pop(.095),
      square: strike(f * .5, .07, .087, { overtones: [[3.93, .2, .35]] }),
      squircle: strike(f * .5, .06, .094, { overtones: [[3.93, .1, .35]] }),
      pebble: strike(f * .5, .05, .1, { overtones: [[2.02, .3, .5]] }),
      quarter: strike(f, .09, .075, { overtones: [[2.76, .16, .5], [5.4, .04, .3]] }),
      dome: strike(f, .09, .075, { overtones: [[2, .2, .5], [3, .06, .3]] }),
      leaf: strike(f, .09, .075, { overtones: [[3.5, .14, .4]] }),
    }[kind];
    return defineSound({ layers: [tick(2000, .07), ...voice] });
  },
  unflip: defineSound({ source: { type: 'sine', frequency: { start: 520, end: 392 } },
                        envelope: { attack: .003, decay: .06, sustain: 0, release: .02 }, gain: .04 }),
  miss: defineSound({ source: { type: 'triangle', frequency: { start: 294, end: 220 } },
                      envelope: { attack: .004, decay: .12, sustain: 0, release: .03 }, filter: { type: 'lowpass', frequency: 1200 }, gain: .085 }),
  match: i => defineSound({ layers: strike(LADDER[i], .26, .075, { overtones: [[2, .16, .45], [3, .04, .3]] }) }),
  win: defineSound({ layers: [392, 523.25, 659.25, 783.99, 1046.5].flatMap((f, i) => strike(f, .55, .05, { delay: i * .075, overtones: [[2, .12, .4]] })) }),
  // tapping the name: a soft water drop (a sine that bends up)
  bloop: defineSound({ source: { type: 'sine', frequency: { start: 220, end: 560 } }, envelope: { attack: .003, decay: .12, sustain: 0, release: .03 }, gain: .09 }),
  // a reshuffle: six cards dealt, a little brighter each
  deal: defineSound({ layers: Array.from({ length: 6 }, (_, i) => tick(900 + i * 110, .3, i * .028)) }),
};
const play = player(SFX);

/* =====================================================================
   layout: a 4 x 6 column beside the name on desktop, a wide 5 x 4 board
   under the intro on phones and portrait tablets. Cells stay square;
   everything else follows them. Phones fold the board to its first row
   until it's played (the fold, below)
   ===================================================================== */
const page = $('.page'), wrap = $('.board-wrap');
// the CSS's own breakpoints, asked the same way (a window's width here includes a classic scrollbar, as in the CSS)
const PHONE = matchMedia('(max-width: 759px)'), COLUMN = matchMedia('(max-width: 759px), (max-width: 1099px) and (orientation: portrait)');
const SIDEWAYS = matchMedia('(min-width: 760px) and (max-height: 499px) and (orientation: landscape)');
function spec() {
  const W = vw(), H = vh(), m = COLUMN.matches;   // one column: phones and portrait tablets
  const PW = page.clientWidth;   // the page stops growing on very wide screens (index.html), and so does the board
  const low = SIDEWAYS.matches;   // a phone on its side: the wide board beside the intro, sized to the height
  const [cols, rows] = m || low ? [5, 4] : [4, 6];
  const cell = Math.max(44, Math.floor(m ? Math.min((W - 48) / 5, H * .4 / 4)   // phones: the full width inside the 24px gutters
    : low ? Math.min((H - 40 - 52) / 4, W * .42 / 5)   // (room for the bar under the board)
    : Math.min((Math.max(H, 600) - 64) * .72 / 6, PW * .28 / 4)));   // desktop: a column with air above and below
  return { cols, rows, cell, m, low, fold: PHONE.matches, key: `${cols}x${rows}` };
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
  const model = deal(S.cols, S.rows, [], seed = (seed * 31 + 7) >>> 0);
  pairs = model.pairs;
  board.textContent = '';
  root.style.setProperty('--cols', S.cols); root.classList.remove('won');
  grid = Array.from({ length: S.rows }, () => Array(S.cols).fill(null));
  cards = [];
  for (const m of model.cells) {
    const { x, y } = m;
    const el = document.createElement('button');
    el.className = 'card'; el.type = 'button'; el.tabIndex = -1; el.dataset.state = 'down';
    el.setAttribute('aria-label', 'Hidden card');
    const { vb } = glyph(m.slug, 1), mark = `viewBox="${vb}" aria-hidden="true"><path d="${ICONS[m.slug]}"/></svg>`;
    el.innerHTML = `<span class="skin"><span class="inner"><span class="face back"></span><span class="face front">` +
      `<svg class="ghost" ${mark}<svg class="glyph" ${mark}</span></span></span>`;
    const c = { ...m, el, skin: el.firstChild, state: 'down' };
    paint(c, c.color);
    if (c.kind === 'ring') el.classList.add('ring');
    el.addEventListener('click', e => onCard(c, e.detail === 0));
    board.append(el); grid[y][x] = c; cards.push(c);
  }
  cards[0].el.tabIndex = 0;
  document.querySelectorAll('[data-of]').forEach(n => { n.textContent = ` / ${pad(pairs)}`; });
  size(); score(false); fold();
  if (animate) dealIn();
  wrap.classList.add('dealt');   // the nudge waits for a board to point at
  breathe();
}

// lay everything out at the current viewport without touching game state
function size() {
  const PW = page.clientWidth;
  root.style.setProperty('--cell', S.cell + 'px');
  root.style.setProperty('--rows', S.rows);
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
  const cs = getComputedStyle(page), gutters = parseFloat(cs.paddingInlineStart) + parseFloat(cs.paddingInlineEnd);
  const avail = S.m ? PW - gutters : PW - gutters - parseFloat(cs.columnGap) - S.cols * S.cell - 8;
  // phones 104px, portrait tablets up to 150px, desktop 200px, growing with the height beside a bigger board
  const cap = S.m ? (S.fold ? 104 : 150) : Math.round(Math.max(200, vh() * .22));
  name.style.fontSize = '100px';
  const w100 = name.getBoundingClientRect().width;
  root.style.setProperty('--name', Math.min(cap, Math.floor(100 * avail / w100)) + 'px');
  name.style.fontSize = '';
  // the stack scale above runs exactly as wide as the name
  root.style.setProperty('--name-w', Math.round(name.getBoundingClientRect().width) + 'px');
  water();
}

// a tile's back cut and its face plate, from its radii and gaps at the current cell size
function cutCard(c) {
  const { shape, done } = shapeOf(c, S.cell);
  c.el.style.setProperty('--shape', shape); c.el.style.setProperty('--shape-done', done);
  c.el.style.setProperty('--round', c.radius.map(k => (k * S.cell).toFixed(2) + 'px').join(' '));   // for the focus ring
}

// a card nobody is playing with, still, and in view (the fold hides all but the first row)
const idle = c => c.state === 'down' && !c.turning && (!folded || c.y === 0);
let lastInput = 0;
addEventListener('pointerdown', () => { lastInput = performance.now(); }, { passive: true });
addEventListener('keydown', () => { lastInput = performance.now(); });
// a random pick from the pool, skipping recently used cards while there's anything else to pick
function draw(pool, recent, keep) {
  const fresh = pool.filter(c => !recent.includes(c));
  const from = fresh.length ? fresh : pool, x = from[Math.floor(Math.random() * from.length)];
  if (x) { recent.push(x); recent.splice(0, recent.length - keep); }
  return x;
}

/* now and then, while nobody is playing, one tile turns a quarter: any shape whose corners show the swing (a circle or
   ring would look still), never a flip (nothing gets revealed), no sound (nothing plays unprompted), and off for
   reduced motion. A calm rhythm, one every four to six seconds, so the board feels alive without asking for the eye.
   The tile rotates 90deg clockwise as one rigid piece and then settles as its next orientation: its radii and gaps
   turn with it, swapped in the same frame the rotation is dropped, so nothing about the shape changes on the way.
   The last few tiles sit out the draw, so the turns wander the board */
const TURNS = new Set(['quarter', 'dome', 'leaf', 'pebble', 'square', 'squircle']);
const turned = [];
function idleTurn() {
  setTimeout(idleTurn, 4000 + Math.random() * 2000);
  if (!S || reduce.matches || document.hidden || open.length || locked || peeking?.playState === 'running'
      || performance.now() - lastInput < 2500) return;
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
setTimeout(idleTurn, 5000);

/* the board is a game, and says so until it's been played: a handwritten nudge above it (index.html), and now and
   then a face-down card that lifts on its hinge and settles back, the way a real card gets nudged. Both stop on the
   first flip and come back on the next visit. The peek keeps the turn's quiet rules: never while playing, hidden or
   off-screen, never for reduced motion, and it only ever shows the card's back. It moves the card's own rotate, apart
   from the flip's transform, so a card clicked mid-peek flips at once while the lift eases out underneath */
let played = false, peeking = null;
function markPlayed() {
  if (played) return;
  played = true; root.classList.add('played');
  if (peeking?.playState !== 'running') return;
  const inner = peeking.effect.target, from = getComputedStyle(inner).rotate;
  peeking.cancel();
  inner.animate([{ rotate: from }, { rotate: 'y 0deg' }], { duration: 300, easing: 'cubic-bezier(.23, 1, .32, 1)' });
}
const peeked = [];
function peek() {
  setTimeout(peek, 6000 + Math.random() * 3000);
  if (played || !S || reduce.matches || document.hidden || !inView || open.length || locked || performance.now() - lastInput < 2500) return;
  // the first peek is the card the nudge's arrow points at, so the note and the card say the same thing
  const c = peeked.length ? draw(cards.filter(idle), peeked, 4) : pointedAt(); if (!c) return;
  peeking = c.el.querySelector('.inner').animate(
    [{ rotate: 'y 0deg' }, { rotate: 'y -40deg', offset: .38 }, { rotate: 'y 7deg', offset: .72 }, { rotate: 'y 0deg' }],
    { duration: 1150, easing: 'cubic-bezier(.45, 0, .55, 1)' });
}
function pointedAt() {
  const a = $('.nudge svg').getBoundingClientRect(), tip = a.left + a.width * .85;
  const x = c => { const r = c.el.getBoundingClientRect(); return r.left + r.width / 2; };
  const c = cards.filter(c => c.y === 0 && idle(c)).sort((p, q) => Math.abs(x(p) - tip) - Math.abs(x(q) - tip))[0];
  if (c) peeked.push(c);
  return c;
}
setTimeout(peek, 2700);   // once the deal and the nudge have landed, and before the first turn

// a card wears its tile's colour on both faces, its mark's tones and its flip sound (board.js PALETTE)
function paint(c, color) {
  const P = PALETTE[c.color = color], st = c.el.style;
  st.setProperty('--c', P.css); st.setProperty('--up', P.up); st.setProperty('--tone', P.tone); st.setProperty('--ghost', P.ghost);
}

/* the board breathes as one surface: a single swell, and the breath running out of it in slow ripples, with every
   tile following the same displacement field (stretch in board.js), so the breath travels through the grid instead
   of pulsing in one place. The swell wanders on its own path (drift) and is drawn towards the visitor: a mouse or
   pen near the board pulls it most of the way there, a tap pulls it for a moment, and it glides on a critically
   damped spring, so it never snaps or overshoots, and drifts back home once let go. Its clock only runs while it's
   drawn, so it picks up where it left off; it eases to 40% while someone is playing, stops for reduced motion and
   sleeps while the board is off-screen or the tab is hidden */
const PH = [0, 1, 2].map(() => Math.random() * 2 * Math.PI);
let surf = 0, surfT = 0, surfLast = 0, depth = 1, inView = true, focus = null, pointer = null;
const vel = [0, 0];
addEventListener('pointermove', e => { if (e.pointerType !== 'touch') pointer = { x: e.clientX, y: e.clientY }; }, { passive: true });
addEventListener('pointerdown', e => { pointer = { x: e.clientX, y: e.clientY, tap: e.pointerType === 'touch' && performance.now() }; }, { passive: true });
addEventListener('pointerout', e => { if (!e.relatedTarget && pointer && !pointer.tap) pointer = null; });   // left the window
// keyboard players get the same answer: focus moving over the board draws the swell to the focused card, like a tap
board.addEventListener('focusin', e => {
  if (!e.target.matches(':focus-visible')) return;
  const r = e.target.getBoundingClientRect();
  pointer = { x: r.left + r.width / 2, y: r.top + r.height / 2, tap: performance.now() };
});
function surface(now) {
  surf = 0;
  if (!S || reduce.matches || !inView) return;
  const dt = Math.min(.1, (now - (surfLast || now)) / 1000); surfLast = now; surfT += dt;
  const busy = open.length || locked || now - lastInput < 2500;
  depth += ((busy ? .4 : 1) - depth) * (1 - Math.exp(-dt / .6));
  // where the swell wants to be: its own path, pulled up to 85% of the way to the visitor, fading out over 2.5
  // cells beyond the board's edge; a tap holds it for 1.2s (long enough for the spring to arrive), then lets go
  const rows = folded ? 1 : S.rows;   // folded, it breathes in the one row on show
  const want = drift(surfT, S.cols, rows, PH);
  if (pointer) {
    const r = board.getBoundingClientRect(), px = (pointer.x - r.left) / S.cell, py = (pointer.y - r.top) / S.cell;
    const out = Math.max(0, -px, px - S.cols, -py, py - rows), held = pointer.tap ? Math.min(1, Math.exp(-(now - pointer.tap - 1200) / 1500)) : 1;
    const pull = .85 * Math.max(0, 1 - out / 2.5) * held;
    if (pointer.tap && held < .01) pointer = null;
    want[0] += pull * (Math.min(S.cols, Math.max(0, px)) - want[0]); want[1] += pull * (Math.min(rows, Math.max(0, py)) - want[1]);
  }
  if (!focus) focus = want;
  for (const i of [0, 1]) { vel[i] += (9 * (want[i] - focus[i]) - 6 * vel[i]) * dt; focus[i] += vel[i] * dt; }   // ω = 3/s
  // the swell 6% deep, slowly deepening and easing (11s), the ripples ~2%: no gap moves by more than ~1.5px
  const k = .06 * depth * (.85 + .15 * Math.sin(2 * Math.PI * surfT / 11)), a = .03 * depth;
  for (const c of cards) c.skin.style.transform = `matrix(${stretch(c.x + .5 - focus[0], c.y + .5 - focus[1], surfT, k, a, S.cell).map(v => v.toFixed(4))})`;
  surf = requestAnimationFrame(surface);
}
function breathe() {
  if (reduce.matches) { for (const c of cards) c.skin.style.transform = ''; return; }
  if (!surf) { surfLast = 0; surf = requestAnimationFrame(surface); }
}
new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) breathe(); }).observe(board);
reduce.addEventListener('change', breathe);

// cards land one diagonal after another; `from` is the row the wave starts on (the fold deals in the rows it opens)
function dealIn(from = 0, delay = 120) {
  if (reduce.matches) return;
  for (const c of cards) {
    if (c.y < from) continue;
    c.el.querySelector('.back').animate(
      [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }],
      { duration: 380, delay: delay + (c.x + c.y - from) * 34, easing: 'cubic-bezier(.23, 1, .32, 1)', fill: 'backwards' });
  }
}

/* the fold: on a phone the board rests as its first row and opens on the first play, a tap or Enter on a card (which
   flips it as well) or the arrow down into the rows below. The rows it hides are inert, so neither the keyboard nor
   a screen reader lands on them, and the board says what is hidden. Once played it stays open for the visit, through
   shuffles, turns of the phone and reloads (the CSS shows phones folded until this says open, so a first paint never
   jumps) */
const OPENED = 'basteau:board', hint = $('#fold-hint');
let opened = (() => { try { return sessionStorage.getItem(OPENED) === 'open'; } catch { return false; } })();
let folded = false;
function fold() {
  folded = S.fold && !opened;
  wrap.toggleAttribute('data-open', !folded);
  for (const c of cards) c.el.inert = folded && c.y > 0;
  hint.textContent = `Showing the first row of ${S.cols * S.rows} cards. Play a card or press Down to open the rest.`;
  if (folded) { board.setAttribute('aria-describedby', 'fold-hint'); rove(cards.find(c => c.el.tabIndex === 0)?.y > 0 ? cards[0] : null); }
  else board.removeAttribute('aria-describedby');
}
// played on any layout counts: a board played sideways doesn't fold up again when the phone is turned upright
function unfold() {
  if (!opened) { opened = true; try { sessionStorage.setItem(OPENED, 'open'); } catch {} }
  if (!folded) return;
  folded = false;
  wrap.toggleAttribute('data-opening', !reduce.matches); wrap.setAttribute('data-open', '');
  board.removeAttribute('aria-describedby');
  for (const c of cards) c.el.inert = false;
  dealIn(2, 60);   // (the second row is already showing under the first: the fold just uncovers it)
  live.textContent = `The board opened: ${pairs} pairs to find.`;
  // once the fold has grown (index.html), bring the whole board and its bar into view if it now runs past the screen
  setTimeout(() => {
    wrap.removeAttribute('data-opening');
    wrap.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' });
  }, reduce.matches ? 0 : 400);
}
// the board's one tab stop (a roving tabindex): `to` takes it
function rove(to) {
  if (!to) return;
  for (const c of cards) c.el.tabIndex = c === to ? 0 : -1;
}

function setState(c, state, instant) {
  c.state = state; c.el.dataset.state = state;
  c.el.setAttribute('aria-label', state === 'down' ? 'Hidden card' : state === 'up' ? c.name : `${c.name}, matched`);
  if (instant) { c.el.classList.add('instant'); requestAnimationFrame(() => requestAnimationFrame(() => c.el.classList.remove('instant'))); }
}

function onCard(c, keyboard) {
  if (c.state !== 'down' || locked) return;
  markPlayed(); unfold();
  if (open.length === 2) settleMiss(true);              // a third card is interruptible: the miss turns back at once
  setState(c, 'up', keyboard); open.push(c);
  play('flip', [c.color, c.kind], { jitter: { detune: 12, volume: .1 } });
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
  // the pencil note that invited the game comes back to say how it went: taken off the board and put back, so it is
  // written again (index.html)
  $('.nudge b').textContent = `${moves} moves!`;
  wrap.classList.remove('dealt'); void wrap.offsetWidth; wrap.classList.add('dealt');
  root.classList.add('won');
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

/* a reshuffle is one diagonal wave: the new board deals in underneath while an inert copy of the old one fades away
   on top, each tile shrinking away just ahead of the one taking its place (dealIn's stagger, 120ms earlier) */
let leaving = null;
function shuffle() {
  if (leaving) return;   // one wave at a time
  const btn = $('#shuffle');
  btn.classList.add('spin'); setTimeout(() => btn.classList.remove('spin'), 420);
  play('deal');
  const was = cards;
  if (!reduce.matches) leaving = Object.assign(board.cloneNode(true), { id: '', inert: true });
  newGame();
  if (!leaving) return;
  const at = board.getBoundingClientRect(), box = board.parentElement.getBoundingClientRect();   // to the subpixel
  leaving.style.cssText += `position: absolute; margin: 0; pointer-events: none; left: ${at.left - box.left}px; top: ${at.top - box.top}px;`;
  board.after(leaving);
  const out = was.map((c, i) => leaving.children[i].animate([{ opacity: 0, scale: .6 }],
    { duration: 180, delay: (c.x + c.y) * 34, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' }));
  out.at(-1).onfinish = () => { leaving.remove(); leaving = null; };   // the bottom-right tile leaves last
}

// arrows walk the grid (roving tabindex); Enter / Space flip through the button's own click. Down from a folded
// board's only row opens it
board.addEventListener('keydown', e => {
  const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (!step) return;
  const cur = cards.find(c => c.el === document.activeElement); if (!cur) return;
  e.preventDefault();
  if (e.key === 'ArrowDown') unfold();
  const next = grid[cur.y + step[0]]?.[cur.x + step[1]]; if (!next) return;
  rove(next); next.el.focus();
});

/* =====================================================================
   the stack scale: a hand-drawn sketch above the name (index.html)
   ===================================================================== */
// the stack scale is a sketch, so while a mouse rests on it its lines boil, like hand-drawn animation redrawn a few
// times a second: the pen wobble just changes seed. Only while hovered, never for reduced motion
const scale = $('.scale'), wobble = $('#rough feTurbulence');
let boil = 0;
scale.addEventListener('pointerenter', e => {
  if (e.pointerType !== 'mouse' || reduce.matches) return;
  clearInterval(boil);
  let k = 0;
  boil = setInterval(() => wobble.setAttribute('seed', 7 + (++k % 3)), 150);
});
scale.addEventListener('pointerleave', () => { clearInterval(boil); wobble.setAttribute('seed', 7); });

// the dotted ground (field.js); the stack scale's line work is its calm spot
const field = createField($('#field'), () => scale.getBoundingClientRect());

/* =====================================================================
   chrome: sound, theme, contact
   ===================================================================== */
wireSound($('#sound'));
wireTheme($('#theme'), () => field.recolor());

$('#shuffle').addEventListener('click', shuffle);

// work pills: one open at a time. Pointing at a pill or tabbing to it opens it; leaving the row settles back on the
// current job a beat later, so sliding from pill to pill never flickers home. Touch has no hover, so there the first
// tap on a folded pill opens it to say what it is, and a tap on an open pill follows its link. The sebdev mark turns
// a quarter each time its pill opens
const work = $('#work');
const pills = [...work.querySelectorAll('.pill')];
const home = work.querySelector('[data-home]');
const credit = $('#credit');
let turns = 0, settle = 0;
const openPill = pill => {
  clearTimeout(settle);
  if (pill.hasAttribute('data-open')) return;
  pills.forEach(p => p.toggleAttribute('data-open', p === pill));
  if (pill === credit) credit.style.setProperty('--turn', ++turns);
};
const rest = () => { clearTimeout(settle); settle = setTimeout(() => openPill(home), 120); };
let preview = null;   // the folded pill a finger just came down on: its click opens it instead of following it
let seen = {};        // where the mouse last was, so a pill only opens for a pointer that actually moved
pills.forEach(p => {
  // never on the hover update a reflow sends when a pill slides under a still pointer
  p.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || (e.clientX === seen.x && e.clientY === seen.y)) return;
    seen = { x: e.clientX, y: e.clientY };
    openPill(p);
  });
  p.addEventListener('focus', () => p.matches(':focus-visible') && openPill(p));
  p.addEventListener('pointerdown', e => { preview = e.pointerType !== 'mouse' && !p.hasAttribute('data-open') ? p : null; });
  p.addEventListener('click', e => {
    if (preview !== p) return;
    preview = null; e.preventDefault(); openPill(p);
  });
});
work.addEventListener('pointerleave', e => e.pointerType === 'mouse' && !work.querySelector(':focus-visible') && rest());
work.addEventListener('focusout', e => !work.contains(e.relatedTarget) && rest());

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
    else { S = next; size(); fold(); }
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

import { defineSound } from './audio.js';
import { PALETTE } from './board.js';
import { reduce, player, wireSound, wireTheme } from './chrome.js';
import { createField } from './field.js';

/* the talks page: a shelf of tapes (talks.html), one pulled out at a time */
const $ = s => document.querySelector(s);
const shelf = $('#shelf'), tapes = [...shelf.querySelectorAll('.tape')];
const spine = t => t.querySelector('.spine'), watch = t => t.querySelector('.watch');
// the tapes lie in a stack on phones (same query as the CSS)
const stacked = matchMedia('(max-width: 759px), (max-width: 1099px) and (orientation: portrait), (max-height: 499px)');

const field = createField($('#field'));
wireSound($('#sound'));
wireTheme($('#theme'), () => field.recolor());

/* the shelf plays like a xylophone: every tape is a bar, the longer the talk the lower its note (a C-major
   pentatonic, so any run across the spines stays consonant). A woody triangle with a short click on top */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
const mins = t => +t.style.getPropertyValue('--min');
const byLength = [...tapes].sort((a, b) => mins(b) - mins(a));
const bars = new Map();
const play = player({
  bar: f => bars.get(f) ?? bars.set(f, defineSound({ layers: [
      { source: { type: 'triangle', frequency: f }, envelope: { attack: 0, decay: .17, sustain: 0, release: .05 }, filter: { type: 'lowpass', frequency: 2600 }, gain: .16 },
      { source: { type: 'sine', frequency: f * 4 }, envelope: { attack: 0, decay: .024, sustain: 0, release: .01 }, gain: .04 },
    ], effects: [{ type: 'reverb', decay: .3, damping: .5, mix: .08 }] })).get(f),
});

/* pulling a tape out slides the last one back. It sounds its note and sends a ring through the dotted ground in its
   colour (not on every spine of a fast sweep). In the stack the tape above may have just folded, so the pulled one is
   scrolled back into view once it has settled */
let lastRing = 0;
function pull(tape, { quiet = false } = {}) {
  if (tape.hasAttribute('data-open')) return;
  for (const t of tapes) { t.toggleAttribute('data-open', t === tape); spine(t).setAttribute('aria-expanded', String(t === tape)); }
  lastInput = performance.now();
  if (quiet) return;
  play('bar', SCALE[byLength.indexOf(tape)], { jitter: { detune: 8 } });
  const now = performance.now();
  if (now - lastRing > 320) {
    lastRing = now;
    const r = tape.getBoundingClientRect();
    field.ripple(r.left + r.width / 2, r.top + r.height / 2, PALETTE[tape.dataset.c].hex, .8);
  }
  if (stacked.matches) setTimeout(() => tape.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' }), 440);
}

/* a mouse pulls tapes out just by running along the spines (only a pointer that actually moved: a tape sliding under
   a still one doesn't count), a tap or a click pulls the one it lands on, and the keyboard pulls the spine it tabs to
   and lands on that tape's way out, since the spine itself has gone. Arrow keys walk the shelf */
let seen = {}, lastInput = 0;
for (const tape of tapes) {
  const s = spine(tape);
  s.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || stacked.matches || (e.clientX === seen.x && e.clientY === seen.y)) return;
    seen = { x: e.clientX, y: e.clientY };
    pull(tape);
  });
  s.addEventListener('click', e => { pull(tape); if (e.detail === 0) watch(tape).focus({ preventScroll: true }); });
  s.addEventListener('focus', () => { if (s.matches(':focus-visible')) { pull(tape); watch(tape).focus({ preventScroll: true }); } });
  // on the way to the talk, the reels wind on
  const reels = () => tape.querySelectorAll('.reels svg');
  const wind = rate => () => reels().forEach(r => r.getAnimations().forEach(a => a.updatePlaybackRate(rate)));
  watch(tape).addEventListener('pointerenter', wind(6));
  watch(tape).addEventListener('pointerleave', wind(1));
}
shelf.addEventListener('keydown', e => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  const at = tapes.findIndex(t => t.contains(document.activeElement));
  if (!step || at < 0) return;
  e.preventDefault();
  const next = tapes[(at + step + tapes.length) % tapes.length];
  pull(next); watch(next).focus({ preventScroll: true });
  if (stacked.matches) next.scrollIntoView({ block: 'nearest' });
});
addEventListener('pointerdown', () => { lastInput = performance.now(); }, { passive: true });
addEventListener('pointermove', () => { lastInput = performance.now(); }, { passive: true });
addEventListener('keydown', () => { lastInput = performance.now(); });

// a link to a tape (talks.html#wet-codebase) arrives with it pulled out
function fromHash() {
  const tape = tapes.find(t => t.id === location.hash.slice(1));
  if (tape) pull(tape, { quiet: true });
}
addEventListener('hashchange', fromHash);
fromHash();

/* while nobody is browsing, now and then a tape on the shelf lifts a little and drops back, asking to be picked: the
   board's quiet rules (never while the visitor is busy, never hidden, never for reduced motion, no sound) */
let hopped = null;
function hop() {
  setTimeout(hop, 3600 + Math.random() * 2600);
  if (reduce.matches || document.hidden || performance.now() - lastInput < 3000 || shelf.contains(document.activeElement)) return;
  const idle = tapes.filter(t => !t.hasAttribute('data-open') && t !== hopped);
  hopped = idle[Math.floor(Math.random() * idle.length)];
  const by = stacked.matches ? ['10px 0', '-3px 0'] : ['0 -14px', '0 3px'];
  hopped.animate([{ translate: '0 0' }, { translate: by[0], offset: .4 }, { translate: by[1], offset: .78 }, { translate: '0 0' }],
    { duration: 720, easing: 'cubic-bezier(.45, 0, .55, 1)' });
}
setTimeout(hop, 4200);

let rz = 0;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => field.resize(), 80); });

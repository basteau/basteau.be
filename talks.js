import { defineSound } from './audio.js';
import { reduce, player, wireSound, wireTheme } from './chrome.js';

/* the talks page: a shelf of tapes (talks.html), one pulled out at a time. Every tape is a link to its talk */
const $ = s => document.querySelector(s);
const shelf = $('#shelf'), tapes = [...shelf.querySelectorAll('.tape')];
const link = t => t.querySelector('.spine');
// the tapes lie in a stack on phones (same query as the CSS)
const stacked = matchMedia('(max-width: 899px), (max-width: 1099px) and (orientation: portrait), (max-height: 499px)');

wireSound($('#sound'));
wireTheme($('#theme'));

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

/* pulling a tape out slides the last one back and sounds its note. In the stack the tape above may have just folded, so the pulled one is
   scrolled back into view once it has settled */
let lastInput = 0;
function pull(tape, { quiet = false } = {}) {
  if (tape.hasAttribute('data-open')) return;
  for (const t of tapes) t.toggleAttribute('data-open', t === tape);
  if (quiet) return;
  play('bar', SCALE[byLength.indexOf(tape)], { jitter: { detune: 8 } });
  if (stacked.matches) setTimeout(() => tape.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' }), 480);
}

/* a mouse pulls tapes out just by running along the spines (only a pointer that actually moved: a tape sliding under
   a still one doesn't count), and the keyboard pulls the tape it tabs to; either way the tape is out by the time it
   is clicked, and the click goes to the talk. Touch has no hover, so there the first tap on a shelved tape pulls it
   out to say what it is, and a tap on the pulled one follows it (as the work pills do on the home page). Arrow keys
   walk the shelf */
let seen = {}, preview = null;
for (const tape of tapes) {
  const a = link(tape);
  a.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || (e.clientX === seen.x && e.clientY === seen.y)) return;
    seen = { x: e.clientX, y: e.clientY };
    pull(tape);
  });
  a.addEventListener('focus', () => a.matches(':focus-visible') && pull(tape));
  a.addEventListener('pointerdown', e => { preview = e.pointerType !== 'mouse' && !tape.hasAttribute('data-open') ? tape : null; });
  a.addEventListener('click', e => {
    if (preview !== tape) return;
    preview = null; e.preventDefault(); pull(tape);
  });
}
shelf.addEventListener('keydown', e => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  const at = tapes.findIndex(t => t.contains(document.activeElement));
  if (!step || at < 0) return;
  e.preventDefault();
  link(tapes[(at + step + tapes.length) % tapes.length]).focus();   // focusing a tape pulls it
});
for (const type of ['pointerdown', 'pointermove', 'keydown']) addEventListener(type, () => { lastInput = performance.now(); }, { passive: true });

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

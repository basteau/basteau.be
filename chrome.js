import { defineSound, getMasterBus } from './audio.js';

/* what every page shares: the visitor's stored choices, the sound switch and the theme switch */
export const root = document.documentElement;
// layout viewport (unlike innerWidth it never grows with overflowing content)
export const vw = () => root.clientWidth, vh = () => root.clientHeight;
export const reduce = matchMedia('(prefers-reduced-motion: reduce)');
export const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  drop(k) { try { localStorage.removeItem(k); } catch {} },
};

/* ---------- sound: on by default, but off for visitors who ask for reduced motion (they can still turn it on).
   Nothing plays until the visitor acts ---------- */
let soundOn = store.get('basteau:sound', reduce.matches ? 'off' : 'on') === 'on';
// a struck note: a quick soft onset, then a ring whose overtones ([ratio, level, how long it lasts]) die first
export const strike = (f, ring, gain, { delay = 0, overtones = [[2, .18, .5]] } = {}) => [[1, 1, 1], ...overtones].map(([ratio, level, fade]) => (
  { source: { type: 'sine', frequency: f * ratio }, envelope: { attack: .003, decay: ring * fade, sustain: 0, release: .02 }, gain: gain * level, delay }));
// the contact under a note: a few milliseconds of filtered noise, like paper or wood
export const tick = (f, gain, delay = 0) => (
  { source: { type: 'noise', color: 'pink' }, filter: { type: 'bandpass', frequency: f, resonance: .8 }, envelope: { attack: .001, decay: .012, sustain: 0, release: .006 }, gain, delay });

// a short dark room: stereo noise whose top end fades first
function roomOf(ctx) {
  const rate = ctx.sampleRate, length = Math.round(rate * .38), room = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = room.getChannelData(ch);
    let low = 0;
    for (let i = Math.round(rate * .006); i < length; i++) {
      const t = i / length;
      low += (Math.random() * 2 - 1 - low) * (.65 - .6 * t);
      data[i] = low * Math.exp(-6.5 * t);
    }
  }
  return room;
}
// every sound leaves through one room and one limiter, so they share a space and a pile-up can't get loud
let wired = null;
function bus() {
  const master = getMasterBus(), ctx = master.context;
  if (wired === ctx) return;
  wired = ctx;
  const room = ctx.createConvolver(), wet = ctx.createGain(), clear = ctx.createBiquadFilter(), limit = ctx.createDynamicsCompressor(), trim = ctx.createGain();
  room.buffer = roomOf(ctx);
  wet.gain.value = .16;
  clear.type = 'highpass'; clear.frequency.value = 280;
  limit.threshold.value = -14; limit.knee.value = 6; limit.ratio.value = 12; limit.attack.value = .002; limit.release.value = .12;
  trim.gain.value = .41;   // takes back the makeup gain the compressor adds by itself
  master.disconnect();
  master.connect(limit);
  master.connect(clear).connect(room).connect(wet).connect(limit);
  limit.connect(trim).connect(ctx.destination);
}
// browsers hold audio back until a gesture, and anything played before it would wait and then fire all at once
let gesture = -1e4;
const wake = () => { gesture = performance.now(); if (soundOn) try { bus(); } catch {} };
for (const type of ['pointerdown', 'pointerup', 'keydown']) addEventListener(type, wake, { capture: true, passive: true });
const awake = () => wired?.state === 'running' || performance.now() - gesture < 250;
// a page's play(name, arg?, opts?) over its own sounds: plain definitions, or functions of arg that return one. The same
// sound can't retrigger within 40ms
export const player = SFX => {
  const last = new Map();
  return (name, arg, opts) => {
    const now = performance.now();
    if (!soundOn || !awake() || now - (last.get(name) ?? -1e4) < 40) return;
    last.set(name, now);
    try { bus(); (arg === undefined ? SFX[name] : SFX[name](arg))(opts); } catch {}
  };
};
const play = player({
  toggleOn: defineSound({ layers: [...strike(659.25, .07, .05), ...strike(987.77, .07, .05, { delay: .03 })] }),
  toggleOff: defineSound({ layers: [...strike(987.77, .07, .05), ...strike(659.25, .07, .05, { delay: .03 })] }),
  // theme: a soft filtered-noise swell under a pair of notes; dark sweeps down, light sweeps up
  // (both stretched over the ~850ms reveal: the swell peaks a quarter in and fades with the edge, the second note
  // lands as the wash passes mid-screen)
  dusk: defineSound({ layers: [
      { source: { type: 'noise', color: 'pink' }, filter: { type: 'bandpass', frequency: 500, resonance: .9, envelope: { attack: .14, peak: 1500, decay: .6 } },
        envelope: { attack: .12, decay: .62, sustain: 0, release: .16 }, gain: .05 },
      ...strike(783.99, .12, .04, { delay: .05 }), ...strike(523.25, .2, .04, { delay: .24 }),
    ] }),
  dawn: defineSound({ layers: [
      { source: { type: 'noise', color: 'pink' }, filter: { type: 'bandpass', frequency: 700, resonance: .9, envelope: { attack: .14, peak: 2200, decay: .58 } },
        envelope: { attack: .12, decay: .6, sustain: 0, release: .16 }, gain: .045 },
      ...strike(523.25, .12, .04, { delay: .05 }), ...strike(783.99, .2, .04, { delay: .24 }),
    ] }),
});

export function wireSound(btn) {
  const paint = () => { btn.setAttribute('aria-pressed', String(soundOn)); btn.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Turn sound on'); };
  btn.addEventListener('click', () => {
    if (soundOn) { play('toggleOff'); soundOn = false; } else { soundOn = true; play('toggleOn'); }
    store.set('basteau:sound', soundOn ? 'on' : 'off'); paint();
  });
  paint();
}

/* ---------- theme: follows the system unless the visitor picks the other one; picking the system's own theme again
   clears the choice, so a later OS switch (say, automatic dark mode at night) carries the site with it. onChange runs
   after every switch, for anything a page draws itself ---------- */
export function wireTheme(btn, onChange = () => {}) {
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const systemTheme = () => systemDark.matches ? 'dark' : 'light';
  const paint = () => {
    const dark = root.dataset.theme === 'dark';
    btn.setAttribute('aria-pressed', String(dark)); btn.setAttribute('aria-label', dark ? 'Light mode' : 'Dark mode');
  };
  const setTheme = t => {
    root.dataset.theme = t; paint(); onChange(t);
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = t === 'dark' ? '#0B0B0C' : '#FFFFFF'; });
  };
  systemDark.addEventListener('change', () => { if (!store.get('basteau:theme', null)) setTheme(systemTheme()); });
  btn.addEventListener('click', () => {
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
    const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const S = 2 * Math.hypot(Math.max(x, vw() - x), Math.max(y, vh() - y)) / .92;   // solid part covers the far corner
    const from = { size: '0px 0px', pos: `${x}px ${y}px` }, to = { size: `${S}px ${S}px`, pos: `${x - S / 2}px ${y - S / 2}px` };
    root.classList.add('theming');   // scopes the reveal's styles in the page to this transition, not page navigations
    const vt = document.startViewTransition(apply);
    vt.finished.finally(() => root.classList.remove('theming'));
    vt.ready.then(() => {
      root.animate({
        maskSize: [from.size, to.size], maskPosition: [from.pos, to.pos],
        webkitMaskSize: [from.size, to.size], webkitMaskPosition: [from.pos, to.pos],
      }, { duration: 850, easing: 'cubic-bezier(.45, 0, .15, 1)', fill: 'both', pseudoElement: '::view-transition-new(root)' });
    }, () => {});   // a transition skipped by a quick second toggle (or a hidden tab) just applies the theme
  });
  paint();
}

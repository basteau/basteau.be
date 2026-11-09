import { defineSound } from './audio.js';

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
export const blip = (f, d, g, delay = 0) => ({ source: { type: 'sine', frequency: f }, envelope: { attack: 0, decay: d, sustain: 0, release: .006 }, gain: g, delay });
// a page's play(name, arg?, opts?) over its own sounds: plain definitions, or functions of arg that return one
export const player = SFX => (name, arg, opts) => {
  if (!soundOn) return;
  try { (arg === undefined ? SFX[name] : SFX[name](arg))(opts); } catch {}
};
const play = player({
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

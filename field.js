import { PALETTE, COLORS } from './board.js';
import { root, reduce, vw, vh } from './chrome.js';

/* the ground: a 24px dot grid on a fixed canvas. Near the pointer the dots swell, pick up the logo colours and lean
   away; ripple() sends a ring through the field. Touch screens get the same lens under the finger. calmRect, if given,
   returns a box of fine line work that the lens and the ripples leave alone: full strength from QUIET px out, fading
   to nothing at its edge (the plain dots stay, so the paper under it is unchanged) */
export function createField(cv, calmRect = () => null) {
  const ctx = cv.getContext('2d');
  const STEP = 24, pal = COLORS.map(c => PALETTE[c].hex);
  let W, H, dpr, base, running = false, last = 0;
  const p = { x: -999, y: -999, sx: -999, sy: -999, k: 0, on: false };
  const rings = [];
  // the same alpha gives both themes about the same dot-to-ground contrast (~1.5:1)
  function colors() { base = root.dataset.theme === 'dark' ? [255, 255, 255, .16] : [11, 11, 12, .16]; }
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = vw(); H = vh();
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(performance.now());
  }
  const QUIET = 56;
  function calmAt(x, y, q) {
    const d = Math.hypot(Math.max(q.left - x, 0, x - q.right), Math.max(q.top - y, 0, y - q.bottom));
    const t = Math.min(1, d / QUIET);
    return t * t * (3 - 2 * t);
  }
  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    const R = W < 760 ? 96 : 124, push = reduce.matches ? 0 : 10, q = calmRect();
    const [br, bg, bb, ba] = base;
    // plain dots go into one path and one fill; only the few the lens or a ring touches are drawn on their own
    const plain = new Path2D(), lit = [];
    for (let y = STEP / 2, gy = 0; y < H + STEP; y += STEP, gy++) {
      for (let x = STEP / 2, gx = 0; x < W + STEP; x += STEP, gx++) {
        let e = 0, dx = 0, dy = 0, tint = null, te = 0;
        const calm = q && (p.k > .001 || rings.length) ? calmAt(x, y, q) : 1;
        if (p.k > .001 && calm > 0) {
          const ddx = x - p.sx, ddy = y - p.sy, d = Math.hypot(ddx, ddy);
          if (d < R) { const t = 1 - d / R; e = t * t * (3 - 2 * t) * p.k * calm; if (d > 0) { dx += ddx / d * push * e; dy += ddy / d * push * e; } }
        }
        for (const r of rings) {
          const age = (now - r.t0) / 1000, rad = age * 640 * r.s, band = 70 * r.s;
          const ddx = x - r.x, ddy = y - r.y, d = Math.hypot(ddx, ddy), off = Math.abs(d - rad);
          if (off < band) { const w = (1 - off / band) * Math.max(0, 1 - age / (1.25 * r.s)) * calm;
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
}

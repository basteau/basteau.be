// The board model, shared by the page (app.js) and the Paper exporter (tools/paper.mjs): pure, no DOM.

// the stack. Order is priority: the 10-pair board (column on phones) drops the last two
export const TECH = [
  ['vue', 'vuedotjs'], ['typescript', 'typescript'], ['php', 'php'], ['laravel', 'laravel'], ['symfony', 'symfony'],
  ['docker', 'docker'], ['go', 'go'], ['rust', 'rust'], ['react', 'react'], ['tailwind', 'tailwindcss'],
  ['svelte', 'svelte'], ['vite', 'vite'],
];
// logo palette (see the Lab pages in Paper). A turned card becomes an even squircle plate and its mark keeps
// the tile's hue: `up` is the glyph while the card is being compared (lightness moved to a 4.5:1 contrast),
// `tone` once matched (3:1, so it sinks back into the mosaic). The shades keep the tile's OKLCH hue at the most
// chroma sRGB allows, so a mark reads as a deeper ink of its tile, not a brown or a near-black. Violet is dark, so
// its marks are tints (lavender: the strict OKLCH hue drifts to periwinkle up there and looks off). `ghost` is the partner colour of the riso misregistration that snaps in on a match.
export const PALETTE = {
  magenta: { css: 'var(--magenta)', hex: '#FF0A8E', up: '#420121', tone: '#780540', ghost: '#009FFD' },
  cyan:    { css: 'var(--cyan)',    hex: '#009FFD', up: '#023458', tone: '#064F81', ghost: '#FF0A8E' },
  orange:  { css: 'var(--orange)',  hex: '#FDA506', up: '#674105', tone: '#8A5909', ghost: '#4803FE' },
  violet:  { css: 'var(--violet)',  hex: '#4803FE', up: '#CFBCFF', tone: '#AE8FFF', ghost: '#FDA506' },
};
export const COLORS = Object.keys(PALETTE);

/* =====================================================================
   tiling: the face-down board is a mosaic in the spirit of the logo.
   Pieces of 1-5 cells that prefer to bend (more L/S/T/Z, fewer bars),
   neighbours never share a colour and colours stay balanced. Shapes are
   mixed per tile, sebdev-style, all somewhere between a square and a
   circle: square, squircle, pebble (a squircle with uneven corners),
   circle, ring, quarter round, dome and leaf, in any orientation. A piece
   leans towards one family (about 35% of its tiles) so the colour regions
   still read as pieces, and every deal repeats one motif on a diagonal
   rhythm so the irregularity has a pattern to it.
   ===================================================================== */
export function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function pick(r, weights) { let t = r() * weights.reduce((a, [, w]) => a + w, 0); for (const [v, w] of weights) if ((t -= w) < 0) return v; return weights[0][0]; }

export const SHAPES = [['square', 13], ['squircle', 15], ['pebble', 10], ['circle', 14], ['ring', 8], ['quarter', 16], ['dome', 14], ['leaf', 9]];
// corner radii (tl tr br bl, as a fraction of the cell) per shape and orientation
export function cut(kind, o, r = Math.random) {
  const s = .08;
  switch (kind) {
    case 'squircle': return [.3, .3, .3, .3];
    case 'pebble': return [0, 1, 2, 3].map(() => .16 + r() * .34);
    case 'circle': case 'ring': return [.5, .5, .5, .5];
    case 'quarter': return [0, 1, 2, 3].map(i => i === o ? 1 : s);
    case 'dome': return [[.5, .5, s, s], [s, .5, .5, s], [s, s, .5, .5], [.5, s, s, .5]][o];
    case 'leaf': return o % 2 ? [s, 1, s, 1] : [1, s, 1, s];
    default: return [s, s, s, s];
  }
}

export function tile(cols, rows, holes, r) {
  const pid = Array.from({ length: rows }, () => Array(cols).fill(-1));
  for (const [y, x] of holes) pid[y][x] = -2;
  const pieces = [];
  const free = (y, x) => y >= 0 && x >= 0 && y < rows && x < cols && pid[y][x] === -1;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (pid[y][x] !== -1) continue;
    const id = pieces.length, cells = [[y, x]], size = pick(r, [[1, 6], [2, 26], [3, 32], [4, 24], [5, 12]]);
    pid[y][x] = id;
    while (cells.length < size) {
      const front = [];
      for (const [cy, cx] of cells) for (const [dy, dx] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const ny = cy + dy, nx = cx + dx;
        if (!free(ny, nx)) continue;
        // a cell that turns the piece away from a straight run weighs more
        const [ly, lx] = cells[cells.length - 1], [py, px] = cells[cells.length - 2] ?? [ly, lx];
        const straight = (ny - ly === ly - py && nx - lx === lx - px);
        front.push([[ny, nx], straight ? 1 : 2.6]);
      }
      if (!front.length) break;
      const [ny, nx] = pick(r, front);
      pid[ny][nx] = id; cells.push([ny, nx]);
    }
    pieces.push({ cells, family: pick(r, SHAPES) });
  }
  // colour: never the same as a touching piece, and favour whichever colour covers the least so far
  const used = Object.fromEntries(COLORS.map(c => [c, 0]));
  pieces.forEach((p, id) => {
    const near = new Set();
    for (const [y, x] of p.cells) for (const [dy, dx] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const n = pid[y + dy]?.[x + dx];
      if (n >= 0 && n !== id && pieces[n].color) near.add(pieces[n].color);
    }
    let opts = COLORS.filter(c => !near.has(c)); if (!opts.length) opts = COLORS;
    const lo = Math.min(...opts.map(c => used[c]));
    opts = opts.filter(c => used[c] === lo);
    p.color = opts[Math.floor(r() * opts.length)];
    used[p.color] += p.cells.length;
  });
  return { pid, pieces };
}

// a full deal: the mosaic, a shuffled deck and every tile's cut, in reading order (holes included)
export function deal(cols, rows, holes, seed) {
  const r = rng(seed);
  const { pid, pieces } = tile(cols, rows, holes, r);
  const pairs = (cols * rows - holes.length) / 2;
  const deck = TECH.slice(0, pairs).flatMap(t => [t, t]);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const cells = [];
  // the deal's motif and the phase of its diagonal rhythm
  const motif = pick(r, [['circle', 3], ['ring', 2], ['squircle', 2], ['pebble', 2]]), phase = Math.floor(r() * 5);
  let k = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (pid[y][x] === -2) { cells.push({ x, y, hole: true }); continue; }
    const [name, slug] = deck[k++], piece = pieces[pid[y][x]];
    // its shape: the motif on the rhythm, else leaning to the piece's family, else anything; a random
    // orientation and a jittered gap per side
    const onBeat = (x + 2 * y) % 5 === phase && r() < .6;
    const kind = onBeat ? motif : r() < .35 ? piece.family : pick(r, SHAPES);
    const o = Math.floor(r() * 4);
    const jitter = [0, 1, 2, 3].map(() => .82 + r() * .36);
    cells.push({ x, y, o, name, slug, kind, pid: pid[y][x], color: piece.color, radius: cut(kind, o, r), jitter });
  }
  return { cells, pairs };
}

// the clip-path for a tile at a given cell size: a near-uniform gap on every side, the board's outer edge too (the
// board is pulled out by one gap to make up for it, see .board), so a tile looks the same turned any way. Then its
// cut. The face side is always the same even squircle plate, so every mark gets one stage.
export function shapeOf(c, cell) {
  const gap = Math.max(2, cell * .028), px = v => v.toFixed(2) + 'px';
  const [t, rt, b, l] = c.jitter.map(j => gap * j);
  return {
    shape: `inset(${px(t)} ${px(rt)} ${px(b)} ${px(l)} round ${c.radius.map(k => px(k * cell)).join(' ')})`,
    done: `inset(${px(t)} ${px(rt)} ${px(b)} ${px(l)} round ${px(cell * .32)})`,
  };
}

/* ---------------------------------------------------------------------
   glyph optics, measured once with measure.html: each mark's bounding box
   (24-unit viewBox), its ink centroid relative to the box centre (cx, cy as
   a fraction of the box) and its ink coverage. Centring the box is not
   centring the mark: go's speed lines drag its box left of the heavy "GO",
   vue and vite are top-heavy, docker's whale sits low. So the glyph is
   nudged to close most of that gap, and light marks are drawn a little
   larger than dense ones so all weigh the same. Hairline marks get a stroke
   (`bold`, in viewBox units, measured in) so every stem is about as heavy,
   and `size` is a last optical touch where the maths still reads big.
   --------------------------------------------------------------------- */
export const OPTICS = {
  docker: { box: [0, 3.389, 24, 17.222], cx: -0.0642, cy: 0.0783, ink: 0.5252 },
  go: { box: [0, 7.517, 24, 8.966], cx: 0.0994, cy: -0.0026, ink: 0.4806 },
  laravel: { box: [0.044, -0.3, 23.912, 24.6], cx: -0.0418, cy: -0.0261, ink: 0.3423, bold: .6 },
  php: { box: [3.652, 7.528, 16.771, 8.008], cx: -0.0071, cy: 0.0088, ink: 0.3997 },
  react: { box: [-0.225, 1.089, 24.45, 21.825], cx: -0.0004, cy: -0.0011, ink: 0.4243, bold: .45 },
  rust: { box: [0, 0.004, 24, 23.992], cx: -0.0057, cy: -0.0031, ink: 0.5238 },
  svelte: { box: [2.015, 0, 19.97, 24], cx: -0.0007, cy: -0.001, ink: 0.4926 },
  symfony: { box: [3.98, 4.437, 15.437, 16.233], cx: -0.0399, cy: -0.0211, ink: 0.2652 },
  tailwindcss: { box: [0.001, 4.8, 24, 14.4], cx: -0.0005, cy: -0.0009, ink: 0.3417 },
  typescript: { box: [3.375, 9.75, 18.563, 12.187], cx: 0.0442, cy: -0.0532, ink: 0.4622, size: .9 },
  vite: { box: [0.014, 0, 23.969, 24], cx: 0.0023, cy: -0.1022, ink: 0.4454 },
  vuedotjs: { box: [0, 1.61, 24, 20.78], cx: -0.0005, cy: -0.116, ink: 0.3427 }
};
export function glyph(slug, cell) {
  const { box: [bx, by, bw, bh], cx, cy, ink, bold = 0, size = 1 } = OPTICS[slug];
  const weight = Math.min(1.18, Math.max(.9, (.45 / ink) ** .22));
  const a = bw / bh, S = cell * .33 * weight * size;
  let w = S * Math.sqrt(a), h = S / Math.sqrt(a);
  const k = Math.min(1, cell * .54 / w, cell * .42 / h);
  w *= k; h *= k;
  return { vb: `${bx - .2} ${by - .2} ${bw + .4} ${bh + .4}`, w, h, ox: -cx * w * .8, oy: -cy * h * .8, sw: bold };
}

/* ---------------------------------------------------------------------
   the breathing surface: one soft swell of pressure under the board, and
   the breath running out of it in slow ripples. Every tile follows one
   smooth radial displacement field (in cells, d the offset from the swell):
     U(r) = k·g(r)·r                      the swell pushes its ring outward
          + a·fade(r)·reach(r)·sin(φ - q·r)   ripples, ~5 cells long
   and wears the field's local stretch (its jacobian, by finite differences):
   the tile on the swell grows, its ring gives way, and every tile further
   out breathes ~2% a little after its inner neighbour, so the breath keeps
   travelling through the grid instead of pulsing in one place. The ripple
   fades in over ~1.7 cells (no tear at the centre) and out with distance.
   One field moves them all, so no gap moves by more than ~1.5px and the
   board reads as one skin. Swept for that in the Lab 5 notes.
   --------------------------------------------------------------------- */
export const RIPPLE = 4.4;   // seconds per breath
function lift(dx, dy, ph, k, a) {
  const r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
  if (r < 1e-9) return [0, 0];
  const U = k * Math.exp(-r2 / 2.88) * r + a * (1 - Math.exp(-r2 / 3)) / (1 + r2 / 12.25) * Math.sin(ph - 1.25 * r);
  return [dx / r * U, dy / r * U];
}
// a tile's CSS matrix() (translation in px) at offset (dx, dy) from the swell, t seconds in, at depth k and ripple a
export function stretch(dx, dy, t, k, a, cell) {
  const ph = 2 * Math.PI * t / RIPPLE, e = .02, [ux, uy] = lift(dx, dy, ph, k, a);
  const [x1, y1] = lift(dx + e, dy, ph, k, a), [x0, y0] = lift(dx - e, dy, ph, k, a);
  const [x3, y3] = lift(dx, dy + e, ph, k, a), [x2, y2] = lift(dx, dy - e, ph, k, a);
  return [1 + (x1 - x0) / (2 * e), (y1 - y0) / (2 * e), (x3 - x2) / (2 * e), 1 + (y3 - y2) / (2 * e), ux * cell, uy * cell];
}

// where the swell wanders on its own at time t (seconds), in cells from the board's top-left: a slow lissajous on
// periods that never line up (13s, 17s, 31s), so it covers the whole board and never retraces a loop. `ph` is a
// per-visit phase. The page pulls it towards the visitor's cursor on top of this
export function drift(t, cols, rows, ph = [0, 0, 0]) {
  const T = 2 * Math.PI;
  return [cols / 2 + (cols / 2 - .35) * Math.sin(T * t / 13 + ph[0]) * (.8 + .2 * Math.sin(T * t / 31 + ph[2])),
          rows / 2 + (rows / 2 - .35) * Math.sin(T * t / 17 + ph[1])];
}

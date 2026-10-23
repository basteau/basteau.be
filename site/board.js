// The board model, shared by the page (app.js) and the Paper exporter (tools/paper.mjs): pure, no DOM.

// the stack. Order is priority: the 10-pair board (column on phones) drops the last two
export const TECH = [
  ['vue', 'vuedotjs'], ['typescript', 'typescript'], ['php', 'php'], ['laravel', 'laravel'], ['symfony', 'symfony'],
  ['docker', 'docker'], ['go', 'go'], ['rust', 'rust'], ['react', 'react'], ['tailwind', 'tailwindcss'],
  ['svelte', 'svelte'], ['vite', 'vite'],
];
// logo palette (see the Lab pages in Paper). A turned card becomes an even squircle plate and its mark keeps
// the tile's hue: `up` is the glyph while the card is being compared (lightness moved to a 4.5:1 contrast),
// `tone` once matched (3:1, so it sinks back into the mosaic). Violet is dark, so its marks are tints, the
// other three take shades. `ghost` is the partner colour of the riso misregistration that snaps in on a match.
export const PALETTE = {
  magenta: { css: 'var(--magenta)', hex: '#FF0A8E', up: '#3A1426', tone: '#6B1D3F', ghost: '#009FFD' },
  cyan:    { css: 'var(--cyan)',    hex: '#009FFD', up: '#18344D', tone: '#1B4F79', ghost: '#FF0A8E' },
  orange:  { css: 'var(--orange)',  hex: '#FDA506', up: '#61431D', tone: '#855A1F', ghost: '#4803FE' },
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
   nudged to close most of that gap, and light outline marks (laravel) are
   drawn a little larger than dense ones (typescript) so all weigh the same.
   --------------------------------------------------------------------- */
export const OPTICS = {
  docker: { box: [0, 3.389, 24, 17.222], cx: -0.0642, cy: 0.0783, ink: 0.5252 },
  go: { box: [0, 7.517, 24, 8.966], cx: 0.0994, cy: -0.0026, ink: 0.4806 },
  laravel: { box: [0.344, 0, 23.312, 24], cx: -0.0405, cy: -0.0277, ink: 0.2072 },
  php: { box: [0, 5.688, 24, 12.625], cx: 0.0003, cy: 0.0077, ink: 0.6077 },
  react: { box: [0, 1.314, 24, 21.375], cx: -0.0004, cy: -0.0011, ink: 0.3301 },
  rust: { box: [0, 0.004, 24, 23.992], cx: -0.0057, cy: -0.0031, ink: 0.5238 },
  svelte: { box: [2.015, 0, 19.97, 24], cx: -0.0007, cy: -0.001, ink: 0.4926 },
  symfony: { box: [0, 0, 24, 24], cx: 0.0059, cy: -0.0022, ink: 0.6697 },
  tailwindcss: { box: [0.001, 4.8, 24, 14.4], cx: -0.0005, cy: -0.0009, ink: 0.3417 },
  typescript: { box: [0, 0, 24, 24], cx: -0.0144, cy: -0.0304, ink: 0.8162 },
  vite: { box: [0.014, 0, 23.969, 24], cx: 0.0023, cy: -0.1022, ink: 0.4454 },
  vuedotjs: { box: [0, 1.61, 24, 20.78], cx: -0.0005, cy: -0.116, ink: 0.3427 }
};
export function glyph(slug, cell) {
  const { box: [bx, by, bw, bh], cx, cy, ink } = OPTICS[slug];
  const weight = Math.min(1.18, Math.max(.9, (.45 / ink) ** .22));
  const a = bw / bh, S = cell * .33 * weight;
  let w = S * Math.sqrt(a), h = S / Math.sqrt(a);
  const k = Math.min(1, cell * .54 / w, cell * .42 / h);
  w *= k; h *= k;
  return { vb: `${bx - .2} ${by - .2} ${bw + .4} ${bh + .4}`, w, h, ox: -cx * w * .8, oy: -cy * h * .8 };
}

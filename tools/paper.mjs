// Emits a dealt board as Paper-friendly HTML (plain divs + inline SVG), using the same model as the page.
// usage: node tools/paper.mjs <cols> <rows> <cell> <seed> <light|dark> [demo pairs] [hole y,x] > out.json
// prints JSON: { rows: [html per board row], width, height }
import { deal, rng, PALETTE, glyph } from '../board.js';
import { ICONS } from '../icons.js';

const [cols, rows, cell, seed] = process.argv.slice(2, 6).map(Number);
const theme = process.argv[6] ?? 'light', demo = +(process.argv[7] ?? 0);
const holes = process.argv[8] ? [process.argv[8].split(',').map(Number)] : [];
const ground = theme === 'dark' ? '#0B0B0C' : '#FFFFFF';

const { cells, pairs } = deal(cols, rows, holes, seed);
// demo state: `demo` pairs scattered over the board solved, and one unsolved card face up
const r = rng(seed + 1), state = new Map();
const names = [...new Set(cells.filter(c => !c.hole).map(c => c.name))].sort(() => r() - .5);
const solved = new Set(names.slice(0, demo));
for (const c of cells) if (!c.hole && solved.has(c.name)) state.set(c, 'done');
const open = cells.filter(c => !c.hole && !state.has(c));
if (demo && open.length) state.set(open[Math.floor(open.length * .55)], 'up');

// Paper's SVG parser trips on compact arc flags ("a.35.35 0 00-.1.5"), so paths are re-serialised with every
// number spelled out
const ARITY = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
export function normalize(d) {
  const out = [];
  let i = 0, cmd = '';
  const num = () => { const m = /^[\s,]*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/i.exec(d.slice(i)); i += m[0].length; return m[1]; };
  const flag = () => { const m = /^[\s,]*([01])/.exec(d.slice(i)); i += m[0].length; return m[1]; };
  while (i < d.length) {
    const ws = /^[\s,]*/.exec(d.slice(i))[0]; i += ws.length; if (i >= d.length) break;
    if (/[a-z]/i.test(d[i])) { cmd = d[i++]; out.push(cmd); if (cmd.toLowerCase() === 'z') continue; }
    const n = ARITY[cmd.toLowerCase()], args = [];
    for (let k = 0; k < n; k++) args.push(cmd.toLowerCase() === 'a' && (k === 3 || k === 4) ? flag() : num());
    out.push(args.join(' '));
  }
  return out.join(' ');
}
if (process.argv[2] === 'path') { process.stdout.write(normalize(ICONS[process.argv[3]])); process.exit(0); }
const gap = Math.max(2, cell * .028), f = v => +v.toFixed(2);
const tileHTML = c => {
  if (c.hole) {
    const g = f(gap);
    return `<div layer-name="Score" style="width:${cell}px;height:${cell}px;flex-shrink:0;padding:${g}px;box-sizing:border-box;display:flex;">` +
      `<div style="flex:1;border-radius:999px;background:${theme === 'dark' ? '#18181A' : '#0B0B0C'};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">` +
      `<div style="font-family:'Geist Mono';font-size:${Math.round(cell * .2)}px;line-height:1.2;font-weight:500;color:#FFFFFF;">${String(demo).padStart(2, '0')}</div>` +
      `<div style="font-family:'Geist Mono';font-size:10px;line-height:12px;font-weight:500;letter-spacing:0.14em;color:#8E8E94;">OF ${pairs}</div></div></div>`;
  }
  const [t, r, b, l] = c.jitter.map(j => f(gap * j));
  const st = state.get(c) ?? 'down', P = PALETTE[c.color];
  const radius = (st !== 'down' ? [.32, .32, .32, .32] : c.radius).map(k => f(k * cell) + 'px').join(' ');
  let inner;
  if (st === 'down' && c.kind === 'ring') {
    inner = `<div style="flex:1;border-radius:50%;border:${f(cell * .34)}px solid ${P.hex};box-sizing:border-box;"></div>`;
  } else {
    let glyphHTML = '';
    if (st !== 'down') {
      const g = glyph(c.slug, cell);
      const fill = st === 'up' ? P.up : P.tone;
      glyphHTML = `<svg width="${f(g.w)}" height="${f(g.h)}" viewBox="${g.vb}" style="position:relative;left:${f(g.ox)}px;top:${f(g.oy)}px;flex-shrink:0;"><path fill="${fill}"${g.sw ? ` stroke="${fill}" stroke-width="${g.sw}" stroke-linejoin="round"` : ''} d="${normalize(ICONS[c.slug])}"/></svg>`;
    }
    inner = `<div style="flex:1;border-radius:${radius};background:${P.hex};display:flex;align-items:center;justify-content:center;">${glyphHTML}</div>`;
  }
  return `<div style="width:${cell}px;height:${cell}px;flex-shrink:0;padding:${t}px ${r}px ${b}px ${l}px;display:flex;">${inner}</div>`;
};

const out = [];
for (let y = 0; y < rows; y++) {
  out.push(`<div layer-name="Row ${y + 1}" style="display:flex;flex-direction:row;">` + cells.filter(c => c.y === y).map(tileHTML).join('') + '</div>');
}
process.stdout.write(JSON.stringify({ rows: out, width: cols * cell, height: rows * cell }));

# basteau prototype

The landing page with the playable memo board. Static files, no build.

```bash
python3 -m http.server 4173 --directory prototype
```

Open http://localhost:4173. ES modules don't load over `file://`.

## URL params

- `?v=column|ticker|tray`: the variation (V1, V2, V3)
- `?theme=light|dark`: force a theme without storing it
- `?clean`: hide the variation switcher
- `?demo=N`: a mid-game still with N pairs solved and one card face up (for captures)
- `?grain=0`, `?spray=0`: turn off the print grain on the tiles or the spray filter on the logos

## Files

- `board.js`: the pure board model (tiling, shape cuts, palette, glyph optics). Used by the page and by `../tools/paper.mjs`, which writes a dealt board out as editable Paper layers.
- `app.js`: the DOM, the game, sound (`@web-kits/audio`), the dot field, and the theme, sound and variant controls
- `audio.js`: a trimmed `@web-kits/audio` (MIT, Raphael Salaja)
- `icons.js`: simple-icons 13.21.0 path data (CC0)
- `measure.html`: a dev tool that re-measures glyph optics (ink centroid, coverage) if icons change

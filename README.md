# basteau

Full-stack developer working in Vue, TypeScript and PHP, with a soft spot for developer tooling. Founder of [sebdev](https://sebdev.be).

This repo is my landing page, [basteau.exe.xyz](https://basteau.exe.xyz): a playable memo board of the tools I work with. Static HTML, CSS and ES modules at the repo root, no build.

## Run it

```bash
python3 tools/serve.py 4174
```

Open http://localhost:4174. ES modules don't load over `file://`, so use the server.

## Layout

- `index.html`, `app.js`, `board.js`, `audio.js`, `icons.js`, `404.html` and the icons: the site
- `tools/serve.py`: the static server used locally and in production; it serves only the site files
- `tools/paper.mjs`: exports a dealt board as editable Paper layers
- `tools/measure.html`: re-measures glyph optics if the tech icons change

Deploying: [DEPLOY.md](DEPLOY.md).

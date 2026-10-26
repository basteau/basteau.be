# basteau

Full-stack developer working in Vue, TypeScript and PHP, with a soft spot for developer tooling. Founder of [sebdev](https://sebdev.be).

This repo is my landing page, [basteau.exe.xyz](https://basteau.exe.xyz): a playable memo board of the tools I work with. Static HTML, CSS and ES modules, no build.

## Run it

```bash
python3 tools/serve.py 4174
```

Open http://localhost:4174. ES modules don't load over `file://`, so use the server.

## Layout

- `site/`: the deployed site
- `prototype/`: the design lab (variations, URL params, glyph measuring tool), never deployed. See [prototype/README.md](prototype/README.md)
- `assets/`: the source tech icons (simple-icons, CC0)
- `tools/serve.py`: the static server used locally and in production
- `tools/paper.mjs`: exports a dealt board as editable Paper layers

Deploying: [DEPLOY.md](DEPLOY.md).

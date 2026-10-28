# Deploy

The site is the static files at the repo root, no build. It's served from the exe.dev VM `basteau` at **https://basteau.exe.xyz** by `tools/serve.py`, a stdlib Python server that adds the site's own 404 page and cache headers (HTML, JS and the manifest revalidate on every load, images are cached for a day).

`FILES` in `tools/serve.py` is the list of files that ship. The server serves only those and answers 404 for everything else (`.git`, `tools/`, the docs), and the deploy below copies only those.

## Ship a change

```bash
scp -i ~/.ssh/id_exe $(python3 tools/serve.py --files) basteau.exe.xyz:site/
```

That's it. No build, no restart. If you add a file to the site, add it to `FILES` in `tools/serve.py` first. If `tools/serve.py` changes, copy it too and restart the service:

```bash
scp -i ~/.ssh/id_exe tools/serve.py basteau.exe.xyz:serve.py && ssh -i ~/.ssh/id_exe basteau.exe.xyz 'sudo systemctl restart basteau-site'
```

## Preview locally

```bash
python3 tools/serve.py 4174
```

Then open http://localhost:4174. The 404 page is at any unknown path.

## Regenerate assets

- Share card (`og.png`, 1200×630): `tools/og.html` lays it out from the board model. Run `python3 -m http.server 4175` at the repo root, screenshot http://localhost:4175/tools/og.html at 1200×630 and 2x once `body[data-ready]` is set, and scale it down to 1200×630. Then bump the `?v=` on `og:image` in `index.html`, so networks fetch the new card.
- Icons: `favicon.svg` is the source. `favicon.ico` (32), `icon-192.png`, `icon-512.png` and `apple-touch-icon.png` (180, on white) are renders of it.
- Glyph optics in `board.js` (`OPTICS`): if the tech icons change, run `python3 -m http.server 4175` at the repo root, open http://localhost:4175/tools/measure.html and read `window.optics` from the console.
- `tools/paper.mjs` deals a board from `board.js` and prints it as editable Paper layers.

## How it's set up (already done)

On the VM, the systemd service `basteau-site` runs `~/serve.py` on port 8000 with `~/site/` as its directory (only the shipped files are copied there):

```bash
ssh -i ~/.ssh/id_exe basteau.exe.xyz 'systemctl status basteau-site'
```

exe.dev proxies HTTPS to that port. To take the site down, make it private again:

```bash
ssh -i ~/.ssh/id_exe exe.dev share set-private basteau
```

## Custom domain (later)

Same recipe as sebdev.be: point an A record for the apex at the VM's IP (`dig +short basteau.exe.xyz`) and a CNAME for `www` at `basteau.exe.xyz`. Then register both:

```bash
ssh -i ~/.ssh/id_exe exe.dev domain add basteau <domain>
ssh -i ~/.ssh/id_exe exe.dev domain add basteau www.<domain>
```

Then update the canonical and `og:` URLs in `index.html`.

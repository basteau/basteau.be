# Deploy

The site is the `site/` folder: static files, no build. It's served from the exe.dev VM `basteau` at **https://basteau.exe.xyz** by `tools/serve.py`, a stdlib Python server that adds the site's own 404 page and cache headers (HTML revalidates every time, assets are cached for a day).

`prototype/` is the design lab (all three variations, `?demo=`, the variation switcher). It is never deployed.

## Ship a change

```bash
scp -i ~/.ssh/id_exe site/* basteau.exe.xyz:site/
```

That's it. No build, no restart. If `tools/serve.py` changes, copy it too and restart the service:

```bash
scp -i ~/.ssh/id_exe tools/serve.py basteau.exe.xyz:serve.py && ssh -i ~/.ssh/id_exe basteau.exe.xyz 'sudo systemctl restart basteau-site'
```

## Preview locally

```bash
python3 tools/serve.py 4174
```

Then open http://localhost:4174. The 404 page is at any unknown path.

## Regenerate assets

- OG image (`site/og.png`, 1200×630): screenshot the running site with headless Chrome at `--window-size=1200,630 --force-device-scale-factor=2`, then scale it down to 1200×630.
- Icons: `site/favicon.svg` is the source. `favicon.ico` (32), `icon-192.png`, `icon-512.png` and `apple-touch-icon.png` (180, on white) are renders of it.
- Glyph optics in `site/board.js` (`OPTICS`): re-measure with `prototype/measure.html` if the tech icons change.
- `tools/paper.mjs` deals a board from `site/board.js` and prints it as editable Paper layers.

## How it's set up (already done)

On the VM, `~/site/` is served by the systemd service `basteau-site` on port 8000:

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

Then update the canonical and `og:` URLs in `site/index.html`.

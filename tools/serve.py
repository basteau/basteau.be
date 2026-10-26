"""Static server for the site: python3 tools/serve.py [port] [dir], or --files to list what ships

The same stdlib server sebdev runs, plus the two things a public site needs: the site's own 404 page instead of
Python's, and cache headers (code revalidates every time, images are cached for a day). The site lives at the repo
root next to .git, tools/ and the docs, so only the files in FILES are ever served; everything else is a 404.
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

FILES = {
    'index.html', '404.html', 'app.js', 'audio.js', 'board.js', 'icons.js', 'site.webmanifest', 'robots.txt',
    'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og.png',
}

if sys.argv[1:] == ['--files']:
    print(' '.join(sorted(FILES)))
    sys.exit()

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent).resolve()


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.webmanifest': 'application/manifest+json'}

    def send_head(self):
        if (unquote(urlsplit(self.path).path).lstrip('/') or 'index.html') not in FILES:
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        # code revalidates on every load (cheap: unchanged files answer 304), so a deploy never pairs a new page with
        # yesterday's modules; only images are cached outright
        image = self.path.split('?')[0].endswith(('.png', '.ico', '.svg'))
        self.send_header('Cache-Control', 'public, max-age=86400' if image else 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        page = ROOT / '404.html'
        if code != 404 or not page.exists():
            return super().send_error(code, message, explain)
        body = page.read_bytes()
        self.send_response(404)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write('%s %s\n' % (self.address_string(), fmt % args))


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', PORT), partial(Handler, directory=str(ROOT))).serve_forever()

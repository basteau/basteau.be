"""Static server for site/: python3 tools/serve.py [port] [dir]

The same stdlib server sebdev runs, plus the two things a public site needs: the site's own 404 page instead of
Python's, and cache headers (HTML revalidates every time, everything else is cached for a day).
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / 'site').resolve()


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.webmanifest': 'application/manifest+json'}

    def end_headers(self):
        html = self.path.split('?')[0].endswith(('/', '.html'))
        self.send_header('Cache-Control', 'no-cache' if html else 'public, max-age=86400')
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

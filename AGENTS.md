# AGENTS.md

- Commits use Conventional Commits with a one-line subject and no body: `type(scope): subject`, e.g. `fix(site): ...`. Scopes in use: `site`, `prototype`, `tools`, `assets`.
- No build step. `site/` is what ships and is the source of truth; `prototype/` shares its origins but has diverged, so only port a change there on purpose.
- Preview with `python3 tools/serve.py 4174` (ES modules don't load over `file://`).

# AGENTS.md

- Commits use Conventional Commits with a one-line subject and no body: `type(scope): subject`, e.g. `fix(site): ...`. Scopes in use: `site`, `tools`.
- No build step. The site is the files at the repo root; `tools/serve.py` serves (and the deploy ships) only the files in its `FILES` allowlist, so a new site file must be added there.
- Preview with `python3 tools/serve.py 4174` (ES modules don't load over `file://`).

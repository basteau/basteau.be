# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Fellow developers: peers and the dev community, arriving from a link on GitHub, X or a talk recommendation, on anything from a phone to a 4K monitor. They come to see who basteau is and stay for something to play with or watch.

## Product Purpose

basteau.be is the personal site of basteau, a full-stack developer (Vue, TypeScript, PHP, developer tooling) building web apps at KU Leuven and creator of sebdev. The home page is a playable memory board of the stack. The talks page shares the programming talks basteau recommends, each linking out to its original upload. Success: a visitor remembers the site, and leaves by a contact link or to watch a talk.

## Positioning

A developer's site that shows craft by being played with instead of listing skills.

## Capabilities and Constraints

- Static HTML, CSS and ES modules at the repo root, no build step; `tools/serve.py` serves and ships only its `FILES` allowlist.
- Light and dark themes follow the system unless the visitor picks the other; motion is opt-in (`prefers-reduced-motion`), sound is the visitor's choice.
- Talks link to the original upload: the conference's or speaker's own YouTube channel, or their Vimeo where no official YouTube upload exists (The Wet Codebase, The Future of Programming).

## Brand Commitments

- The name basteau, with water in "eau"; the four-colour logo palette (magenta, cyan, orange, violet); Geist, Geist Mono and the Shantell Sans pencil hand; the dotted ground.
- Talk descriptions are neutral one-line summaries of what the talk argues. Opinions in basteau's voice come only from basteau.

## Evidence on Hand

- Ten recommended talks (title, speaker, venue, year, running time, original URL) in `talks.html`.
- No testimonials, metrics or client claims exist; none may be invented.

## Accessibility & Inclusion

Keyboard-playable, screen-reader labelled, reduced-motion respected, 44px touch targets, text contrast at WCAG AA.

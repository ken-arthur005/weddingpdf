# AGENTS.md — Interactive Wedding Invite PDF

## Project Goal
Build an interactive, clickable wedding invitation PDF (not a static one). The final
deliverable is a single polished PDF that guests can open and click through — with
working external links (RSVP form, Google Maps location) and ideally internal
navigation between sections.

## Design Direction
- **Palette / mood:** Elegant gold & white
- **Length:** 4–8 pages/sections, e.g. cover, couple's story, event details,
  schedule, RSVP, location/directions, closing note
- **Style:** Design-first. Prioritize visual polish (typography, spacing, gold
  accents, imagery) over dense text. This is more a lookbook than a document.
- Content and images will be added incrementally by the human as the build
  progresses — don't block on missing content, use clearly-labeled placeholders
  (`[COUPLE NAMES]`, `[DATE]`, `[VENUE]`, `[RSVP LINK]`, `[MAP LINK]`, placeholder
  image blocks) and keep them easy to find/replace later.

## Tech Stack
- **Node.js** project
- **Puppeteer** — renders styled HTML/CSS pages to PDF (design lives in HTML/CSS,
  not in a PDF-drawing API)
- **pdf-lib** — post-processes the rendered PDF to add:
  - External link annotations (RSVP form URL, Google Maps URL)
  - Internal navigation links between pages/sections (e.g. table of contents,
    "next" links), if included

## Build Pipeline (in order)
1. Build each invite page as its own HTML file with full CSS styling (fonts, gold/white
   theme, layout, image placeholders).
2. Use Puppeteer to render the HTML pages into a single multi-page PDF, preserving the
   design exactly as built.
3. Use pdf-lib to overlay clickable link annotations on top of the rendered PDF:
   - RSVP button/text → external RSVP form link
   - Location button/text → external Google Maps link
   - (Optional) internal jump links between sections
4. Test the output PDF in more than one viewer (e.g. Acrobat + a phone PDF viewer)
   to confirm links actually work — link rendering can differ across viewers.

## Working Agreement for the Agent
- Don't wait for full content before scaffolding — build the structure and pages now,
  swap in real names/dates/links/images as they're provided.
- Keep each section as a separate, clearly-named HTML file so individual pages can be
  edited without touching the rest.
- Flag clearly in output/comments which links are still placeholders vs. live.
- Favor clean, easy-to-tweak CSS (variables for the gold/white palette) since design
  details may change as content comes in.
# Crows PDF Importer

An unofficial Foundry VTT module for extracting content from a user's own Crows
playtest packet. Independent of the Crows system repository. No game PDFs,
extracted game content, or third-party PDF engines are included.

## Current status

**Development scaffold with a working extraction preview.** The module can
preview card segmentation and trait records/connections. It does not yet create
Foundry documents or import a complete packet.

Targets Foundry 14 and the `fvtt-crows-system` game system. Extraction uses the
host's bundled PDF.js 4.0.379. The adapter currently checks that exact PDF.js
version because font metadata and drawing-operator access are version-sensitive.
No Python or npm installation is needed by the GM.

## Local Foundry setup

1. Place this repository at `<Foundry User Data>/Data/modules/fvtt-crows-pdf-importer`.
2. Restart Foundry if needed, open a Crows world, and enable **Crows PDF Importer
   (Unofficial)** under Manage Modules.
3. As GM, create and run a Script macro:

```javascript
game.modules.get("fvtt-crows-pdf-importer").api.open();
```

Choose the core inventory-card PDF and page 1, or the Characters book with the
Trait tree layout and page 8. Page numbers refer to physical PDF pages.
All extraction happens locally in browser workers. The preview writes no world
documents, compendiums, settings or uploaded artwork. Cancel or close to stop it.

This repository is local-only at creation: no GitHub remote, published manifest,
release ZIP, or automated installation into Foundry has been configured.

## Development

Node is used only for development checks. `npm test` runs the module lifecycle
and permission checks without external dependencies. The PDF comparison and
browser tests require a locally installed Foundry copy and user-owned fixtures.

The existing system's Python baseline generator can supply the comparison data:

```powershell
../fvtt-crows-system/tools/.venv/Scripts/python.exe ../fvtt-crows-system/tools/mupdf-prototype/baseline.py --packet ../playtest2_pdfs
$env:CROWS_BASELINE = (Resolve-Path ../fvtt-crows-system/tools/out/mupdf-prototype/baseline.json).Path
$env:FOUNDRY_PDFJS = "C:/Program Files/Foundry Virtual Tabletop/resources/app/node_modules/@foundryvtt/pdfjs/"
npm run test:extraction
```

Alternatively put the generated baseline in ignored `out/baseline.json`.
A local copy is present in the initial working directory, but is not committed.
The baseline refers to the PDFs by local path. It is developer data, not a runtime
dependency. Python is only used to compare against the old parser.

For browser checks, supply an existing Playwright installation and Chrome:

```powershell
$env:PLAYWRIGHT_MODULE = "C:/path/to/playwright/index.mjs"
npm run test:browser
```

The browser harness serves the installed PDF.js directly under Foundry-style
routes, including a reverse-proxy prefix. It does not redistribute that library.
Generated comparisons and browser reports go to ignored `out/`.

## Layout

- `scripts/main.mjs`: module initialization and GM-only public API.
- `scripts/preview.mjs`: local PDF picker and preview UI.
- `scripts/worker.mjs`: extraction worker and PDF.js worker lifecycle.
- `scripts/extract.mjs`: PDF.js text, font and drawing adapter.
- `scripts/layout-parser.mjs`: Crows card and trait layout heuristics.
- `tests/`: module checks and real-PDF comparison/browser harnesses.
- [Implementation plan](docs/implementation-plan.md).

## Validation so far

The prior prototype compared 72 pages: 734 card segments and 276 traits.
71 pages match strictly; all 72 match after normalizing three invisible
separators in a profession card. Trait geometry, connections, names, costs and
descriptions match. Browser tests cover representative card and trait pages,
invalid inputs, cancellation/retry and resource paths.

Full card fields, including word-level tier-cell assignment, are not yet ported.
The runtime has been exercised in a Chrome route harness, not a live Foundry world.

## License and content

Module code is MIT licensed. PDF.js is supplied by Foundry and uses Apache-2.0.
The runtime has no MuPDF or PyMuPDF dependency. PDFs, game text, artwork and other
third-party content retain their respective rights. This project does not include
them or grant permission to redistribute them. No affiliation with MCDM or Foundry
Gaming is implied.

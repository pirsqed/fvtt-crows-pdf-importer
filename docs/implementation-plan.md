# Implementation plan

1. Complete: initial activation, module API, worker loading and file selection
   confirmed by the user in a live Foundry 14 Crows world.
2. Complete: full card parsing; all 734 cards pass full-field Python comparison.
   Full-field browser checks pass and the user confirmed live extraction.
3. Complete: map parsed cards into Crows Item source data, preserving variants
   and source metadata. All 734 mappings match legacy gameplay fields; all 734
   descriptions pass browser text/emphasis/table checks. The preview validates
   unsaved Items in a live world. Confirm that validation in Foundry next.
4. Complete: 276 trait Item mappings, corrections, prerequisites and connected-trait
   metadata across 23 trees. Curated icons remain; current previews use book icons.
5. Complete extraction/mapping: 36 backgrounds, common/full starting kits and 10
   NPC connection benefits. All match the legacy schema; background data passes
   the existing creator validator. Reviewed imports now publish a world snapshot
   consumed by the updated creator, with the generated-file fallback retained.
6. All 71 Ref-book stat blocks are now ported: animals, humans, blood creatures,
   undead and uniques, with embedded attacks/traits, source metadata, token sizes
   and unsaved validation. Artwork conversion/upload remains to port.
7. Complete for inventory, Ref-book creatures and Characters content: packet-folder discovery, multi-file fallback,
   file assignment review, page progress, cancellation and per-file results.
   Browser test covers five PDFs/142 scanned pages/734 equipment cards/71 creatures/
   276 traits/36 backgrounds/10 connection benefits, including partial-packet handling.
8. Complete: duplicate/core-precedence resolution, explicit conflict choices,
   read-only preflight, stale-review checks and saving through the system importer.
   Local edits/untracked entries are preserved; changed Actor inventories remain
   manual. Full fixture: 521 documents, all unchanged on re-import; 36 creator plans pass.
9. System integration: Settings → Import Playtest Content and Start Here now open
   the module directly. Missing/disabled/unavailable modules show setup guidance;
   the legacy importer remains an explicit option. The setup guide and READMEs
   describe browser PDF-folder extraction and reviewed imports.
   Next: verify saving and character creation in live Foundry; add remaining artwork
   and fresh-import icons. Automated repeat/failure/cancel checks pass. Package only runtime source/assets and
   license/readme files; exclude tests, fixtures, PDFs, generated content and node_modules.
10. Configure the GitHub remote, release URLs and distribution pipeline when ready.
   Remove obsolete Python/MuPDF shipping paths from the system after replacement.

Keep the PDF.js adapter isolated and version-checked. Retest when Foundry updates
its bundled PDF.js; original font-name access is not a documented Foundry API.
The importer must use only the user's own packet and must not overwrite local
document edits without an explicit user decision.

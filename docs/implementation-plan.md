# Implementation plan

1. Validate activation, module API, worker loading and file selection in a live
   Foundry 14 Crows world. Current tests cover a browser harness only.
2. Port complete card parsing and document mappings. Compare prices, qualities,
   spells, crafting and tier cells with the Python baseline, not just raw lines.
3. Port trait document generation, corrections, icons and relationships.
4. Port backgrounds/connections and their persistent storage integration.
5. Port monsters and artwork conversion/upload to user-data storage.
6. Add packet selection, progress, cancellation, validation and import reports.
7. Integrate or extract the existing system importer's duplicate detection and
   local-edit protections. Agree on the module/system API before moving code.
8. Validate repeat imports and failures. Package only runtime source/assets and
   license/readme files; exclude tests, fixtures, PDFs, generated content and node_modules.
9. Configure the GitHub remote, release URLs and distribution pipeline when ready.
   Remove obsolete Python/MuPDF shipping paths from the system after replacement.

Keep the PDF.js adapter isolated and version-checked. Retest when Foundry updates
its bundled PDF.js; original font-name access is not a documented Foundry API.
The importer must use only the user's own packet and must not overwrite local
document edits without an explicit user decision.

# Development and validation

[Back to the user guide](../README.md)

Run the commands below from the module repository root.

## Development

Node is used only for development checks. `npm test` runs the module lifecycle
and permission checks plus parser regressions without external dependencies. The PDF comparison and
browser tests require a locally installed Foundry copy and user-owned fixtures.

The existing system's Python baseline generator can supply the comparison data:

```powershell
../fvtt-crows-system/tools/.venv/Scripts/python.exe ../fvtt-crows-system/tools/mupdf-prototype/baseline.py --packet ../playtest2_pdfs
$env:CROWS_BASELINE = (Resolve-Path ../fvtt-crows-system/tools/out/mupdf-prototype/baseline.json).Path
$env:FOUNDRY_PDFJS = "C:/Program Files/Foundry Virtual Tabletop/resources/app/node_modules/@foundryvtt/pdfjs/"
npm run test:extraction
../fvtt-crows-system/tools/.venv/Scripts/python.exe tests/build-card-baseline.py --packet ../playtest2_pdfs
npm run test:cards
npm run test:items
../fvtt-crows-system/tools/.venv/Scripts/python.exe tests/build-npc-baseline.py --packet ../playtest2_pdfs
npm run test:npcs
../fvtt-crows-system/tools/.venv/Scripts/python.exe tests/build-characters-baseline.py --packet ../playtest2_pdfs
npm run test:characters
npm run test:import
```

Alternatively put the generated baseline in ignored `out/baseline.json`.
A local copy is present in the initial working directory, but is not committed.
The baseline refers to the PDFs by local path. It is developer data, not a runtime
dependency. Python is only used to compare against the old parser.

For browser checks, generate all baselines above and supply an existing Playwright installation and Chrome:

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
- `scripts/packet-preview.mjs`: folder/file selection, assignment review and batch results.
- `scripts/packet.mjs`: discovery, sequential extraction, progress and cancellation.
- `scripts/worker.mjs`: extraction worker and PDF.js worker lifecycle.
- `scripts/extract.mjs`: PDF.js text, font and drawing adapter.
- `scripts/layout-parser.mjs`: Crows card and trait layout heuristics.
- `scripts/card-parser.mjs`: complete card fields and escaped description HTML.
- `scripts/item-mapper.mjs`: Crows equipment source data, descriptions and unsaved validation.
- `scripts/npc-parser.mjs`: all Ref-book stat blocks, combat Actors and embedded attacks/traits.
- `scripts/npc-icons.mjs`: animal icon paths matching the existing importer.
- `scripts/characters-parser.mjs`: backgrounds, connection benefits, common kit and trait Item mappings.
- `scripts/import-content.mjs`: duplicate resolution, preflight, system importer integration and creator snapshot API.
- `scripts/import-review.mjs`: conflicting-definition choices and explicit review/save controls.
- `tests/`: module checks and real-PDF comparison/browser harnesses.
- [Implementation plan](implementation-plan.md).

## Validation so far

The prior prototype compared 72 pages: 734 card segments and 276 traits.
71 pages match strictly; all 72 match after normalizing three invisible
separators in a profession card. Trait geometry, connections, names, costs and
descriptions match. Browser tests cover representative card and trait pages,
invalid inputs, cancellation/retry and resource paths.

Full-field comparison passes for all 734 cards across 49 pages, including 176 tier
tables, 65 spellbooks, 78 weapons, 202 crafting records and 15 cards with variants.
There are 87 description HTML serialization differences: equivalent tag spacing
or restored spaces after labels. The comparison checks visible text and each
non-whitespace character's bold/italic emphasis, with narrow spacing allowances.
Numeric fields and record keys are checked exactly.
The baseline generator renames the Python parser's legacy crafting `uses` field
to `institution_tier` to reflect its corrected meaning; values are unchanged.

The original extraction preview has been user-tested in a live Foundry world.
The full-field extraction preview has also been user-confirmed. The new Item
mapping preview passes Chrome worker tests on representative
weapon, spell and profession pages. The user has confirmed the import workflow in live Foundry. Parsing targets this playtest packet and preserves the
Python parser's field coverage; combined spell labels are not newly interpreted.
Tier words use font metrics; uncertain multi-column splitting fails explicitly.

Folder selection is tested in Chrome against the entire local packet: three
inventory PDFs plus the Ref and Characters books: 142 scanned pages, 734 equipment
cards, 71 creatures, 276 trait Items, 36 backgrounds and 10 connection benefits. Tests also
cover multiple-file selection, duplicate assignments, renamed files, partial
packets, invalid PDFs, cancellation/retry and closing during extraction. The user has confirmed the folder flow in live Foundry.

## Backgrounds, NPC connections and traits

The Characters book is now included automatically. Backgrounds retain all 36
two-d6 table results, blurbs, characteristic choices, Stamina, starting traits,
expertise uses, equipment quantities/notes, pets and extra gold. Common equipment,
starting-gold dice and speed are read from the book. Full starting kits combine
the common kit with each background's equipment in the existing creator's schema.

Spellbook names and ranks resolve from the selected inventory PDFs after all files
have been read, regardless of file order. If inventory is missing or a rank is
ambiguous, the report retains raw backgrounds, traits and connections, lists the
problem in `backgroundIssues`, and leaves `backgrounds` empty instead of inventing
spell ranks. Include the core inventory PDF to resolve complete starting kits.

The ten NPC connection benefits include the description that continues onto the
next page. They are character-creation choices, not NPC Actor stat blocks.
Trait extraction produces 276 Items across 23 trees with XP costs, tiers,
prerequisites and connected-trait metadata. `system.prerequisites` separates
alternative trait names with ` | ` (for example, `Fight or Flight | Second Wind`),
preserving “or” within names. Starting traits retain `Starting Trait`; traits
without prerequisites use an empty string. The legacy Python generator uses the
same format. Re-extract and review/import to update previously imported traits;
the usual local-edit preservation rules still apply. Printed naming typos are normalized
as in the existing importer. Descriptions are escaped and use a generic book icon;
curated trait icons remain to be integrated.

All background fields, common-kit values, connection descriptions and trait system
fields match the Python oracle. Backgrounds also pass the existing system's actual
`validateBackgrounds` function in developer tests. Browser tests compare the full
folder output and exercise Characters-only extraction with unresolved spellbooks.
The runtime uses no Python. Publishing through the import review connects this
data to the updated system's creator. The legacy generated-file path remains
available when no module content has been published.

## NPCs and creatures

The Ref book's 71 stat blocks (32 Animal, 27 Human, 3 Blood, 8 Undead and 1 Unique) are found from their
filled boxes and stat labels, not a hardcoded page range. They map to the system's
`monster` Actor type with the printed creature type, stamina, attributes,
armor defense, and embedded `attack` and `trait` Items. Equipment and expertises
remain in the description and source metadata; equipment lists are not yet
resolved into embedded inventory. Animals and humans have neutral tokens; other
types are hostile. Huge tokens occupy 2×2 squares and Holy Shit sizes 3×3, matching
the existing builder. Undead names retain the builder's normalization. This does
not create village resident records.

Animal and unique icons match the legacy builder's core Foundry icon choices.
Blood/undead creatures currently use a fallback icon; converting and uploading
the packet's separate illustrations remains a later step. Full Actor comparisons
use the legacy builder without its optional generated artwork map.

The comparison checks every parsed block and mapped Actor against the legacy
Python builder, with explicit corrections: two expertise labels containing
`(2 uses all)` are now recognized, and three attacks retain all features sharing
an asterisk marker instead of only the last. As in the existing builder, a Power
value in the NPC's name takes precedence over a conflicting printed Power stat;
the original stat remains in source metadata. Source PDF pages were visually
reviewed. NPC markup is escaped before description HTML is generated.

The folder preview includes NPC summaries, `actors`, `npcRecords`, and
`actorValidation`. In Foundry, validation checks temporary Actors and their
embedded Items without saving them. The user has confirmed the import workflow in live Foundry; browser tests use the real PDF.js worker and compare all
71 creatures, while isolated tests exercise the validation path with test doubles.

All 734 Item mappings match the old Python builder's gameplay fields and default
icons. Browser DOM checks also match all 734 descriptions' text, emphasis and
tier-table shape, allowing the documented spacing differences. These checks do
not replace validation against a running Foundry world's actual Item class.

## Item mapping

Lore Books containing “This book relates to the <expertise> Lore expertise” gain
that expertise in parentheses: `Lore Book (Nature)`, `Lore Book (Monster)`,
`Lore Book (Historical)`, or `Lore Book (Magic)`. Unspecified books remain
`Lore Book`. Both the module and legacy builder apply this naming rule. The
current packet imports all variants without a Lore Book conflict. Existing
unsuffixed imports are not automatically renamed or deleted; re-import adds
missing named variants while retaining the usual preservation rules.

All cards use the system's `equipment` Item type. Weapon rolls, armor defense,
spellbook flags, consumable effects/usage dice and supply capacities populate
the existing system fields. Spellbook ranks remain in Item names so different
ranks have distinct names. Fine/Masterwork variants remain options on the base
Item, matching the existing builder; they are not separate generated Items.

The `fvtt-crows-pdf-importer` flag namespace retains source set/page/card index,
structured crafting (including `institution_tier`), variants, spell metadata and
magic slot. `system.crafting` retains the printed crafting line because the
current system schema uses a string. Source flags are separate from the existing
system importer's tracking flags; a preview never marks an Item as imported.

Extraction maps each printed card independently, using Foundry's generic default
icons. The import review then resolves repeated definitions and retains existing
artwork. Curated icons for fresh imports and creature artwork upload remain to do.

## Import verification

Unit and browser tests use the real system import implementation with in-memory
Foundry document/setting stand-ins. They cover conflict choices, stale reviews,
local edits, untracked entries, Actor preservation, locks, cancellation/retry,
failed writes and constructor input mutation. The complete fixture run creates
521 documents, republishes creator data, builds all 36 background plans using the
system's real creation rules, and leaves all 521 documents unchanged on re-import.
Creator integration tests cover module loading and legacy fallback. These are
automated harness checks; no test wrote to the user's live Foundry world, and the
user has confirmed the save flow in live Foundry.

## License and content

Module code is MIT licensed. PDF.js is supplied by Foundry and uses Apache-2.0.
The runtime has no MuPDF or PyMuPDF dependency. PDFs, game text, artwork and other
third-party content retain their respective rights. This project does not include
them or grant permission to redistribute them. No affiliation with MCDM or Foundry
Gaming is implied.


## Module API

The system's Settings entry point opens the importer. For custom Script macros:

```javascript
game.modules.get("fvtt-crows-pdf-importer").api.open();
```

`api.getCharacterContent()` returns the published creator content, or `null` when
none has been published. Opening the importer requires a GM in a Crows world.

# Development and validation

[Back to the user guide](../README.md)

Run the commands below from the module repository root.

## Development

Node is used only for development checks. `npm test` runs the module lifecycle
and permission checks plus parser regressions without external dependencies. The PDF comparison and
browser tests require a locally installed Foundry copy and user-owned fixtures.

### Current packet regression checks

These checks run the real extractor against a local packet, verify edition-specific
counts and known boundary/metadata failures, import into a disposable in-memory
world, publish all 36 backgrounds, and confirm unchanged re-imports. The browser
check also exercises folder discovery, the real PDF.js worker, conflict detection,
review, saving and completion. It does not connect to a live Foundry world.

```powershell
$env:CROWS_PACKET_ROOT = (Resolve-Path ../playtest3).Path
$env:CROWS_PLAYTEST_VERSION = "3"
$env:PLAYWRIGHT_MODULE = "C:/path/to/playwright/index.mjs"
npm run test:packet
npm run test:packet-browser
# Repeat with your Playtest 2 packet and CROWS_PLAYTEST_VERSION = "2".
```

Reports and browser screenshots go into ignored `out/playtest-*.json` and PNGs.
No PDFs or extracted game text ship with the module. Unit tests use synthetic
layouts for wrapped titles and slot requirements, cards without Stack labels,
shared creature boxes, wrapped damage, renamed books, wearable metadata and both
Miasma table layouts. Both official packets must have zero definition conflicts;
the integration checks no longer choose arbitrary conflict candidates to complete
an import. V3 must retain all five ordinary/enchanted pairs and the belt-note
Healing Potion: 984 printed card occurrences and 716 imported documents.

Explicit printed Enchantment labels produce a structured `enchantment` value,
retained in importer flags, the item description and traits. The item name gains
the enchantment in parentheses while provenance keeps the printed name. Only the
known dungeon Creature Part comma variation is ignored during comparison. The
Healing Potion preference requires an otherwise identical item whose sole extra
prose is the final belt-slot/one-maneuver note; price or effect changes still
conflict, and supplement overrides retain ordinary review.

### Historical parser comparisons

The system consumes `flags["fvtt-crows-pdf-importer"].wearable`, legacy `magicSlot`, and `spell.rank` directly, including with the module disabled. Nullable system overrides support custom items. The importer does not need to populate new schema defaults; the system's fingerprint ignores null wearable/rank defaults while preserving explicit overrides. Unknown ranks must never generate numeric Rank 0 traits. Mixed-case Book tokens in printed titles normalize to Book so Greater Animal Form retains its printed rank and casting fields. Existing malformed names and embedded copies are reviewed manually; they are not deleted or replaced by this normalization.

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

These historical oracles retain known old-parser omissions: 20 v2 spell cards
leave combined range/duration text in prose, and the v2 Fine Coin Purse is absent.
The current parser promotes that metadata into spell fields and recovers the
purse (735 v2 card occurrences instead of 734). Exact historical snapshot checks
therefore report those intended differences; use the packet checks above for
current compatibility validation. Other v2 card fields were compared separately
and retained. The v2 creature/table regression counts remain 71 and 22.

For browser checks, generate all baselines above and supply an existing Playwright installation and Chrome:

```powershell
$env:PLAYWRIGHT_MODULE = "C:/path/to/playwright/index.mjs"
npm run test:browser
npm run test:review-browser
```

The browser harness serves the installed PDF.js directly under Foundry-style
routes, including a reverse-proxy prefix. It does not redistribute that library.
Generated comparisons and browser reports go to ignored `out/`.

`test:review-browser` needs Playwright and Chrome but no PDFs or installed Foundry.
It uses 521 synthetic entries to check the scroll boundaries and persistent controls
at desktop, narrow and short viewport sizes, plus entry status, cancellation, failed
saves, retry, stale reviews and completion details. Screenshots go to `out/review-*.png`.

The full browser suite also checks the local five-page spell-card supplement when
present at `../playtest2_pdfs/Inventory Cards/Crows Spells for Patreon.pdf` (override
with `CROWS_ADDITIONAL_PDF`). This fixture contains 81 spellbooks across pages with
17, 20, 20, 20 and 4 cards. It checks renamed files, two simultaneous additional
PDFs, provenance, duplicate collapse, filename-labelled conflict choices, standalone
import, unchanged re-import, preservation of creator content, and an HTML download
mixed with a valid PDF. The test reports a skip when the local fixture is absent;
the copyrighted PDF and extracted content are not committed.

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
curated trait icons are now applied from the reviewed core-icon map.

All background fields, common-kit values, connection descriptions and trait system
fields match the Python oracle. Backgrounds also pass the existing system's actual
`validateBackgrounds` function in developer tests. Browser tests compare the full
folder output and exercise Characters-only extraction with unresolved spellbooks.
The runtime uses no Python. Publishing through the import review connects this
data to the updated system's creator. The legacy generated-file path remains
available when no module content has been published.

## NPCs and creatures

The PDF importer creates nine Actor folders inside `world.crows-bestiary`: Animal,
Human, Monster, Unique, and Monster's Blood/Undead/Plant/Demon/Angel children.
`system.type` chooses the destination; Elemental currently maps to Unique, and
other unclassified types use Monster. **Follow-up:** add Monster / Elemental if
more Elemental creatures are introduced. Re-import moves selected Elementals
from the root Monster folder to Unique, preserving their content and any custom
folder assignment elsewhere. Preflight records
folder destinations and includes existing folder data in the stale-review check.
Folder creation uses Foundry's Folder document API with the compendium's `pack`
option. It runs after Actor content imports, then applies folder-only updates to
selected unfiled Actors and the Elemental correction, including preserved entries. Other existing folder choices and
unselected Actors stay untouched. Preserved Actors are classified by their current
type, and ambiguous folder names stop preflight. Partial folder creation or filing
can be retried without duplication. Creator snapshots strip compendium folder IDs.
Unit tests cover these cases, failures and cancellation; v2/v3 browser packet tests
verify every folder's population and a second save with unchanged folder IDs.

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

All 734 Item mappings match the earlier builder's gameplay fields. Curated icon
choices are checked separately against the installed Foundry core icon library.
Browser DOM checks also match all 734 descriptions' text, emphasis and
tier-table shape, allowing the documented spacing differences. These checks do
not replace validation against a running Foundry world's actual Item class.

## Item mapping

The repeatable `cards` source is for additional card PDFs and maps to Equipment &
Spellbooks. Official packet sources retain their single-file checks. Unknown names
can be assigned manually; card/spell filenames are hints, not content validation.
The worker records the additional PDF's filename/path in `source.file` alongside
its page and card index. Provenance is excluded when comparing duplicate candidate
definitions. Core precedence removes only profession candidates, so differing
supplement definitions remain available for explicit conflict resolution.

Additional cards use the shared parser with flexible title/metadata recognition;
the established packet parsing rules remain unchanged. Small book titles still
require the adjacent Stack label, and metadata parsing recognizes actual labels
rather than interpreting arbitrary prose. Starting-kit spell ranks use core cards
when present, so adding supplemental ranks cannot change core character kits.

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
artwork. Curated icons now cover fresh equipment and trait imports; creature artwork upload remains to do.

## Import verification

`npm run test:tables` extracts the user-owned Playtest 2 Ref PDF, checks all 21
tables / 394 results, verifies complete die coverage and the approved errata,
and checks repeat imports alongside all 71 creatures. Set `CROWS_REF_PDF` to
override the PDF path and `FOUNDRY_PDFJS` to override the installed PDF.js path.
The parser uses ruled-cell geometry and a version-specific page/region map;
unexpected headers, row counts, empty cells, or uncovered/overlapping results
fail extraction. It bundles no result text. Unit tests cover wrapped cells and
table replacement, edit protection, invalid data, locks and stale reviews.

The browser packet check now imports 543 documents, including 22 RollTables
(21 from the Ref book and Miasma Effects from the Rules Book),
and verifies all remain unchanged on repeat import. The original content-only
fixture run below still covers its 521 Item/Actor documents. RollTable payloads
have also been checked against the installed Foundry 14.367 base document
schema; live-world saves of this new table feature still need a play check.

Unit and browser tests use the real system import implementation with in-memory
Foundry document/setting stand-ins. They cover conflict choices, stale reviews,
local edits, untracked entries, Actor preservation, locks, cancellation/retry,
failed writes and constructor input mutation. The complete fixture run creates
521 documents, republishes creator data, builds all 36 background plans using the
system's real creation rules, and leaves all 521 documents unchanged on re-import.
Creator integration tests cover module loading and legacy fallback. These are
automated harness checks; no test wrote to the user's live Foundry world, and the
user has confirmed the save flow in live Foundry.

The internal `executeImport` function accepts `onEntry({id,name,status,message})`.
IDs combine the target pack and the system source key, including a trait's tree.
Statuses are `importing`, `created`, `updated`, `unchanged`, `preserved`, and `failed`;
`message` is supplied for failures. The supported system importer calls `onProgress`
once before each entry. The module confirms the preceding entry at the next callback,
and the final entry when `importPack` resolves, using the result counter changes to
identify the outcome. Completion therefore includes the tracking-flag write and
needs no new system API. Cancellation is checked after acknowledging the completed
entry, before announcing the next one. Unit tests cover this callback contract,
including a tracking failure after document creation and duplicate trait names.

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

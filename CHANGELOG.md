# Changelog

## 0.1.0

First release of the browser-based Crows playtest importer.

- Select a packet folder or individual PDFs, then choose entries with search,
  category filters and checkboxes before reviewing the import.
- Extract equipment, dungeon loot, 276 traits, 71 creatures, 36 backgrounds and
  10 NPC connection choices from the supported public playtest packet.
- Publish imported starting content to the paired system's character creator.
- Preserve local edits and custom artwork by default; optionally overwrite
  imported fields and creature inventories after review.
- Separate Lore Book variants by their printed expertise and use book icons.
- Store trait prerequisite alternatives with a pipe separator.
- Show progress, cancellation, validation and import results in a Crow-style UI.

### Requirements and limitations

Foundry 14 with bundled PDF.js 4.0.379, the user's own playtest packet, and a
compatible Crows system build containing the PDF import/creator integration and
force-overwrite adapter are required. The system version number alone does not
identify that integration yet; coordinate both releases before publishing.

Some fresh-import icons are generic. Separate creature-artwork import is pending.
Force overwrite replaces embedded Item IDs on updated compendium Actors. It does
not change Actors or Items already copied into a world or onto character sheets.
No PDFs, extracted game content or third-party PDF engine are included.

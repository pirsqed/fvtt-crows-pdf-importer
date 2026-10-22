# Changelog

## 0.3.0 — prepared

First release for the third playtest packet (Playtest 3). Pair with Crows system v0.3.0.

- Recognize mixed-case printed Book titles, restoring Greater Animal Form BooK R3 as a castable rank-3 spellbook. Unknown supplemental spell ranks now remain unknown instead of producing a false Rank 0 badge/trait. Review older carried copies and obsolete malformed names separately.

- Organize the Bestiary compendium into Animal, Human, Monster, and Unique, with Blood, Undead, Plant, Demon, and Angel inside Monster. Elementals use Unique for now; will add an Elemental subfolder under Monster if more are introduced. Re-import also moves Elementals previously filed directly in Monster to Unique. Other unclassified types use Monster directly. Re-import files selected unfiled NPCs without replacing their content or changing other existing folder assignments. Folder destinations appear in review; repeated imports reuse folders, and interrupted organization can be retried.
- Support the Playtest 3 packet alongside Playtest 2, including the renamed Character and Ref booklets. Extract 985 printed cards, 117 creatures, 276 traits, 44 roll tables, 36 backgrounds and 10 NPC connections from v3.
- Keep enchanted dungeon loot as separate entries with enchantment suffixes, preserving both ordinary and enchanted versions. Prefer the otherwise identical Healing Potion with the printed belt-slot clarification and combine the cosmetic Creature Part comma variation. The current v3 packet imports without definition conflicts.
- Recognize Unidentified Item cards without Stack labels, including four previously missed v3 cards, and prevent their text from merging into neighbouring items. Read wrapped slot requirements correctly; both NDT Longbows occupy two slots.
- Keep wrapped and small card titles together, split creatures sharing a shaded box, and read wrapped attack damage. Check card and creature counts against printed labels so omitted entries fail extraction instead of silently merging into adjacent content. This also restores the previously missed Fine Coin Purse in v2.
- Read combined spell metadata in all card sets, retain wearable labels in item descriptions and importer flags, preserve Lore Book subjects in item names, and use the printed capacity for Fine Coin Purses. Wearable slot enforcement remains a system feature.
- Import the v3 Angel, Blood, Demon, Plant and Undead Dungeon Encounters tables from the Ref Book bestiary, matching the names the Any Monster Encounter results use. Import the v3 Backlashes table (1d100 + spell rank, results 1–105) from the Rules Book; its misprinted 62-64 result is imported as 63-64 with a warning.
- Join a creature's stat block that continues into the next column box, restoring Elemental of Regret's Warp World, Sorrow, Two Extra Actions and No Prone features and Strange Brain's 17+ result. Read usage dice labels wrapped across two lines, restoring the core Hurling Wand's UD. Import Zaziel's Book of Elation as one castable spellbook with 6 UD (2 for each of its three spells) and its card text unchanged; its rank is left unknown, so the casting dialog asks for it.
- Use separate v2/v3 table layouts and edition-specific notes. Include v3 combat terrain, outdoor behavior, treasure, material and enchantment tables. The v3 Miasma-Touched Humans table omits 29; preserve it as an explicit Ref-choice/reroll result with a warning instead of assigning an invented creature.
- **Existing worlds:** re-import the v3 packet and review changed definitions, renamed books and preserved creature entries. Enchanted loot now uses suffixed names; review older, locally edited entries that were preserved under the original names. Publish character-creation content after resolving conflicts. Re-importing does not update actors/items already copied into a world or remove obsolete v2 compendium entries.
- Differences in NPC naming will likely leave a few orphaned NPC entries in an existing world's Bestiary compendium after importing the Playtest 3 PDFs. Compare the old and new entries and remove obsolete copies manually, keeping any customized versions you still use; the importer does not remove older entries automatically.

- Import one or several additional inventory/spell-card PDFs independently of the original packet. Preserve source filenames, combine identical copies, and require explicit choices for differing definitions, including conflicts with core cards. Additional cards import into Equipment & Spellbooks without replacing published character-creation data in a standalone import.
- Support supplementary spell-card layouts with small titles, wrapped ranks and casting labels, variable or wrapped ranges, combined metadata lines, and prices printed at body-text size. Validate all 81 cards in the five-page spell supplement through extraction, import and unchanged re-import. Recognize web pages saved with a `.pdf` extension and explain how to download the actual PDF.
- Keep the import review table in its own scroll area with persistent column headings. Progress, the current entry, and import controls remain visible while browsing long lists. Each entry shows pending, importing, added, updated, unchanged, preserved, or failed status; completed results remain available from the completion screen. Cancellation and failures retain the results of completed entries for review and retry. Compatible with existing supported system versions.
- PDF selection and extraction now have separate screens. After choosing PDFs, the footer's Next: Extract PDFs button starts extraction and opens the results screen; Back to PDFs preserves the selection for changes or retries.
- Finish appears only after a successful import, on a completion screen summarizing added, updated, unchanged, and preserved entries. Failed or cancelled imports remain available for review and retry.

- Successful PDF entries can still be reviewed and imported when another PDF fails or starting kits are unresolved. Character-creation publishing is disabled with an explanation until those issues are resolved; existing creator content is preserved and document validation remains required.

- Detect the Rules Book and extract its Miasma Effects table into Crows Ref Tables. The Crows system uses it for Miasma effect rolls instead of bundling the table text.
- Import NPC tokens at their rules sizes: Large 2×2, Huge 3×3, Holy Shit! 4×4 (previously 1×1, 2×2 and 3×3). **Existing compendium NPCs:** re-import the Ref book with **Force overwrite** to update their prototype tokens, or adjust tokens already placed in scenes by hand.

## 0.1.2 — prepared

Requires Foundry 14. Use with Crows system v0.2.3 for structured NPC speed editing. The minimum system version remains v0.2.2 for existing import functionality.

- Parse NPC speeds into base speed and named movement types for the updated Crows NPC speed editor. Preserve special movement annotations as notes and retain the original speed text.
- **Existing NPC speeds:** Re-import the Ref book to update imported compendium entries, reviewing any entries preserved because of local edits. Actors already copied into a world or scene are not updated by re-importing; use the pencil beside Speed on each NPC sheet to review and save their speeds manually. Use this importer update with the Crows system update that includes the NPC speed editor.

## 0.1.1 — prepared

- Extract all 21 numbered Ref book tables into a selectable Ref Tables RollTable compendium (394 results). Bad Weather includes an odd/even reminder and Ref book page references.
- Retain multi-page descriptions, source references, weighted ranges and the special 101+ treasure result. Apply approved Minor Interesting Things and undead encounter errata.
- Validate and re-import RollTables through the paired system importer, preserving local edits by default.

- Improve curated equipment and trait icons.

Requires Foundry 14 and Crows system v0.2.2 or later for RollTable imports. No PDFs or extracted game content are bundled. Travel-branch features are deferred.

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
- Use curated Foundry icons for named equipment, loot and traits in fresh imports;
  upgrade earlier generic placeholders on re-import while retaining custom art.
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

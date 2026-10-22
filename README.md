# Crows PDF Importer

Import your own Crows playtest PDFs into Foundry VTT: equipment, dungeon loot, traits, creatures, rollable tables, backgrounds and NPC connections. Choose a packet folder, select the entries you want and review changes before saving.

Requires **Foundry 14**, **Crows v0.2.2 or later**. The current adapter supports Foundry's bundled PDF.js **4.0.379**. Extraction runs in the browser.

Supports **Playtest 2 and Playtest 3** packets. For Playtest 3, use **Crows system v0.3.0 and PDF Importer v0.3.0** for shared Effort and the other v3 rules. Select one edition's packet at a time.

## Using the importer

The Ref imports the packet once for the world. Players then use the compendiums and **Create a Crow**. For hosted games, select the PDFs on the computer running the Ref's browser; reviewed content is saved in the Foundry world.

### 1. Install and enable

From Foundry's Setup screen, open **Add-on Modules → Install Module**, paste this URL into **Manifest URL**, and click **Install**:

```text
https://github.com/pirsqed/fvtt-crows-pdf-importer/releases/latest/download/module.json
```

This link follows the latest published stable release. Enable the module in your world under **Settings → Manage Modules**, then reload. For a specific older version, use the `module.json` asset from that version's GitHub release.

Install **Crows PDF Importer** alongside the system and enable it under **Settings → Manage Modules**. Reload the world. Open **Settings → Configure Settings → Crows → Import Playtest Content**, or use **Open PDF Importer** in **Start Here**. No macro is needed.

For manual installation, extract the module release ZIP with `module.json` at the root of `Data/modules/fvtt-crows-pdf-importer` on the Foundry host, then restart Foundry. Use system v0.3.0 and importer v0.3.0 for the third playtest packet. The system provides guidance if the module is missing, disabled or unavailable.

### 2. Choose and extract the PDFs

Extract your playtest ZIP on the computer running your browser. Keep the original filenames and subfolders. For a complete library, include the **Characters book**, **Ref book**, **Rules Book**, **core Inventory Cards**, **Profession cards**, and **POI/Dungeon cards**.

Choose **Packet folder** to include subfolders, or **Individual PDFs** to choose the books directly. Check each file's assigned content type; renamed files can be assigned manually. Skip duplicate copies and unrelated books. Click **Extract selected PDFs** and wait for the results, then **Choose entries & review →**.

Extraction saves nothing to your world. **Extraction results** contains the per-book details; **Developer tools & extraction data** is available when troubleshooting.

The Playtest 2 Ref book supplies **21 RollTables with 394 results** to **Crows Ref Tables**: encounter, reaction, merchant and treasure tables. The Bad Weather result reminds the Ref to roll any die, use odd/even to select the first/second event for the current climate or season, and consult Ref book pages 1–2. Multi-page descriptions and printed probabilities are retained. Results are text; references to another table or creature do not automatically roll or create tokens. Resistance-roll tiers, attack charts and the Merchant NPC lookup are not random tables.

The Playtest 2 Rules Book supplies the **Miasma Effects** table (page 28) to the same compendium. Each result's name is its first effect and its description is the second effect. The Crows system reads this table when a Crow rolls on the Miasma Effects table; without it, the roll card shows only the total. The Playtest 3 Rules Book also supplies the **Backlashes** table (pages 32–35). The Ref rolls 1d100 and adds the triggering spell's rank, so results run to 105; the system's casting card reminds the Ref to roll but does not roll this table itself.

Approved Playtest 2 corrections: Minor Interesting Things uses 46 for gems, 57 for steel crossbow bolts, and 58–59 for the fine torch. The undead encounter table is named **Undead Dungeon Encounters** and uses **d10**. Source pages and corrections appear in table descriptions. Major Interesting Things retains its **101+** Greed Exchange result for modified rolls; the normal formula remains d100. Do not normalize this table, as that would change its printed ranges.

This feature requires the accompanying system importer update for RollTable validation and saving. Update both the system and module together. To import only tables, deselect all entries and choose the **Ref Tables** category, then select visible entries.

### 3. Select what to import

All extracted entries start selected. Use the checkboxes to choose individual entries, or narrow the list with search and the category filter. **Select visible** and **Deselect visible** affect only the entries currently shown; hidden selections stay selected. The selection count shows the total that will be reviewed.

For example, to import only Nature Lore Books: clear the search, choose **All categories**, click **Deselect visible**, search for `Lore Book (Nature)`, and select the entries you want.

Repeated copies are combined, and core inventory takes precedence over matching profession cards. Lore Books are named for their printed expertise—Nature, Monster, Historical or Magic—with plain **Lore Book** for an unspecified expertise. If other entries have conflicting definitions, choose a definition or skip the entry.

### Additional card PDFs

Use **Individual PDFs** to select one or several extra spellbook or inventory-card PDFs. Choose **Additional inventory / spell cards** for each file; likely spell/card filenames are assigned automatically, and renamed PDFs can be assigned manually. You do not need the rest of the playtest packet for this import.

Click **Next: Extract PDFs →**, then **Choose entries & review →**. Additional cards go into **Equipment & Spellbooks**, using the same selection, review and local-edit protection as packet imports. Character-creation publishing is off when no Characters book is included, so adding spellbooks preserves previously published starting kits.

Identical cards across files are combined. Differing definitions, including an additional card matching a core card, require an explicit choice; the choices identify the source filename and page. The original core-over-profession precedence still applies only to profession copies.

This supports PDFs with selectable text using the Crows inventory/spell-card layout, including small spellbook titles, wrapped ranks and casting labels, and combined range/target/duration lines. Scanned images, prose-only spell lists and unrelated card layouts are not supported. If a downloaded file is actually a web page saved with a `.pdf` extension, download the PDF attachment itself while signed in and select that file.

### 4. Choose import options

- **Update character-creation content:** publishes backgrounds, NPC connections and starting-kit content for **Create a Crow** after a successful import. It is available when the complete background/connection data was extracted. Required equipment, traits and pets must be selected or already present in the world compendiums. Leave this on for initial setup; turn it off for a standalone item or creature import. Turning it off keeps previously published creator content.
- **Force overwrite existing entries:** off by default. Enable it to replace imported fields on edited or untracked matches and to replace an imported creature's embedded Items, including attacks and traits. Parent document IDs, custom artwork, folders and ownership remain. Embedded Item IDs change. Ambiguous duplicate matches are still preserved.

### 5. Review and save

As the active GM, click **Check world and review changes**. Unlock any locked target compendiums first. Read the result for each selected entry:

| Result | Meaning |
| --- | --- |
| **create** | Add a new entry to the compendium. |
| **update** | Update an existing entry, retaining its parent ID. In force mode, this can replace local edits and creature inventories. |
| **unchanged** | The imported content is already current. |
| **preserve** | Keep the existing entry; the Details column explains why. |

Click **Import selected entries** to save. Changing selections or import options requires a new review. A world change detected after review also requires another check.

The review table scrolls separately, keeping progress and controls visible. Its **Action** column shows the planned change; **Status** shows whether each entry is pending, importing, added, updated, unchanged, preserved or failed. The progress bar counts successfully processed entries, including unchanged and preserved entries. After completion, expand **View entry results** to inspect the list, then click **Finish**.

The Playtest 3 packet extracts **985 card occurrences, 276 traits, 117 creatures and 44 roll tables**, including four Unidentified Item cards and one Unfinished Craftable Item card without Stack labels. Repeated cards are combined during review, producing **210 equipment entries, 76 dungeon-loot entries, 276 traits, 117 creatures and 44 tables** across five world compendiums. The current packet has no unresolved definition conflicts. Deselecting entries reduces those totals. Character-creation publishing adds **36 backgrounds and 10 NPC connection choices** to the creator; they are not separate compendiums.

Enchanted loot uses suffixes such as **Greatsword (Flaming)**, keeping both the ordinary and enchanted items. The importer uses the otherwise identical Healing Potion with the printed belt-slot note and combines the harmless Creature Part comma variation. Other differing definitions still require review. Re-import to receive these fixes; check any older, locally edited loot preserved under its original name. Items already copied onto actors or scenes need separate review.

Playtest 2 remains supported: **134 equipment entries, 41 dungeon-loot entries, 276 traits, 71 creatures and 22 tables**. The extra loot entry compared with older importer versions is the previously missed Fine Coin Purse.

The **Bestiary** compendium organizes NPCs into **Animal**, **Human**, **Monster**, and **Unique**. Monster contains **Blood**, **Undead**, **Plant**, **Demon**, and **Angel** subfolders. Elementals use **Unique** for now; add an **Elemental** subfolder under Monster if more are introduced. Other unclassified types go directly in Monster. Re-import the Ref booklet to organize existing unfiled NPCs as well as new imports, and move Elementals previously filed directly in Monster to Unique. Folder assignments are shown in the review and reuse existing folders. Other already-filed NPCs keep their folders, and filing preserved entries changes only their folder, not their stats or inventory. These folders are inside the compendium; actors already copied into your world are unchanged.

V3 table layouts are separate from v2; old errata are not applied to the new book. The v3 Miasma-Touched Humans table skips result 29. Its imported result explicitly asks the Ref to choose or reroll, and the extraction notes flag the omission. Wearable items retain a visible badge and structured importer metadata; equipping restrictions are handled by the system.

The updated system reads wearable metadata for shared magic slots and spell metadata for rank-aware Chaos. Custom items can be configured without the importer. Greater Animal Form's printed **BooK R3** title is now recognized as a spellbook. Unknown supplemental ranks remain unknown; real rank 0 remains valid. Review older malformed copies after reimport, and confirm custom ranks on the item sheet. The v3 Wound Closure core and dungeon cards print different ranks, so both versions remain available for the Ref to choose.

### Re-importing and troubleshooting

By default, re-importing updates unedited tracked Items, preserves local edits and older untracked entries, and preserves changed creature inventories. Custom artwork is retained; the generic bag icon on a Lore Book is corrected to a book icon. Imports affect the world compendiums, not copies already placed on character sheets or scenes.

When upgrading an existing world to v3, review the preserved creatures and conflicting definitions, then publish the updated character-creation content. Use Force overwrite only for the selected entries whose imported data you want to replace. Renamed entries can coexist with their older names; obsolete v2 entries are not deleted automatically. Review equipment and NPCs already copied into the world separately.

**Stop after current entry** keeps completed changes. A failed import can also leave partial changes, especially during forced creature-inventory replacement. Read the result, correct the problem and review again before retrying. Creator content is published only after the import succeeds. After editing compendiums, repeat the review/import with **Update character-creation content** enabled to refresh what the creator uses.

Table imports use the same local-edit protection. Updating an unedited table replaces its embedded results while retaining the table ID; force overwrite also replaces locally edited results. A failure during result replacement may leave partial results; resolve the failure and review with force overwrite to retry that entry.

- **Missing starting spellbooks:** extract the core inventory PDF together with the Characters book.
- **Missing creator reference:** include the named equipment, trait or pet, or turn off creator publishing for a standalone import.
- **Preserved duplicate match:** resolve the duplicate compendium entries manually; force overwrite does not choose between them.
- **Extraction failed:** check the book assignment and packet version. Include the error and PDF/page details when reporting an issue.

Named equipment, loot and traits use curated Foundry core icons. Items without a curated match use a category icon. Importing the packet's separate creature artwork is still pending. Future packet layouts may need an importer update.

## Development and limits

The user has confirmed extraction, imports and the updated UI in live Foundry. Automated checks cover parser comparisons, selective review, preservation/overwrite behavior, cancellation and repeat imports. These checks use local user-owned PDFs and an isolated Foundry test harness.

See [development and validation](docs/development.md) for commands, API details, field mappings and remaining work. [The implementation plan](docs/implementation-plan.md) tracks integration and release tasks. Version 0.1.1 packaging and a draft-release workflow are prepared. See [release instructions](docs/releasing.md) for build commands, installation assets and the paired-system requirement.

## License

Module code is MIT licensed. PDF.js is provided by Foundry and uses Apache-2.0; no PDF engine is bundled. PDFs, extracted game content and artwork are not included and retain their respective rights. This module is unofficial and is not affiliated with MCDM or Foundry Gaming.

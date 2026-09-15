# Crows PDF Importer

Import your own Crows playtest PDFs into Foundry VTT: equipment, dungeon loot, traits, creatures, backgrounds and NPC connections. Choose a packet folder, select the entries you want and review changes before saving.

Requires **Foundry 14**, **Crows (Unofficial) v0.2.1** and a compatible importer module. The current adapter supports Foundry's bundled PDF.js **4.0.379**. Extraction runs in the browser.

## Using the importer

The Ref imports the packet once for the world. Players then use the compendiums and **Create a Crow**. For hosted games, select the PDFs on the computer running the Ref's browser; reviewed content is saved in the Foundry world.

### 1. Install and enable

Install **Crows PDF Importer (Unofficial)** alongside the system and enable it under **Settings → Manage Modules**. Reload the world. Open **Settings → Configure Settings → Crows (Unofficial) → Import Playtest Content**, or use **Open PDF Importer** in **Start Here**. No macro is needed.

Install the module release ZIP with `module.json` at the root of `Data/modules/fvtt-crows-pdf-importer` on the Foundry host, then restart Foundry. Until a public release is available, a development checkout can be installed at the same path. Pair it with Crows system v0.2.1. The system provides guidance if the module is missing, disabled or unavailable.

### 2. Choose and extract the PDFs

Extract your playtest ZIP on the computer running your browser. Keep the original filenames and subfolders. For a complete library, include the **Characters book**, **Ref book**, **core Inventory Cards**, **Profession cards**, and **POI/Dungeon cards**.

Choose **Packet folder** to include subfolders, or **Individual PDFs** to choose the books directly. Check each file's assigned content type; renamed files can be assigned manually. Skip duplicate copies and unrelated books. Click **Extract selected PDFs** and wait for the results, then **Choose entries & review →**.

Extraction saves nothing to your world. **Extraction results** contains the per-book details; **Developer tools & extraction data** is available when troubleshooting.

### 3. Select what to import

All extracted entries start selected. Use the checkboxes to choose individual entries, or narrow the list with search and the category filter. **Select visible** and **Deselect visible** affect only the entries currently shown; hidden selections stay selected. The selection count shows the total that will be reviewed.

For example, to import only Nature Lore Books: clear the search, choose **All categories**, click **Deselect visible**, search for `Lore Book (Nature)`, and select the entries you want.

Repeated copies are combined, and core inventory takes precedence over matching profession cards. Lore Books are named for their printed expertise—Nature, Monster, Historical or Magic—with plain **Lore Book** for an unspecified expertise. If other entries have conflicting definitions, choose a definition or skip the entry.

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

The complete current packet produces **134 equipment entries, 40 dungeon-loot entries, 276 traits and 71 creatures** across four world compendiums—521 entries total. Character-creation publishing adds **36 backgrounds and 10 NPC connection choices** to the creator; they are not separate compendiums.

### Re-importing and troubleshooting

By default, re-importing updates unedited tracked Items, preserves local edits and older untracked entries, and preserves changed creature inventories. Custom artwork is retained; the generic bag icon on a Lore Book is corrected to a book icon. Imports affect the world compendiums, not copies already placed on character sheets or scenes.

**Stop after current entry** keeps completed changes. A failed import can also leave partial changes, especially during forced creature-inventory replacement. Read the result, correct the problem and review again before retrying. Creator content is published only after the import succeeds. After editing compendiums, repeat the review/import with **Update character-creation content** enabled to refresh what the creator uses.

- **Missing starting spellbooks:** extract the core inventory PDF together with the Characters book.
- **Missing creator reference:** include the named equipment, trait or pet, or turn off creator publishing for a standalone import.
- **Preserved duplicate match:** resolve the duplicate compendium entries manually; force overwrite does not choose between them.
- **Extraction failed:** check the book assignment and packet version. Include the error and PDF/page details when reporting an issue.

Some fresh-import icons remain generic; importing the packet's separate creature artwork is still pending. Future packet layouts may need an importer update.

## Development and limits

The user has confirmed extraction, imports and the updated UI in live Foundry. Automated checks cover parser comparisons, selective review, preservation/overwrite behavior, cancellation and repeat imports. These checks use local user-owned PDFs and an isolated Foundry test harness.

See [development and validation](docs/development.md) for commands, API details, field mappings and remaining work. [The implementation plan](docs/implementation-plan.md) tracks integration and release tasks. Version 0.1.0 packaging and a draft-release workflow are prepared. See [release instructions](docs/releasing.md) for build commands, installation assets and the paired-system requirement. Public distribution is not yet live.

## License

Module code is MIT licensed. PDF.js is provided by Foundry and uses Apache-2.0; no PDF engine is bundled. PDFs, extracted game content and artwork are not included and retain their respective rights. This module is unofficial and is not affiliated with MCDM or Foundry Gaming.

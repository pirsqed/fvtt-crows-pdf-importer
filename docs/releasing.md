# GitHub release process

Push an existing `vX.Y.Z` version tag to run the Release workflow, or select **Actions → Release → Run workflow** and enter an existing tag. Manual runs also offer an explicit prerelease checkbox; tag pushes create ordinary release drafts.

Both repositories use Node 22 and Python 3.12. The workflow verifies the tag checkout, runs fixture-free regression and release-tooling tests, builds runtime assets, and validates the tag/version, package version when present, release download URL, embedded/external manifests, ZIP integrity, and declared runtime files.

Release notes come from exactly the matching `## X.Y.Z` section of `CHANGELOG.md`, ending at the next level-two heading. Nested headings are preserved. Missing, empty, or duplicate sections fail the build. The release heading omits the changelog's “prepared” suffix. GitHub-generated PR summaries are not used.

The workflow creates a draft titled `vX.Y.Z` with the ZIP, manifest, and `SHA256SUMS.txt`. Review its notes and assets on GitHub, then publish. For paired system/importer updates, prepare both drafts and publish the companion importer before the system when the system notes require that importer.

The existing draft or published release is never automatically overwritten: `gh release create` fails if that release already exists. Inspect it before deciding whether to delete an incomplete draft and rerun. Published versions should receive a new version/tag rather than replacement assets.

Local preparation uses the normal release builder followed by:

```text
python tools/prepare_release.py --output dist --manifest module.json --repository pirsqed/fvtt-crows-pdf-importer --tag vX.Y.Z
```

Use `system.json` for the system or `module.json` for the importer. The system builder needs `--output dist/fvtt-crows-system.zip`, then copy `system.json` into `dist`; the importer builder writes into `dist` and needs `--repository pirsqed/fvtt-crows-pdf-importer --tag vX.Y.Z`.


## Companion tests and private fixtures

The hosted workflow checks out a pinned system commit beside the importer for its import-content integration tests. Update that pin when the tested adapter changes; do not follow a moving branch for release checks. The current pin contains the same adapter as the v0.2.3 candidate.

Private-packet comparisons and browser checks remain local. Use `npm run test:tables`, `npm run test:items`, `npm run test:characters`, `npm run test:import`, and `npm run test:browser` with the fixtures described in [development.md](development.md).

## Installation and stable updates

The public installation and update URL is:

```text
https://github.com/pirsqed/fvtt-crows-pdf-importer/releases/latest/download/module.json
```

Keep the asset named `module.json`, publish the intended stable draft, and ensure it is marked Latest. Draft assets are not public installation links; prereleases do not replace the stable update link. For a prerelease, use that release's versioned manifest asset.

The builder adds installation URLs to the released manifest. Use that asset rather than the raw source manifest from main. Its download URL points to the exact version's ZIP.

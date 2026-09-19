# Releasing the module

## Current preparation

Version 0.1.1 is prepared locally, paired with Crows system v0.2.2 or later.
The system must provide RollTable imports as well as the import adapter, creator
integration, and force-overwrite support. Travel-branch work is deferred.
Nothing has been published by this preparation.

## Build and check

Run from the module repository root:

```sh
npm test
python -m unittest discover -s tests -p test_release.py
python tools/build_release.py --repository pirsqed/fvtt-crows-pdf-importer --tag v0.1.1
```

The repository argument supplies installation URLs without changing the source
manifest. Omit it for an offline ZIP with no new installation URLs. The builder
checks version/tag agreement, referenced runtime files, archive integrity and
reproducibility. It includes only runtime `.mjs` files, Markdown documentation,
the manifest and license. PDFs, generated content, tests, tools, dependencies and
local reports are excluded. Python is a maintainer build tool only.

Outputs in ignored `dist/`:

- `fvtt-crows-pdf-importer.zip`: installable module with `module.json` at its root.
- `module.json`: the same manifest embedded in the ZIP.
- `SHA256SUMS.txt`: checksums for both assets.

Run `npm run test:tables`, `npm run test:items`, `npm run test:characters`, `npm run test:import` and
`npm run test:browser` locally with the private fixtures described in
[development.md](development.md). The hosted workflow runs only fixture-free
tests that do not require the sibling system checkout or a Foundry installation.

## Draft and publish

1. Configure the intended GitHub repository and commit the reviewed source.
2. Update `module.json`, `package.json` and `CHANGELOG.md` together for later versions.
3. Push a matching `vX.Y.Z` tag, or run the Release workflow manually with that tag.
4. The workflow builds the package and creates a **draft** GitHub release with
   the ZIP, manifest and checksums. Review its notes and requirements.
5. Check installation from the ZIP in a clean world with the compatible system:
   enable the module, import a small selection, publish a full creator library,
   create a Crow, repeat the import, and check force overwrite on test entries.
6. Publish the draft only when the compatible system is available. The installation
   URL is `https://github.com/pirsqed/fvtt-crows-pdf-importer/releases/latest/download/module.json`.

Draft assets are not public installation links. The downloadable manifest points
at a version-specific ZIP, so a later tag cannot change that release's payload.

## Stable manifest link

The user-facing installation URL is:

```text
https://github.com/pirsqed/fvtt-crows-pdf-importer/releases/latest/download/module.json
```

Keep the asset named `module.json` on every stable release. Publish the Actions-generated draft as a stable release and ensure the intended release is marked Latest. Drafts and prereleases are not served by this stable-release link. Until a stable release with that asset exists, the link will not work.

The generated manifest uses this stable URL for update checks, while its `download` points to the ZIP for its exact version. Do not substitute the raw source manifest from `main`: the build adds the installation URLs to the release asset. For a prerelease or a specific version, use that release's versioned `module.json` asset URL instead.

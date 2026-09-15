import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

spec = importlib.util.spec_from_file_location("release", Path(__file__).resolve().parents[1] / "tools/build_release.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def test_package_contents_urls_and_reproducibility(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            manifest = dict(id="test-module", version="0.1.0", esmodules=["scripts/main.mjs"], readme="README.md", license="LICENSE")
            files = {"module.json": json.dumps(manifest), "package.json": '{"version":"0.1.0"}',
                     "scripts/main.mjs": "export {};", "README.md": "Readme", "LICENSE": "License", "CHANGELOG.md": "Changes",
                     "docs/development.md": "Notes", "out/private.json": "secret", "pdfs/book.pdf": "pdf",
                     "tests/fixture.json": "secret", "scripts/fixture.pdf": "pdf", "node_modules/dependency/index.js": "code"}
            for name, text in files.items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text)
            archive = release.build(root, "owner/repo", "v0.1.0")
            first = archive.read_bytes()
            with ZipFile(archive) as z:
                self.assertEqual(set(z.namelist()), release.TOP | {"scripts/main.mjs", "docs/development.md"})
                built = json.loads(z.read("module.json"))
                self.assertEqual(built["download"], "https://github.com/owner/repo/releases/download/v0.1.0/test-module.zip")
                self.assertEqual(z.read("module.json"), (root / "dist/module.json").read_bytes())
            release.build(root, "owner/repo", "v0.1.0")
            self.assertEqual(first, archive.read_bytes())
            with self.assertRaisesRegex(ValueError, "Tag"):
                release.build(root, tag="v9.0.0")


if __name__ == "__main__":
    unittest.main()

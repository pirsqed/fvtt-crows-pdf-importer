"""Build a runtime-only Foundry module archive with Python's standard library."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
TOP = {"module.json", "README.md", "LICENSE", "CHANGELOG.md"}


def build(root=ROOT, repository=None, tag=None):
    root = Path(root).resolve()
    manifest = json.loads((root / "module.json").read_text(encoding="utf-8"))
    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    version = manifest["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version) or version != package["version"]:
        raise ValueError("Release versions must match and use X.Y.Z")
    if tag is not None and tag != f"v{version}":
        raise ValueError("Tag must match the module version")
    if repository:
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
            raise ValueError("Repository must be owner/name")
        base = f"https://github.com/{repository}"
        manifest.update(url=base, manifest=f"{base}/releases/latest/download/module.json",
                        download=f"{base}/releases/download/v{version}/{manifest['id']}.zip",
                        bugs=f"{base}/issues")
    files = set(TOP)
    files.update(p.relative_to(root).as_posix() for p in (root / "scripts").rglob("*.mjs"))
    files.update(p.relative_to(root).as_posix() for p in (root / "docs").glob("*.md"))
    for entry in manifest.get("esmodules", []) + [manifest["readme"], manifest["license"]]:
        if entry not in files:
            raise ValueError(f"Manifest references unpackaged file: {entry}")
    contents = {}
    for name in sorted(files):
        path = root / name
        if path.is_symlink() or not path.resolve().is_relative_to(root):
            raise ValueError(f"Release source escapes repository: {name}")
        contents[name] = path.read_bytes()
    contents["module.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
    out = root / "dist"
    out.mkdir(exist_ok=True)
    archive = out / f"{manifest['id']}.zip"
    with ZipFile(archive, "w") as zip_file:
        for name, content in contents.items():
            info = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            zip_file.writestr(info, content)
    with ZipFile(archive) as zip_file:
        if zip_file.testzip() is not None or set(zip_file.namelist()) != set(contents):
            raise ValueError("Archive verification failed")
    (out / "module.json").write_bytes(contents["module.json"])
    hashes = [f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}" for path in [archive, out / "module.json"]]
    (out / "SHA256SUMS.txt").write_text("\n".join(hashes) + "\n", encoding="utf-8")
    return archive


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", help="GitHub owner/name for installation URLs")
    parser.add_argument("--tag", help="Expected release tag, e.g. v0.1.0")
    args = parser.parse_args()
    print(build(repository=args.repository, tag=args.tag))

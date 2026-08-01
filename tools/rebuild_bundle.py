#!/usr/bin/env python3
"""
rebuild_bundle.py — Re-encode the materialised tree back into DGO_Target_CLEAN_RUNTIME.state.json.

Usage:
    python3 tools/rebuild_bundle.py [--check] [bundle_path] [source_dir]

Defaults:
    bundle_path = DGO_Target_CLEAN_RUNTIME.state.json  (repo root)
    source_dir  = .  (current directory)

The bundle mirrors exactly the runtime file set described by `retainedRules` in
CLEAN_PACKAGE_MANIFEST.json, plus that manifest itself.  The set is recomputed from disk on
every run, so a phase that introduces or removes a runtime file needs no hand-editing:

  - path on disk and in the bundle -> re-encoded, sha256/size refreshed, all other metadata
    (notably `mode` and the `binary` flag) preserved verbatim
  - path on disk only             -> added, with metadata synthesised the same way
  - path in the bundle only       -> removed, and reported

`directories` and the `summary` counters are recomputed from the resulting file set.

Serialisation is one JSON key per line.  The bundle is ~940 KB; written as a single line, any
edit to any bundled file rewrote the whole thing and produced a ~1.9 MB diff that no review
tool could digest.  Indented, the same edit touches only that file's `content`, `sha256` and
`size` lines.  The schema and the parsed value are unchanged — `json.load` yields exactly the
same object either way.

`--check` writes nothing and exits non-zero if the bundle is not byte-identical to what a
rebuild would produce.  That is the cheap answer to "is the bundle current?".

A rebuild that would change nothing writes nothing, so `generatedAt` only moves when the
bundle's contents actually move and a no-op rebuild never dirties the tree.

Round-trip contract: expand -> rebuild -> expand yields identical sha256 values.
"""

import argparse
import base64
import datetime
import hashlib
import json
import pathlib
import sys

BUNDLE_DEFAULT = "DGO_Target_CLEAN_RUNTIME.state.json"
PACKAGE_MANIFEST = "CLEAN_PACKAGE_MANIFEST.json"
FALLBACK_MODE = "0o100666"


def _rules(root: pathlib.Path) -> list:
    """Runtime file set definition: the package manifest's retainedRules, plus the manifest."""
    manifest = root / PACKAGE_MANIFEST
    if not manifest.is_file():
        return []
    with manifest.open(encoding="utf-8") as fh:
        retained = json.load(fh).get("retainedRules", [])
    return [PACKAGE_MANIFEST] + list(retained)


def _discover(root: pathlib.Path, rules: list) -> list:
    """Expand the retainedRules globs against the tree. Returns sorted POSIX-style paths."""
    found = set()
    for rule in rules:
        if rule.endswith("/**"):
            base = root / rule[:-3]
            if not base.is_dir():
                continue
            for path in base.rglob("*"):
                if path.is_file():
                    found.add(path.relative_to(root).as_posix())
        elif (root / rule).is_file():
            found.add(pathlib.PurePosixPath(rule).as_posix())
    return sorted(found)


def _is_binary(data: bytes) -> bool:
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        return True
    return b"\x00" in data


def _default_mode(files: dict) -> str:
    """Reuse the mode the existing bundle records, so new entries stay machine-independent."""
    modes = {}
    for entry in files.values():
        mode = entry.get("mode")
        if mode:
            modes[mode] = modes.get(mode, 0) + 1
    if not modes:
        return FALLBACK_MODE
    return max(modes.items(), key=lambda item: (item[1], item[0]))[0]


def _encode(entry: dict, rel_path: str, data: bytes, default_mode: str) -> dict:
    """Refresh (or synthesise) a single file entry, preserving unrelated metadata."""
    name = pathlib.PurePosixPath(rel_path).name
    # An existing entry owns its own `binary` decision — assets/*.svg are recorded as binary
    # even though they decode as text, and flipping that would rewrite the whole entry.
    binary = entry["binary"] if "binary" in entry else _is_binary(data)

    entry["type"] = "file"
    entry["path"] = rel_path
    entry["name"] = name
    entry["size"] = len(data)
    entry.setdefault("mode", default_mode)
    entry["sha256"] = hashlib.sha256(data).hexdigest()
    entry["extension"] = pathlib.PurePosixPath(rel_path).suffix
    entry["binary"] = binary
    if binary:
        entry.pop("encoding", None)
        entry["contentEncoding"] = "base64"
        entry["content"] = base64.b64encode(data).decode("ascii")
    else:
        entry["encoding"] = "utf-8"
        entry["contentEncoding"] = "text"
        entry["content"] = data.decode("utf-8")
    return entry


def _serialise(state: dict) -> str:
    return json.dumps(state, ensure_ascii=False, indent=1) + "\n"


def rebuild(bundle_path: str = BUNDLE_DEFAULT, source_dir: str = ".",
            check: bool = False) -> int:
    bundle = pathlib.Path(bundle_path)
    if not bundle.is_file():
        print(f"ERROR: bundle not found: {bundle}", file=sys.stderr)
        return 1

    print(f"Loading {bundle} …")
    original = bundle.read_text(encoding="utf-8")
    state = json.loads(original)

    root = pathlib.Path(source_dir)
    existing = state.get("files", {})
    default_mode = _default_mode(existing)

    rules = _rules(root)
    if rules:
        paths = _discover(root, rules)
    else:
        # No package manifest: fall back to the paths the bundle already records.
        print(f"WARNING: {PACKAGE_MANIFEST} not found; keeping the recorded path set.",
              file=sys.stderr)
        paths = sorted(existing)

    files = {}
    total_bytes = 0
    text_count = 0
    binary_count = 0
    added = []
    missing = []

    for rel_path in paths:
        src = root / rel_path
        if not src.is_file():
            missing.append(rel_path)
            continue
        entry = existing.get(rel_path)
        if entry is None:
            entry = {}
            added.append(rel_path)
        files[rel_path] = _encode(entry, rel_path, src.read_bytes(), default_mode)
        total_bytes += files[rel_path]["size"]
        if files[rel_path]["binary"]:
            binary_count += 1
        else:
            text_count += 1

    if missing:
        for rel_path in missing:
            print(f"MISSING: {rel_path}", file=sys.stderr)
        print(f"\nABORTED: {len(missing)} declared file(s) not on disk.", file=sys.stderr)
        return 1

    dropped = sorted(set(existing) - set(files))

    directories = sorted({
        parent.as_posix()
        for rel_path in files
        for parent in pathlib.PurePosixPath(rel_path).parents
        if parent.as_posix() != "."
    })

    state["files"] = files
    state["directories"] = directories
    summary = state.setdefault("summary", {})
    summary["totalFiles"] = len(files)
    summary["totalDirectories"] = len(directories)
    summary["totalBytes"] = total_bytes
    summary["textFiles"] = text_count
    summary["binaryFiles"] = binary_count

    out = _serialise(state)

    for rel_path in added:
        print(f"ADDED:   {rel_path}")
    for rel_path in dropped:
        print(f"DROPPED: {rel_path}")

    if out == original:
        print(f"Bundle is current: {len(files)} files, {total_bytes:,} bytes.")
        return 0

    stale = [p for p, e in existing.items()
             if p in files and e.get("sha256") != files[p]["sha256"]]

    if check:
        print("\nDRIFT: the bundle does not match the tree. "
              "Run `python3 tools/rebuild_bundle.py`.", file=sys.stderr)
        for rel_path in stale:
            print(f"STALE:   {rel_path}", file=sys.stderr)
        return 1

    # Only a rebuild that actually changes something restamps the bundle.
    state["generatedAt"] = datetime.datetime.now(datetime.timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ")
    bundle.write_text(_serialise(state), encoding="utf-8")
    for rel_path in stale:
        print(f"UPDATED: {rel_path}")
    print(
        f"Rebuilt {bundle}: {len(files)} files, "
        f"{text_count} text + {binary_count} binary, "
        f"{total_bytes:,} bytes total."
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1].strip())
    parser.add_argument("--check", action="store_true",
                        help="report drift and exit non-zero instead of writing")
    parser.add_argument("bundle_path", nargs="?", default=BUNDLE_DEFAULT)
    parser.add_argument("source_dir", nargs="?", default=".")
    args = parser.parse_args()
    return rebuild(args.bundle_path, args.source_dir, args.check)


if __name__ == "__main__":
    sys.exit(main())

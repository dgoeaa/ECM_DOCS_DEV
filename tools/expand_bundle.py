#!/usr/bin/env python3
"""
expand_bundle.py — Materialise DGO_Target_CLEAN_RUNTIME.state.json into a real filesystem tree.

Usage:
    python3 tools/expand_bundle.py [bundle_path] [output_dir]

Defaults:
    bundle_path = DGO_Target_CLEAN_RUNTIME.state.json  (repo root)
    output_dir  = .  (current directory — files land at their bundle paths)

Each entry in files[path]:
  - contentEncoding == 'text'   → write content as UTF-8
  - contentEncoding == 'base64' → write base64.b64decode(content)

Every file's sha256 is verified after writing.  Aborts on any mismatch.
Reports a final count that must equal summary.totalFiles.
"""

import base64
import hashlib
import json
import pathlib
import sys


def expand(bundle_path: str = "DGO_Target_CLEAN_RUNTIME.state.json",
           output_dir: str = ".") -> None:
    bundle = pathlib.Path(bundle_path)
    if not bundle.is_file():
        print(f"ERROR: bundle not found: {bundle}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {bundle} …")
    with bundle.open(encoding="utf-8") as fh:
        state = json.load(fh)

    schema = state.get("schema", "")
    if not schema.startswith("dgo-embedded-state"):
        print(f"WARNING: unexpected schema '{schema}'", file=sys.stderr)

    summary = state.get("summary", {})
    expected_count = summary.get("totalFiles", 0)
    files = state.get("files", {})

    root = pathlib.Path(output_dir)

    verified = 0
    errors = []

    for rel_path, entry in files.items():
        dest = root / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)

        encoding = entry.get("contentEncoding", "text")
        content_raw = entry.get("content", "")

        if encoding == "base64":
            data = base64.b64decode(content_raw)
        else:
            data = content_raw.encode("utf-8")

        dest.write_bytes(data)

        actual_sha = hashlib.sha256(data).hexdigest()
        expected_sha = entry.get("sha256", "")

        if actual_sha != expected_sha:
            errors.append(
                f"SHA256 MISMATCH: {rel_path}\n"
                f"  expected: {expected_sha}\n"
                f"  actual:   {actual_sha}"
            )
        else:
            verified += 1

    if errors:
        for err in errors:
            print(err, file=sys.stderr)
        print(f"\nABORTED: {len(errors)} verification failure(s).", file=sys.stderr)
        sys.exit(1)

    print(f"Verified {verified}/{len(files)} files OK.")
    if expected_count and verified != expected_count:
        print(
            f"WARNING: expected {expected_count} files from summary but wrote {verified}.",
            file=sys.stderr,
        )
    else:
        print(f"All {verified} files verified — matches summary.totalFiles.")


if __name__ == "__main__":
    args = sys.argv[1:]
    bundle = args[0] if len(args) > 0 else "DGO_Target_CLEAN_RUNTIME.state.json"
    outdir = args[1] if len(args) > 1 else "."
    expand(bundle, outdir)

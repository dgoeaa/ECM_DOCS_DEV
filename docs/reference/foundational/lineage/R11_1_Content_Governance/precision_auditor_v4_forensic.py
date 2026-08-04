#!/usr/bin/env python3
"""
Precision Auditor v4 Forensic Exporter
======================================

Purpose
-------
Creates a full-fidelity, machine-verifiable platform state export for AI and
human review. The primary artifact is a path-keyed JSON state file containing
all discovered directories, files, symlinks, metadata, embedded contents, and
validation ledgers.

Design guarantees
-----------------
1. No summarisation or truncation of file contents.
2. Directories are represented as first-class state entries, including empty folders.
3. Files are keyed by exact relative path for reliable AI lookup.
4. UTF-8 text is stored as JSON text only when byte-perfect round-trip safe.
5. Non-UTF-8 or binary payloads are stored as base64 of the exact bytes.
6. SHA-256 and byte-length validation is embedded and self-checked after export.
7. Skipped paths and errors are explicitly recorded; nothing is silently omitted.
8. Chunk/volume exports are generated for AI platforms with upload/context limits.

Default scan policy
-------------------
By default, this script scans the entire selected root, including hidden files
and backup files. The only automatic runtime exclusion is the current output
folder created by this run. Any additional exclusion must be explicitly supplied
by CLI flags and will be written to the skipped ledger.
"""

from __future__ import annotations

import argparse
import base64
import fnmatch
import hashlib
import html
import json
import mimetypes
import os
import platform
import shutil
import sys
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

SCHEMA = "forensic-platform-state/v1"
DEFAULT_CHUNK_SIZE = 500 * 1024  # JSON text bytes per volume target; not a content truncation limit.
TEXT_EXTS = {
    ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".html", ".htm", ".css", ".scss",
    ".json", ".jsonc", ".txt", ".md", ".markdown", ".webmanifest", ".sh", ".bash",
    ".py", ".yml", ".yaml", ".xml", ".csv", ".ini", ".toml", ".env", ".example",
    ".svg", ".sql", ".ps1", ".bat", ".cmd", ".gitignore", ".dockerignore", ".editorconfig",
}
BINARY_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz", ".7z",
    ".rar", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp3", ".mp4", ".mov", ".avi",
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".bin", ".exe", ".dll",
}
VCS_GLOBS = [".git", ".git/**", ".hg", ".hg/**", ".svn", ".svn/**"]
NODE_GLOBS = ["node_modules", "node_modules/**"]
CACHE_GLOBS = ["__pycache__", "__pycache__/**", ".pytest_cache", ".pytest_cache/**", ".mypy_cache", ".mypy_cache/**"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def safe_rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix() or "."


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def atomic_write_text(path: Path, text: str, encoding: str = "utf-8") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding=encoding, newline="") as f:
            f.write(text)
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def atomic_write_json(path: Path, obj: Any, indent: int = 2) -> None:
    atomic_write_text(path, json.dumps(obj, indent=indent, ensure_ascii=False), encoding="utf-8")


def clean_id(name: str, max_len: int = 18) -> str:
    out = "".join(c.lower() for c in name if c.isalnum() or c in ("-", "_"))
    return (out[:max_len] or "root").strip("-_") or "root"


def likely_text_bytes(data: bytes, suffix: str) -> bool:
    if suffix.lower() in TEXT_EXTS:
        return True
    if suffix.lower() in BINARY_EXTS:
        return False
    if not data:
        return True
    sample = data[:8192]
    if b"\x00" in sample:
        return False
    # Conservative printable ratio heuristic for unknown file types.
    printable = sum(1 for b in sample if b in (9, 10, 13) or 32 <= b <= 126 or b >= 128)
    return printable / max(1, len(sample)) >= 0.92


def decode_text_lossless(data: bytes) -> Tuple[Optional[str], Optional[str], bool]:
    """Return (text, encoding, bom_removed). Only returns text if round-trip exact."""
    for enc in ("utf-8", "utf-8-sig", "utf-16", "utf-16-le", "utf-16-be"):
        try:
            text = data.decode(enc)
            if text.encode(enc) == data:
                return text, enc, enc.endswith("sig")
            # utf-8-sig decode removes BOM; preserve exactness by testing utf-8 re-encoding plus BOM.
            if enc == "utf-8-sig" and ("\ufeff" + text).encode("utf-8") == data:
                return "\ufeff" + text, "utf-8", False
        except UnicodeError:
            continue
    return None, None, False


def matches_any_glob(rel_path: str, patterns: Iterable[str]) -> Optional[str]:
    normalized = rel_path.strip("/")
    parts = normalized.split("/") if normalized else []
    for pat in patterns:
        pat = pat.strip().replace("\\", "/")
        if not pat:
            continue
        if fnmatch.fnmatch(normalized, pat) or fnmatch.fnmatch("/" + normalized, pat):
            return pat
        # Directory-name shortcuts, e.g. pattern node_modules catches a segment anywhere.
        if "/" not in pat and pat in parts:
            return pat
    return None


@dataclass
class ExportOptions:
    root: Path
    out_dir: Path
    chunk_size: int = DEFAULT_CHUNK_SIZE
    ignore_globs: List[str] = field(default_factory=list)
    follow_symlinks: bool = False
    dual_encode_text: bool = False
    make_volumes: bool = True
    exclude_hidden: bool = False
    include_report: bool = True


class ForensicAuditor:
    def __init__(self, options: ExportOptions) -> None:
        self.opt = options
        self.root = options.root.resolve()
        self.out_dir = options.out_dir.resolve()
        self.root_id = clean_id(self.root.name)
        self.generated_at = utc_now_iso()
        self.started_local = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.directories: Dict[str, Dict[str, Any]] = {}
        self.files: Dict[str, Dict[str, Any]] = {}
        self.symlinks: Dict[str, Dict[str, Any]] = {}
        self.skipped: List[Dict[str, Any]] = []
        self.errors: List[Dict[str, Any]] = []
        self.events: List[str] = []

    def log(self, msg: str) -> None:
        self.events.append(msg)
        print(msg)

    def _record_skip(self, rel: str, reason: str, pattern: Optional[str] = None) -> None:
        self.skipped.append({"path": rel, "reason": reason, "pattern": pattern, "timestamp": utc_now_iso()})

    def _record_error(self, rel: str, stage: str, exc: BaseException) -> None:
        self.errors.append({"path": rel, "stage": stage, "errorType": type(exc).__name__, "message": str(exc)})

    def _should_skip(self, path: Path, rel: str) -> bool:
        # Never scan the current output folder created by this run; record it explicitly.
        try:
            if path.resolve() == self.out_dir or self.out_dir in path.resolve().parents:
                self._record_skip(rel, "current_export_output_dir", self.out_dir.name)
                return True
        except Exception:
            pass
        if self.opt.exclude_hidden:
            parts = [p for p in Path(rel).parts if p not in (".", "")]
            hidden = next((p for p in parts if p.startswith(".")), None)
            if hidden:
                self._record_skip(rel, "hidden_path_excluded_by_option", hidden)
                return True
        pattern = matches_any_glob(rel, self.opt.ignore_globs)
        if pattern:
            self._record_skip(rel, "explicit_ignore_glob", pattern)
            return True
        return False

    def _dir_entry(self, path: Path, rel: str) -> Dict[str, Any]:
        st = path.stat() if self.opt.follow_symlinks else path.lstat()
        try:
            child_names = sorted(p.name for p in path.iterdir())
        except Exception as e:
            self._record_error(rel, "list_directory", e)
            child_names = []
        return {
            "type": "directory",
            "path": rel,
            "name": path.name,
            "modified": datetime.fromtimestamp(st.st_mtime).isoformat(),
            "mode": oct(st.st_mode),
            "childCount": len(child_names),
            "children": child_names,
        }

    def _symlink_entry(self, path: Path, rel: str) -> Dict[str, Any]:
        st = path.lstat()
        target = os.readlink(path)
        return {
            "type": "symlink",
            "path": rel,
            "name": path.name,
            "target": target,
            "modified": datetime.fromtimestamp(st.st_mtime).isoformat(),
            "mode": oct(st.st_mode),
            "followed": False,
        }

    def _file_entry(self, path: Path, rel: str) -> Dict[str, Any]:
        st = path.stat()
        data = path.read_bytes()
        suffix = path.suffix.lower() or path.name.lower() if path.name.startswith(".") else path.suffix.lower()
        digest = sha256_bytes(data)
        mime, _ = mimetypes.guess_type(path.name)
        entry: Dict[str, Any] = {
            "type": "file",
            "path": rel,
            "name": path.name,
            "size": len(data),
            "modified": datetime.fromtimestamp(st.st_mtime).isoformat(),
            "mode": oct(st.st_mode),
            "sha256": digest,
            "mime": mime,
            "extension": path.suffix.lower(),
        }

        textish = likely_text_bytes(data, path.suffix)
        text, encoding, _ = decode_text_lossless(data) if textish else (None, None, False)
        if text is not None and encoding is not None:
            entry.update({
                "binary": False,
                "encoding": encoding,
                "contentEncoding": "text",
                "content": text,
            })
            if self.opt.dual_encode_text:
                entry["content_base64"] = base64.b64encode(data).decode("ascii")
                entry["contentEncodingAlso"] = "base64"
        else:
            entry.update({
                "binary": True,
                "encoding": None,
                "contentEncoding": "base64",
                "content_base64": base64.b64encode(data).decode("ascii"),
                "binaryReason": "known_or_detected_binary" if not textish else "text_decode_not_lossless",
            })
        return entry

    def scan(self) -> None:
        if not self.root.exists() or not self.root.is_dir():
            raise NotADirectoryError(f"Root is not a directory: {self.root}")
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.log(f"[scan] root={self.root}")
        self.log(f"[scan] output={self.out_dir}")

        # Include root directory itself.
        try:
            self.directories["."] = self._dir_entry(self.root, ".")
        except Exception as e:
            self._record_error(".", "root_directory_entry", e)

        for current, dirnames, filenames in os.walk(self.root, topdown=True, followlinks=self.opt.follow_symlinks):
            current_path = Path(current)
            current_rel = safe_rel(current_path, self.root)
            if current_rel != "." and self._should_skip(current_path, current_rel):
                dirnames[:] = []
                continue

            # Filter directory traversal topdown and record skipped directories.
            kept_dirs: List[str] = []
            for d in sorted(dirnames):
                d_path = current_path / d
                d_rel = safe_rel(d_path, self.root)
                if self._should_skip(d_path, d_rel):
                    continue
                if d_path.is_symlink() and not self.opt.follow_symlinks:
                    try:
                        self.symlinks[d_rel] = self._symlink_entry(d_path, d_rel)
                    except Exception as e:
                        self._record_error(d_rel, "symlink_directory", e)
                    continue
                kept_dirs.append(d)
            dirnames[:] = kept_dirs

            for d in kept_dirs:
                d_path = current_path / d
                d_rel = safe_rel(d_path, self.root)
                try:
                    self.directories[d_rel] = self._dir_entry(d_path, d_rel)
                except Exception as e:
                    self._record_error(d_rel, "directory_entry", e)

            for f in sorted(filenames):
                f_path = current_path / f
                f_rel = safe_rel(f_path, self.root)
                if self._should_skip(f_path, f_rel):
                    continue
                try:
                    if f_path.is_symlink() and not self.opt.follow_symlinks:
                        self.symlinks[f_rel] = self._symlink_entry(f_path, f_rel)
                    elif f_path.is_file():
                        self.files[f_rel] = self._file_entry(f_path, f_rel)
                        self.log(f"[file] {f_rel}")
                    else:
                        self._record_skip(f_rel, "non_regular_file")
                except Exception as e:
                    self._record_error(f_rel, "file_read", e)

    def summary(self) -> Dict[str, Any]:
        total_bytes = sum(int(v.get("size", 0)) for v in self.files.values())
        binary_count = sum(1 for v in self.files.values() if v.get("binary") is True)
        text_count = sum(1 for v in self.files.values() if v.get("binary") is False)
        return {
            "schema": SCHEMA,
            "rootName": self.root.name,
            "rootPath": str(self.root),
            "generatedAt": self.generated_at,
            "totalDirectories": len(self.directories),
            "totalFiles": len(self.files),
            "totalSymlinks": len(self.symlinks),
            "totalBytes": total_bytes,
            "textFiles": text_count,
            "binaryFiles": binary_count,
            "skippedCount": len(self.skipped),
            "errorCount": len(self.errors),
            "chunkSizeTargetBytes": self.opt.chunk_size,
            "scanPolicy": {
                "followSymlinks": self.opt.follow_symlinks,
                "excludeHidden": self.opt.exclude_hidden,
                "ignoreGlobs": self.opt.ignore_globs,
                "currentOutputDirExcluded": True,
            },
        }

    def state(self) -> Dict[str, Any]:
        return {
            "schema": SCHEMA,
            "generatedAt": self.generated_at,
            "generator": {
                "name": "precision_auditor_v4_forensic.py",
                "python": sys.version.split()[0],
                "platform": platform.platform(),
            },
            "root": {
                "name": self.root.name,
                "path": str(self.root),
                "id": self.root_id,
            },
            "summary": self.summary(),
            "directories": dict(sorted(self.directories.items())),
            "files": dict(sorted(self.files.items())),
            "symlinks": dict(sorted(self.symlinks.items())),
            "skipped": self.skipped,
            "errors": self.errors,
            "validation": {},
        }

    @staticmethod
    def validate_state_obj(obj: Dict[str, Any]) -> Dict[str, Any]:
        failures: List[Dict[str, Any]] = []
        files = obj.get("files", {}) or {}
        for path, entry in files.items():
            try:
                if entry.get("contentEncoding") == "text":
                    enc = entry.get("encoding") or "utf-8"
                    raw = str(entry.get("content", "")).encode(enc)
                elif entry.get("contentEncoding") == "base64":
                    raw = base64.b64decode(entry.get("content_base64", ""), validate=True)
                else:
                    failures.append({"path": path, "reason": "unknown_content_encoding"})
                    continue
                if len(raw) != entry.get("size"):
                    failures.append({"path": path, "reason": "size_mismatch", "expected": entry.get("size"), "actual": len(raw)})
                digest = sha256_bytes(raw)
                if digest != entry.get("sha256"):
                    failures.append({"path": path, "reason": "sha256_mismatch", "expected": entry.get("sha256"), "actual": digest})
            except Exception as e:
                failures.append({"path": path, "reason": "validation_exception", "message": str(e)})
        return {
            "validatedAt": utc_now_iso(),
            "fileEntriesChecked": len(files),
            "failureCount": len(failures),
            "ok": len(failures) == 0,
            "failures": failures,
        }

    def ai_index(self) -> Dict[str, Any]:
        files = dict(sorted(self.files.items()))
        return {
            "schema": "forensic-platform-ai-index/v1",
            "generatedAt": self.generated_at,
            "instruction": (
                "All source files are embedded in the companion state JSON under files[path].content "
                "for UTF-8 text or files[path].content_base64 for binary/non-lossless text. Always check "
                "files[path] exactly before claiming a file is missing."
            ),
            "summary": self.summary(),
            "filePaths": list(files.keys()),
            "directoryPaths": sorted(self.directories.keys()),
            "symlinkPaths": sorted(self.symlinks.keys()),
            "filesByDirectory": self._files_by_directory(files.keys()),
            "lookupExamples": {
                "exactPathCheck": "state.files['shared/components/pf-app-header.js']",
                "componentDirectory": "state.files keys starting with 'shared/components/'",
            },
            "skipped": self.skipped,
            "errors": self.errors,
        }

    @staticmethod
    def _files_by_directory(paths: Iterable[str]) -> Dict[str, List[str]]:
        out: Dict[str, List[str]] = {}
        for p in paths:
            d = str(Path(p).parent).replace("\\", "/")
            if d == ".":
                d = "."
            out.setdefault(d, []).append(p)
        return {k: sorted(v) for k, v in sorted(out.items())}

    def write_volumes(self, state_obj: Dict[str, Any]) -> Dict[str, Any]:
        volumes_dir = self.out_dir / f"{self.root_id}_volumes"
        volumes_dir.mkdir(exist_ok=True)
        files_items = list(sorted((state_obj.get("files") or {}).items()))
        volumes: List[Dict[str, Any]] = []
        current: Dict[str, Any] = {}
        current_first: Optional[str] = None
        part = 1

        def volume_obj(files_subset: Dict[str, Any], first: Optional[str], last: Optional[str]) -> Dict[str, Any]:
            return {
                "schema": "forensic-platform-state-volume/v1",
                "generatedAt": self.generated_at,
                "root": state_obj["root"],
                "part": part,
                "firstPath": first,
                "lastPath": last,
                "fileCount": len(files_subset),
                "files": files_subset,
            }

        for path, entry in files_items:
            tentative = dict(current)
            tentative[path] = entry
            candidate = volume_obj(tentative, current_first or path, path)
            size = len(json.dumps(candidate, ensure_ascii=False).encode("utf-8"))
            if current and size > self.opt.chunk_size:
                last_path = next(reversed(current))
                obj = volume_obj(current, current_first, last_path)
                name = f"{self.root_id}_vol_{part:03d}.json"
                atomic_write_json(volumes_dir / name, obj)
                volumes.append({"part": part, "fileName": name, "fileCount": len(current), "firstPath": current_first, "lastPath": last_path})
                part += 1
                current = {path: entry}
                current_first = path
            else:
                current = tentative
                if current_first is None:
                    current_first = path
        if current:
            last_path = next(reversed(current))
            obj = volume_obj(current, current_first, last_path)
            name = f"{self.root_id}_vol_{part:03d}.json"
            atomic_write_json(volumes_dir / name, obj)
            volumes.append({"part": part, "fileName": name, "fileCount": len(current), "firstPath": current_first, "lastPath": last_path})

        index = {
            "schema": "forensic-platform-volume-index/v1",
            "generatedAt": self.generated_at,
            "volumeDirectory": volumes_dir.name,
            "targetChunkBytes": self.opt.chunk_size,
            "volumeCount": len(volumes),
            "volumes": volumes,
            "note": "Volumes are partitioned by complete file objects. No file content is truncated.",
        }
        atomic_write_json(volumes_dir / f"{self.root_id}_volume_index.json", index)
        return index

    def write_report(self, state_obj: Dict[str, Any], validation: Dict[str, Any], outputs: Dict[str, str]) -> None:
        s = state_obj["summary"]
        rows = []
        for p, f in sorted(self.files.items()):
            rows.append(
                f"<tr><td><code>{html.escape(p)}</code></td><td>{int(f.get('size', 0)):,}</td>"
                f"<td>{'Binary/base64' if f.get('binary') else 'Text'}</td>"
                f"<td><code>{html.escape(str(f.get('sha256', ''))[:16])}...</code></td></tr>"
            )
        skipped_rows = "".join(
            f"<tr><td><code>{html.escape(x.get('path',''))}</code></td><td>{html.escape(x.get('reason',''))}</td><td>{html.escape(str(x.get('pattern','')))}</td></tr>"
            for x in self.skipped
        ) or "<tr><td colspan='3'>None</td></tr>"
        error_rows = "".join(
            f"<tr><td><code>{html.escape(x.get('path',''))}</code></td><td>{html.escape(x.get('stage',''))}</td><td>{html.escape(x.get('message',''))}</td></tr>"
            for x in self.errors
        ) or "<tr><td colspan='3'>None</td></tr>"
        html_doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(self.root.name)} | Forensic Audit Report</title>
<style>
:root{{--p:#05583B;--a:#17B255;--bg:#F8FAF9;--card:#fff;--line:#DDE7E1;--txt:#13231C;}}
body{{margin:0;font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--txt);}}
header{{padding:28px 36px;background:linear-gradient(135deg,var(--p),#0B2A1F);color:#fff;}}
main{{padding:28px 36px;display:grid;gap:24px;}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 10px 28px rgba(10,30,20,.05);}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;}}
.stat{{background:#F1F7F4;border-radius:12px;padding:16px;}}
.stat b{{display:block;font-size:28px;color:var(--p);}}
table{{width:100%;border-collapse:collapse;font-size:13px;}}
th,td{{padding:10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;}}
code{{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;}}
.ok{{color:#047857;font-weight:800}}.bad{{color:#B91C1C;font-weight:800}}
</style>
</head>
<body>
<header><h1>Forensic Platform State Audit</h1><p>{html.escape(str(self.root))}</p></header>
<main>
<section class="card grid">
<div class="stat"><span>Files</span><b>{s['totalFiles']}</b></div>
<div class="stat"><span>Directories</span><b>{s['totalDirectories']}</b></div>
<div class="stat"><span>Symlinks</span><b>{s['totalSymlinks']}</b></div>
<div class="stat"><span>Total Bytes</span><b>{s['totalBytes']:,}</b></div>
<div class="stat"><span>Skipped</span><b>{s['skippedCount']}</b></div>
<div class="stat"><span>Errors</span><b>{s['errorCount']}</b></div>
</section>
<section class="card"><h2>Validation</h2><p class="{'ok' if validation.get('ok') else 'bad'}">Embedded content validation: {'PASS' if validation.get('ok') else 'FAIL'} ({validation.get('failureCount')} failures)</p></section>
<section class="card"><h2>Outputs</h2><pre>{html.escape(json.dumps(outputs, indent=2))}</pre></section>
<section class="card"><h2>File Manifest</h2><table><thead><tr><th>Path</th><th>Bytes</th><th>Encoding</th><th>SHA-256</th></tr></thead><tbody>{''.join(rows)}</tbody></table></section>
<section class="card"><h2>Skipped Ledger</h2><table><thead><tr><th>Path</th><th>Reason</th><th>Pattern</th></tr></thead><tbody>{skipped_rows}</tbody></table></section>
<section class="card"><h2>Error Ledger</h2><table><thead><tr><th>Path</th><th>Stage</th><th>Message</th></tr></thead><tbody>{error_rows}</tbody></table></section>
</main>
</body>
</html>"""
        atomic_write_text(self.out_dir / f"{self.root_id}_forensic_report.html", html_doc)

    def export(self) -> Dict[str, str]:
        self.scan()
        state_obj = self.state()
        validation = self.validate_state_obj(state_obj)
        state_obj["validation"] = validation
        outputs: Dict[str, str] = {}

        state_name = f"{self.root_id}_state.forensic.json"
        summary_name = f"{self.root_id}_summary.forensic.json"
        ai_index_name = f"{self.root_id}_ai_index.json"
        atomic_write_json(self.out_dir / state_name, state_obj)
        atomic_write_json(self.out_dir / summary_name, {"summary": state_obj["summary"], "validation": validation, "skipped": self.skipped, "errors": self.errors})
        atomic_write_json(self.out_dir / ai_index_name, self.ai_index())
        outputs["state"] = str(self.out_dir / state_name)
        outputs["summary"] = str(self.out_dir / summary_name)
        outputs["aiIndex"] = str(self.out_dir / ai_index_name)

        if self.opt.make_volumes:
            vol_index = self.write_volumes(state_obj)
            outputs["volumes"] = str(self.out_dir / vol_index["volumeDirectory"])
            outputs["volumeIndex"] = str(self.out_dir / vol_index["volumeDirectory"] / f"{self.root_id}_volume_index.json")

        if self.opt.include_report:
            report_name = f"{self.root_id}_forensic_report.html"
            self.write_report(state_obj, validation, outputs)
            outputs["report"] = str(self.out_dir / report_name)

        # Write a final run receipt last.
        receipt = {
            "schema": "forensic-platform-run-receipt/v1",
            "generatedAt": utc_now_iso(),
            "root": str(self.root),
            "outputDirectory": str(self.out_dir),
            "outputs": outputs,
            "summary": state_obj["summary"],
            "validation": validation,
            "success": validation.get("ok") is True and len(self.errors) == 0,
            "note": "success=false when read errors exist, even if embedded payload validation passed for captured files.",
        }
        receipt_name = f"{self.root_id}_run_receipt.json"
        atomic_write_json(self.out_dir / receipt_name, receipt)
        outputs["receipt"] = str(self.out_dir / receipt_name)
        self.log(f"[done] output={self.out_dir}")
        self.log(f"[done] validation={'PASS' if validation.get('ok') else 'FAIL'} errors={len(self.errors)} skipped={len(self.skipped)}")
        return outputs


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Create a full-fidelity forensic platform state export.")
    p.add_argument("--root", default=os.getcwd(), help="Root folder to scan. Default: current working directory.")
    p.add_argument("--out", default=None, help="Output directory. Default: <root>/aud_forensic_<rootid>_<timestamp>.")
    p.add_argument("--chunk-size", type=int, default=DEFAULT_CHUNK_SIZE, help="Target JSON byte size per volume. Does not truncate file contents.")
    p.add_argument("--ignore-glob", action="append", default=[], help="Explicit glob to skip. Repeatable. Skips are recorded.")
    p.add_argument("--exclude-vcs", action="store_true", help="Skip .git/.hg/.svn paths and record them in skipped ledger.")
    p.add_argument("--exclude-node-modules", action="store_true", help="Skip node_modules and record it in skipped ledger.")
    p.add_argument("--exclude-caches", action="store_true", help="Skip common cache folders and record them in skipped ledger.")
    p.add_argument("--exclude-hidden", action="store_true", help="Skip dotfiles/dotfolders and record them. Default is to include hidden paths.")
    p.add_argument("--follow-symlinks", action="store_true", help="Follow symlinked directories/files. Default records symlinks without following.")
    p.add_argument("--dual-encode-text", action="store_true", help="Also store base64 for UTF-8 text files for maximum byte-for-byte reconstruction assurance.")
    p.add_argument("--no-volumes", action="store_true", help="Do not create chunked volume files.")
    p.add_argument("--no-report", action="store_true", help="Do not create HTML human report.")
    return p


def main(argv: Optional[List[str]] = None) -> int:
    args = build_arg_parser().parse_args(argv)
    root = Path(args.root).resolve()
    root_id = clean_id(root.name)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = Path(args.out).resolve() if args.out else (root / f"aud_forensic_{root_id}_{timestamp}").resolve()
    ignore_globs = list(args.ignore_glob or [])
    if args.exclude_vcs:
        ignore_globs.extend(VCS_GLOBS)
    if args.exclude_node_modules:
        ignore_globs.extend(NODE_GLOBS)
    if args.exclude_caches:
        ignore_globs.extend(CACHE_GLOBS)

    options = ExportOptions(
        root=root,
        out_dir=out_dir,
        chunk_size=max(64 * 1024, int(args.chunk_size)),
        ignore_globs=ignore_globs,
        follow_symlinks=bool(args.follow_symlinks),
        dual_encode_text=bool(args.dual_encode_text),
        make_volumes=not bool(args.no_volumes),
        exclude_hidden=bool(args.exclude_hidden),
        include_report=not bool(args.no_report),
    )
    auditor = ForensicAuditor(options)
    try:
        auditor.export()
        return 0 if not auditor.errors else 2
    except Exception as e:
        print(f"[fatal] {type(e).__name__}: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

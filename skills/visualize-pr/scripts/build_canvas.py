#!/usr/bin/env python3
"""Assemble a canvas using resources relative to this script, in a unique folder."""

import argparse
import json
import re
import tempfile
from pathlib import Path


def patch_map(payload):
    if not isinstance(payload, list):
        raise ValueError("files JSON must be a list of files or paginated file lists")
    files = []
    for item in payload:
        files.extend(item if isinstance(item, list) else [item])
    patches = {}
    for item in files:
        if not isinstance(item, dict) or not isinstance(item.get("filename"), str):
            raise ValueError("each file must have a string filename")
        filename, patch = item["filename"], item.get("patch")
        if filename in patches:
            raise ValueError("duplicate filename in files JSON: " + filename)
        if patch is not None and not isinstance(patch, str):
            raise ValueError("patch must be a string or null: " + filename)
        patches[filename] = patch if patch is not None else ""
    return patches


def assemble(files_path, body_path):
    skill_dir = Path(__file__).resolve().parent.parent
    patches = patch_map(json.loads(files_path.read_text(encoding="utf-8")))
    safe_json = (json.dumps(patches, ensure_ascii=False)
                 .replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026"))
    replacements = {
        "/* INJECT_CSS */": (skill_dir / "styles.css").read_text(encoding="utf-8"),
        "/* INJECT_JS */": (skill_dir / "renderer.js").read_text(encoding="utf-8"),
        "<!-- INJECT_BODY -->": body_path.read_text(encoding="utf-8"),
        '{"__PR_DIFFS_PLACEHOLDER__":true}': safe_json,
    }
    template = (skill_dir / "template.html").read_text(encoding="utf-8")
    for token in replacements:
        if template.count(token) != 1:
            raise ValueError("expected exactly one template token: " + token)
    pattern = "|".join(re.escape(token) for token in replacements)
    return re.sub(pattern, lambda match: replacements[match.group(0)], template)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--files", type=Path, required=True, help="gh API files JSON (flat or --slurp pages)")
    parser.add_argument("--body", type=Path, required=True, help="authored body HTML with escaped source text")
    parser.add_argument("--output-root", type=Path, default=Path(tempfile.gettempdir()))
    args = parser.parse_args()
    try:
        html = assemble(args.files, args.body)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    args.output_root.mkdir(parents=True, exist_ok=True)
    artifact_dir = Path(tempfile.mkdtemp(prefix="pr-review-", dir=args.output_root))
    output = artifact_dir / "index.html"
    output.write_text(html, encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()

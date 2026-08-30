#!/usr/bin/env python3
"""Validate the crop configuration files against crop-config.schema.json.

Also enforces the honesty rule: a config whose `validated` flag is true must not contain any frame
still marked draft_unvalidated or ambiguous.

Usage:  npm run assets:schema
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pipeline import PATHS

try:
    import jsonschema
except ImportError:
    print("jsonschema is not installed. Run: python3 -m pip install -r tools/requirements.txt")
    raise SystemExit(1)


def main() -> int:
    schema_path = PATHS.config_dir / "crop-config.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator.check_schema(schema)
    validator = jsonschema.Draft202012Validator(schema)

    failures = 0
    for name in ("crop-config.draft.json", "crop-config.json"):
        path = PATHS.config_dir / name
        if not path.exists():
            print(f"  [skip ] {name} (not present)")
            continue
        document = json.loads(path.read_text(encoding="utf-8"))
        errors = sorted(validator.iter_errors(document), key=lambda e: list(e.path))
        if errors:
            failures += 1
            print(f"  [FAIL ] {name}")
            for error in errors[:15]:
                print(f"          at {list(error.path)}: {error.message[:160]}")
            continue

        unvalidated = [
            f"{board}.{output}[{index}]"
            for board, cfg in document.get("boards", {}).items()
            for output, spec in (cfg.get("outputs") or {}).items()
            for index, frame in enumerate(spec.get("frames", []))
            if frame.get("confidence", "draft_unvalidated") != "visually_validated"
        ]
        if document.get("validated") and unvalidated:
            failures += 1
            print(f"  [FAIL ] {name}: marked validated but {len(unvalidated)} frames are still "
                  f"draft_unvalidated or ambiguous, e.g. {unvalidated[:3]}")
        else:
            state = "validated" if document.get("validated") else "DRAFT (unvalidated)"
            print(f"  [ ok  ] {name}: schema valid, {state}, "
                  f"{len(unvalidated)} frames awaiting visual confirmation")

    print(f"\ncrop config schema check: {failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())

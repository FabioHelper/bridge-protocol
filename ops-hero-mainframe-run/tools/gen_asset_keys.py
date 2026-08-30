#!/usr/bin/env python3
"""Generate src/config/AssetKeys.ts from assets/config/asset-contract.json.

Generating rather than hand-writing guarantees the integrity constraint "no duplicated asset keys"
and makes it impossible for the code's idea of a texture's frame size to drift from the contract
the pipeline enforces.

Usage:  npm run gen:keys
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pipeline import PATHS, load_contract


def key_of(filename: str) -> str:
    return filename[:-4] if filename.endswith(".png") else filename


def const_of(filename: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "_", key_of(filename).upper())


def main() -> int:
    contract = load_contract()
    outputs = sorted(contract["outputs"], key=lambda o: str(o["file"]))

    keys: list[str] = []
    manifest: list[str] = []
    seen: set[str] = set()
    for spec in outputs:
        filename = str(spec["file"])
        const, key = const_of(filename), key_of(filename)
        if const in seen:
            raise SystemExit(f"duplicate asset key generated: {const}")
        seen.add(const)
        keys.append(f"  {const}: '{key}',")
        if spec.get("kind") == "spritesheet":
            manifest.append(
                f"  {{ key: AssetKeys.{const}, path: '{filename}', "
                f"frameWidth: {spec['frame_width']}, frameHeight: {spec['frame_height']}, "
                f"frameCount: {spec['frame_count']} }},"
            )
        else:
            w = spec.get("width", spec.get("max_width", 0))
            h = spec.get("height", spec.get("max_height", 0))
            manifest.append(
                f"  {{ key: AssetKeys.{const}, path: '{filename}', "
                f"fallbackWidth: {w}, fallbackHeight: {h} }},"
            )

    body = f"""// GENERATED FILE -- do not edit by hand.
// Source: assets/config/asset-contract.json (v{contract['version']})
// Regenerate with: npm run gen:keys
//
// Generating this file is what enforces two integrity constraints at once:
//   1. no duplicated asset keys (the generator hard-fails on a collision);
//   2. the code's frame dimensions can never drift from the contract the pipeline validates.

/** Every texture key in the game. Exactly one definition per asset. */
export const AssetKeys = {{
{chr(10).join(keys)}
}} as const;

export type AssetKey = (typeof AssetKeys)[keyof typeof AssetKeys];

/** A spritesheet: loaded with frame dimensions, and used to size a runtime placeholder. */
export interface SpritesheetEntry {{
  readonly key: AssetKey;
  readonly path: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCount: number;
}}

/** A single image. Fallback dimensions size the runtime placeholder if the file fails to load. */
export interface ImageEntry {{
  readonly key: AssetKey;
  readonly path: string;
  readonly fallbackWidth: number;
  readonly fallbackHeight: number;
}}

export type ManifestEntry = SpritesheetEntry | ImageEntry;

export function isSpritesheet(entry: ManifestEntry): entry is SpritesheetEntry {{
  return 'frameWidth' in entry;
}}

/** Directory under public/ that PreloadScene prefixes to every path. */
export const ASSET_BASE_PATH = 'assets/';

/** Load descriptors for every contracted asset, so PreloadScene contains no literals. */
export const ASSET_MANIFEST: readonly ManifestEntry[] = [
{chr(10).join(manifest)}
];
"""
    target = PATHS.root / "src" / "config" / "AssetKeys.ts"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body, encoding="utf-8")
    print(f"generated {target.relative_to(PATHS.root)}: {len(keys)} keys, {len(manifest)} manifest entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

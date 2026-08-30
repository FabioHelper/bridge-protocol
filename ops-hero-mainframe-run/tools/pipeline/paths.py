"""Project paths and config loading. Single place that knows the repo layout."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[2]


def _dir_from_env(var: str, default: Path) -> Path:
    """Allow the pipeline self-test to redirect I/O without touching the real project tree."""
    override = os.environ.get(var)
    return Path(override).resolve() if override else default


@dataclass(frozen=True)
class ProjectPaths:
    root: Path
    sources_dir: Path
    config_dir: Path
    public_assets: Path
    diagnostics: Path
    reports: Path

    def ensure_output_dirs(self) -> None:
        for directory in (self.public_assets, self.diagnostics, self.reports):
            directory.mkdir(parents=True, exist_ok=True)


PATHS = ProjectPaths(
    root=_ROOT,
    sources_dir=_dir_from_env("OPSHERO_SOURCES_DIR", _ROOT / "assets" / "source"),
    config_dir=_dir_from_env("OPSHERO_CONFIG_DIR", _ROOT / "assets" / "config"),
    public_assets=_dir_from_env("OPSHERO_PUBLIC_DIR", _ROOT / "public" / "assets"),
    diagnostics=_dir_from_env("OPSHERO_DIAGNOSTICS_DIR", _ROOT / "build" / "asset-diagnostics"),
    reports=_dir_from_env("OPSHERO_REPORTS_DIR", _ROOT / "build" / "reports"),
)


def _read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data: dict[str, Any] = json.load(handle)
    return data


def load_contract() -> dict[str, Any]:
    """The single source of truth for every production asset's dimensions."""
    return _read_json(PATHS.config_dir / "asset-contract.json")


def load_crops() -> dict[str, Any]:
    """Editable crop overrides. Overrides always win over auto-detection."""
    return _read_json(PATHS.config_dir / "crops.json")


def load_sources() -> dict[str, Any]:
    """Logical source name -> filename mapping."""
    return _read_json(PATHS.config_dir / "sources.json")


def write_json(path: Path, payload: object) -> None:
    """Write JSON deterministically: stable key order, trailing newline, LF endings."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")

"""Deterministic asset-processing pipeline for OPS HERO: Mainframe Run.

Contract: given identical assets-source/ and config/*.json, this package produces
byte-identical output. No randomness, no timestamps in image data, no network access.

See docs/SPEC-01-ASSET-PIPELINE.md for the authoritative specification.
"""

from .paths import PATHS, load_contract, load_crops, load_sources

__all__ = ["PATHS", "load_contract", "load_crops", "load_sources"]

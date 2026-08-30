"""Machine-readable pipeline reporting. Ambiguity is recorded, never hidden."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Literal

Level = Literal["OK", "WARN", "ERROR", "SKIPPED"]


@dataclass
class Result:
    level: Level
    check: str
    target: str
    message: str = ""
    expected: str = ""
    actual: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class Report:
    """Collects results and renders both a JSON payload and a console summary."""

    def __init__(self, generated_by: str) -> None:
        self.generated_by = generated_by
        self.results: list[Result] = []
        self.extra: dict[str, Any] = {}

    def add(
        self,
        level: Level,
        check: str,
        target: str,
        message: str = "",
        expected: str = "",
        actual: str = "",
    ) -> None:
        self.results.append(Result(level, check, target, message, expected, actual))

    def ok(self, check: str, target: str, expected: str = "", actual: str = "") -> None:
        self.add("OK", check, target, "", expected, actual)

    def warn(self, check: str, target: str, message: str, expected: str = "", actual: str = "") -> None:
        self.add("WARN", check, target, message, expected, actual)

    def error(self, check: str, target: str, message: str, expected: str = "", actual: str = "") -> None:
        self.add("ERROR", check, target, message, expected, actual)

    def skipped(self, check: str, target: str, message: str) -> None:
        self.add("SKIPPED", check, target, message)

    def count(self, level: Level) -> int:
        return sum(1 for r in self.results if r.level == level)

    @property
    def failed(self) -> bool:
        return self.count("ERROR") > 0

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "generated_by": self.generated_by,
            "ok": not self.failed,
            "counts": {
                "checks": len(self.results),
                "errors": self.count("ERROR"),
                "warnings": self.count("WARN"),
                "skipped": self.count("SKIPPED"),
            },
            "results": [r.to_dict() for r in self.results],
        }
        payload.update(self.extra)
        return payload

    def print_summary(self) -> None:
        for result in self.results:
            if result.level == "OK":
                continue
            detail = result.message
            if result.expected or result.actual:
                detail = f"{detail} (expected {result.expected}, actual {result.actual})".strip()
            print(f"  [{result.level:7}] {result.check:20} {result.target:32} {detail}")
        print(
            f"\n{self.generated_by}: {len(self.results)} checks, "
            f"{self.count('ERROR')} errors, {self.count('WARN')} warnings, "
            f"{self.count('SKIPPED')} skipped"
        )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()

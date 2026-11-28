"""Replay the three generated label replacements through the public Mermaid exporter."""
from pathlib import Path
import sys

from bun_replay import discover, replay

PACKAGE = Path(__file__).resolve().parents[2] / "packages/foldkit-zloz-mermaid"
FILE = Path("src/export-mermaid.ts")
TEST = Path("test/export.test.ts")
WAYPOINTS = Path("foldkit-zloz/test/fixtures/waypoints-v1.json")


def candidates(_source):
    mutants = [m for m in discover(PACKAGE, FILE) if m["functionName"] == "label"]
    if sorted(m["id"] for m in mutants) != [
        "47160e5de88c3b4655f9e2fa", "badade248a296f2e022bd56d", "e33c23736af9884f85fef8a6",
    ]:
        raise ValueError("Review the generated Mermaid label candidates")
    return mutants


if __name__ == "__main__":
    replay(PACKAGE, FILE, TEST, candidates, Path(sys.argv[1]).resolve(), fixtures=[WAYPOINTS])

"""Replay the pinned force eligibility mutations against the package's Bun layout suite."""
import hashlib
from pathlib import Path
import sys

from bun_replay import discover, replay

TOOLS = Path(__file__).resolve().parent
PACKAGE = TOOLS.parents[1] / "packages/foldkit-zloz-force"
FILE = Path("src/eligibility.ts")
TEST = Path("test/layout.test.ts")


def candidates(source):
    mutants = discover(PACKAGE, FILE)
    if sorted(m["id"] for m in mutants) != ["25f6e7a1f32b5d48e973cc3e", "a9dc6120552401178a9a94b3"]:
        raise ValueError("Review the generated boolean candidates")
    edit = mutants[0]["replacement"]
    # TypeScript reports UTF-16 offsets. Work in the same units when applying edits.
    body = source[2 * edit["startOffset"]:2 * edit["endOffset"]].decode("utf-16-le")
    comparison = "graph.nodes.length <= 100"
    if body.count(comparison) != 1:
        raise ValueError("Review the 100-node cutoff before replaying")
    custom = {
        **mutants[0],
        "id": hashlib.sha256(b"packages/foldkit-zloz-force:supportsForceLayout:exclusive-100:v1").hexdigest()[:24],
        "genre": "CustomExclusiveLimit",
        "description": "Custom replay: reject a flat graph with exactly 100 nodes.",
        "replacement": {**edit, "text": body.replace(comparison, "graph.nodes.length < 100")},
    }
    return [*mutants, custom]


if __name__ == "__main__":
    replay(PACKAGE, FILE, TEST, candidates, Path(sys.argv[1]).resolve())

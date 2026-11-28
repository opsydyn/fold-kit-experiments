"""Replay the pinned force eligibility mutations against the package's Bun layout suite."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
from xml.etree import ElementTree

TOOLS = Path(__file__).resolve().parent
PACKAGE = TOOLS.parents[1] / "packages/foldkit-zloz-force"
FILE = Path("src/eligibility.ts")
TEST = Path("test/layout.test.ts")


def candidates(source):
    output = subprocess.check_output(
        [TOOLS / "node_modules/.bin/mutant-cafe", "--list", "--format", "json", "--file", FILE],
        cwd=PACKAGE,
    )
    mutants = json.loads(output)["mutants"]
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


def run_tests(scratch, report):
    result = subprocess.run(
        ["bun", "test", "./" + str(TEST), "--reporter=junit", "--reporter-outfile=" + str(report)],
        cwd=scratch, timeout=120,
    )
    suites = ElementTree.parse(report).getroot()
    cases = suites.findall("./testsuite/testcase")
    names = sorted(case.attrib["name"] for case in cases)
    failed = sorted(case.attrib["name"] for case in cases if case.find("failure") is not None)
    if (not cases or any(case.get("file") != str(TEST) for case in cases)
            or suites.findall(".//skipped") or suites.findall(".//error")
            or int(suites.attrib["failures"]) != len(failed)
            or result.returncode != int(bool(failed))):
        raise ValueError(f"Incomplete Bun test run: {report}")
    return names, failed


def replay(output):
    output.mkdir(parents=True, exist_ok=True)
    source = (PACKAGE / FILE).read_text().encode("utf-16-le")
    mutants = candidates(source)
    results = []
    with TemporaryDirectory(prefix="force-eligibility-") as directory:
        scratch = Path(directory)
        shutil.copytree(PACKAGE / "src", scratch / "src")
        (scratch / TEST.parent).mkdir()
        shutil.copyfile(PACKAGE / TEST, scratch / TEST)
        (scratch / "node_modules").symlink_to(PACKAGE / "node_modules", target_is_directory=True)
        baseline, failed = run_tests(scratch, output / "control.xml")
        if failed:
            raise ValueError("Unmodified layout suite failed")
        for mutant in mutants:
            edit = mutant["replacement"]
            changed = (source[:2 * edit["startOffset"]] + edit["text"].encode("utf-16-le")
                       + source[2 * edit["endOffset"]:])
            (scratch / FILE).write_text(changed.decode("utf-16-le"))
            names, failed = run_tests(scratch, output / (mutant["id"] + ".xml"))
            if names != baseline:
                raise ValueError("Layout test selection changed")
            outcome = "caught" if failed else "missed"
            results.append(dict(mutant=mutant, outcome=outcome, failingTests=failed))
            print(mutant["description"], outcome)
    (output / "outcomes.json").write_text(json.dumps(dict(
        schemaVersion=2, root=str(PACKAGE), selected=len(results), budgetSkipped=0, results=results
    ), indent=2) + "\n")


if __name__ == "__main__":
    replay(Path(sys.argv[1]).resolve())

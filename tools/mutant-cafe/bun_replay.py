"""Run a pinned mutation set in an isolated package, retaining each Bun JUnit report."""
import json
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory
from xml.etree import ElementTree


def discover(package, file):
    tool = Path(__file__).resolve().parent / "node_modules/.bin/mutant-cafe"
    output = subprocess.check_output(
        [tool, "--list", "--format", "json", "--file", file], cwd=package,
    )
    return json.loads(output)["mutants"]


def run_tests(scratch, test, report):
    result = subprocess.run(
        ["bun", "test", "./" + str(test), "--reporter=junit", "--reporter-outfile=" + str(report)],
        cwd=scratch, timeout=120,
    )
    suites = ElementTree.parse(report).getroot()
    cases = suites.findall("./testsuite/testcase")
    names = sorted(case.attrib["name"] for case in cases)
    failed = sorted(case.attrib["name"] for case in cases if case.find("failure") is not None)
    if (not cases or any(case.get("file") != str(test) for case in cases)
            or suites.findall(".//skipped") or suites.findall(".//error")
            or int(suites.attrib["failures"]) != len(failed)
            or result.returncode != int(bool(failed))):
        raise ValueError(f"Incomplete Bun test run: {report}")
    return names, failed


def replay(package, file, test, candidates, output, fixtures=()):
    output.mkdir(parents=True, exist_ok=True)
    source = (package / file).read_text().encode("utf-16-le")
    mutants = candidates(source)
    results = []
    with TemporaryDirectory(prefix="bun-mutation-") as directory:
        scratch = Path(directory) / package.name
        for fixture in fixtures:
            destination = scratch.parent / fixture
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(package.parent / fixture, destination)
        shutil.copytree(package / "src", scratch / "src")
        (scratch / test.parent).mkdir()
        shutil.copyfile(package / test, scratch / test)
        (scratch / "node_modules").symlink_to(package / "node_modules", target_is_directory=True)
        baseline, failed = run_tests(scratch, test, output / "control.xml")
        if failed:
            raise ValueError("Unmodified test suite failed")
        for mutant in mutants:
            edit = mutant["replacement"]
            changed = (source[:2 * edit["startOffset"]] + edit["text"].encode("utf-16-le")
                       + source[2 * edit["endOffset"]:])
            (scratch / file).write_text(changed.decode("utf-16-le"))
            names, failed = run_tests(scratch, test, output / (mutant["id"] + ".xml"))
            if names != baseline:
                raise ValueError("Test selection changed")
            outcome = "caught" if failed else "missed"
            results.append(dict(mutant=mutant, outcome=outcome, failingTests=failed))
            print(mutant["description"], outcome)
    (output / "outcomes.json").write_text(json.dumps(dict(
        schemaVersion=2, root=str(package), selected=len(results), budgetSkipped=0, results=results
    ), indent=2) + "\n")

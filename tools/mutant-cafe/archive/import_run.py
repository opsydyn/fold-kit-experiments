"""Append a compact advisory observation. Raw runner logs stay in the CI artifact."""
import argparse
from datetime import datetime
import hashlib
import json
import re
from pathlib import Path, PurePosixPath


def import_run(archive, raw, run_id, attempt, commit, started_at, workspace="apps/web"):
    report = json.loads(raw)
    if report.get("schemaVersion") != 2 or not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("Invalid advisory version or source commit")
    datetime.strptime(started_at, "%Y-%m-%dT%H:%M:%SZ")
    if workspace not in ("apps/web", "apps/zloz-demo", "packages/foldkit-viz", "packages/astro-foldkit"):
        raise ValueError("Unknown advisory workspace")
    if run_id < 1 or attempt < 1:
        raise ValueError("Invalid workflow run identity")
    results = report["results"]
    if len(results) > 20:
        raise ValueError("Report exceeds advisory budget")
    entries = []
    ids = set()
    for result in results:
        mutant = result["mutant"]
        path = PurePosixPath(mutant["file"]).relative_to(report["root"])
        mutant_id = mutant["id"]
        if (not re.fullmatch(r"[0-9a-f]{24}", mutant_id) or mutant_id in ids
                or not path.parts or path.parts[0] != "src" or ".." in path.parts
                or path.suffix != ".ts"):
            raise ValueError("Invalid mutation identity or source path")
        line = mutant["span"]["start"]["line"]
        if type(line) is not int or line < 1:
            raise ValueError("Invalid mutation line")
        ids.add(mutant_id)
        fields = (mutant["functionName"], mutant["genre"], result["outcome"], str(path))
        if not all(isinstance(field, str) and 0 < len(field) <= 512
                   and field.isprintable() for field in fields):
            raise ValueError("Invalid mutation metadata")
        entries.append(dict(id=mutant_id, file=str(path), fn=fields[0], genre=fields[1],
                            line=line, outcome=fields[2]))
    record = dict(workspace=workspace, selected=report.get("selected", len(results)),
                  budgetSkipped=report.get("budgetSkipped", 0),
                  failed=bool(report.get("failure")), run=run_id, attempt=attempt, commit=commit, startedAt=started_at,
                  reportSha256=hashlib.sha256(raw).hexdigest(), entries=entries)
    for previous in archive:
        if (previous.get("workspace", "apps/web"), previous["run"], previous["attempt"]) == (workspace, run_id, attempt):
            # Older web records predate workspace and selection metadata.
            comparable = dict(record)
            for key in ("workspace", "selected", "budgetSkipped", "failed"):
                if key not in previous:
                    comparable.pop(key)
            if previous != comparable:
                raise ValueError("Conflicting artifact for the same workflow attempt")
            return archive
    return sorted([*archive, record], key=lambda item: (item["run"], item["attempt"]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("report", type=Path)
    parser.add_argument("run", type=int)
    parser.add_argument("attempt", type=int)
    parser.add_argument("commit")
    parser.add_argument("started_at")
    parser.add_argument("--workspace", default="apps/web")
    args = parser.parse_args()
    archive = json.loads(args.archive.read_text()) if args.archive.exists() else []
    updated = import_run(archive, args.report.read_bytes(), args.run, args.attempt, args.commit, args.started_at, args.workspace)
    args.archive.write_text(json.dumps(updated, indent=2) + "\n")

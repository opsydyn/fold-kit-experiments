#!/usr/bin/env bash
# Run from the repository root with an absolute path for the report.
set -euo pipefail
report=${1:?supply an absolute output directory}
tool="$PWD/tools/mutant-cafe/node_modules/.bin/mutant-cafe"
package="$PWD/packages/foldkit-dash"
suite=$(mktemp -d)
trap 'rm -rf "$suite"' EXIT
mkdir "$suite/test"
cp -R "$package"/{src,package.json,tsconfig.json,vitest.config.ts} "$suite/"
cp "$package/test/csv.test.ts" "$suite/test/"
ln -s "$package/node_modules" "$suite/node_modules"
cd "$suite"
# This isolated package contains only the Vitest portion of the mixed workspace suite.
npm pkg set scripts.test="vitest run"

# Select the body containing the declaration, even if earlier lines move.
awk '/^export const typed = / {
  printf "--- a/src/csv.ts\n+++ b/src/csv.ts\n@@ -%d,0 +%d @@\n+%s\n", NR-1, NR, $0
  found=1
} END { if (!found) exit 1 }' src/csv.ts > typed.diff
"$tool" --advisory --format github --file src/csv.ts --in-diff typed.diff \
  --jobs 1 --max-mutants 7 --baseline-timeout 300 --output "$report"

# Detect selection drift and harness failure while retaining genuine survivors.
jq -e '
  (.failure | not) and .selected == 7 and .budgetSkipped == 0 and
  all(.results[]; .mutant.functionName == "typed" and (.outcome == "caught" or .outcome == "missed")) and
  ([.results[].mutant.id] | sort) == [
    "0b3fd077727c4abd44376700", "58be5b45479f11c961ad6401", "71394b5bd8f8930e2344aec3",
    "a51ef1599c896b66b6f898ab", "b4be9dffdff22c336a69bf3c", "cd03b1bdffed42ee2ea9ace2",
    "d8bf5dd29bbb8d3ad404ba52"
  ]' "$report/outcomes.json"

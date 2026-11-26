#!/usr/bin/env bash
set -euo pipefail

base=${1:?usage: web-mutation-advisory.sh BASE_REF EXISTING_REPORT_DIRECTORY}
report_dir=$(cd "${2:?supply a fresh directory for the report}" && pwd -P)
cd "$(git rev-parse --show-toplevel)"

# Mutant Cafe expects unified hunks. Mixed PRs can also contain binary patches
# and changes with only Git metadata (for example, an empty new file).
git -c core.quotePath=false diff --no-color --no-ext-diff --no-textconv --no-renames \
  --diff-filter=AM "$base...HEAD" -- ':(glob)apps/web/src/**/*.ts' \
  | awk '/^diff --git / { body = 0 } /^--- / { body = 1 } body' > "$report_dir/web.diff"

# On a test-only web diff, replay the source modules those tests sit beside.
# Keep the normal changed-body selection and budget for mixed source/test PRs.
if git diff --quiet "$base...HEAD" -- ':(glob)apps/web/src/**/*.ts' ':(exclude,glob)apps/web/src/**/*.test.ts'; then
  git diff --name-only -z --diff-filter=AM "$base...HEAD" -- ':(glob)apps/web/src/**/*.test.ts' > "$report_dir/changed-tests"
  while IFS= read -r -d '' test_file; do
    source_file=${test_file%.test.ts}.ts
    [[ -f "$source_file" && ! -L "$source_file" ]] || continue
    git ls-files --error-unmatch -- "$source_file" > /dev/null 2>&1 || continue
    # --no-index exits 1 when it successfully emits a difference.
    { git -c core.quotePath=false diff --no-index --no-ext-diff --no-textconv -- /dev/null "$source_file" || [[ $? == 1 ]]; } \
      | awk '/^--- / { body = 1 } body' >> "$report_dir/web.diff"
  done < "$report_dir/changed-tests"
fi

cd apps/web
../../tools/mutant-cafe/node_modules/.bin/mutant-cafe --advisory --format github \
  --file 'src/**/*.ts' --exclude '**/*.test.ts' --exclude 'src/test/**' \
  --exclude '**/*.stories.ts' --exclude '**/*.css.ts' --exclude '**/*.d.ts' \
  --in-diff "$report_dir/web.diff" --jobs 1 --max-mutants 20 --baseline-timeout 300 \
  --output "$report_dir/web-mutants"

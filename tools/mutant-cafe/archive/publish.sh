#!/usr/bin/env bash
# Run only in a disposable, authenticated checkout. Keep importer and report outside it.
set -euo pipefail
importer=$1
report=$2
branch=field-guide-data
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
# A normal fast-forward push arbitrates concurrent imports. Re-read the winner
# on collisions so two reports completing together both reach the archive.
for retry in 1 2 3 4 5; do
  if git ls-remote --exit-code origin "refs/heads/$branch" > /dev/null; then
    git fetch --depth=1 origin "refs/heads/$branch"
    git switch --detach FETCH_HEAD
  else
    status=$?
    [[ $status == 2 ]] || exit "$status"
    git switch --orphan "archive-bootstrap-$retry"
  fi
  python3 "$importer" archive.json "$report" "$SOURCE_RUN" "$SOURCE_ATTEMPT" "$SOURCE_SHA" "$SOURCE_STARTED_AT" --workspace "$SOURCE_WORKSPACE"
  git add -- archive.json
  git diff --cached --quiet && exit 0
  git commit -m "Archive advisory $SOURCE_RUN attempt $SOURCE_ATTEMPT"
  if git push origin "HEAD:refs/heads/$branch"; then exit 0; fi
  sleep "$retry"
done
exit 1

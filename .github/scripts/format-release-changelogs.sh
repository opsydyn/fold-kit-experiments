#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
repo='opsydyn/fold-kit-experiments'
branch='release-please--branches--main'
[[ "${GITHUB_REPOSITORY:-}" == "$repo" ]] || { printf 'Unexpected repository.\n' >&2; exit 1; }
: "${GH_TOKEN:?Missing GitHub token}"
: "${RELEASE_PLEASE_PRS:?Missing created/updated PR output}"
prs=$RELEASE_PLEASE_PRS
jq -e 'type == "array" and (length == 0 or (length == 1 and
  (.[0].number | type == "number" and . > 0 and floor == .) and
  .[0].headBranchName == "release-please--branches--main" and .[0].baseBranchName == "main" and
  (.[0].sha == null or (.[0].sha | type == "string" and test("^[a-f0-9]{40}$")))))' <<< "$prs" >/dev/null
[[ $(jq length <<< "$prs") != 0 ]] || { printf 'No generated release PR.\n'; exit 0; }
number=$(jq -r '.[0].number' <<< "$prs")
generated_sha=$(jq -r '.[0].sha // ""' <<< "$prs")
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT

read_pr() {
  gh api --hostname github.com --method GET "repos/$repo/pulls/$number" > "$temporary/pr.json"
  jq -e --arg repo "$repo" --arg branch "$branch" --argjson number "$number" '
    .number == $number and .state == "open" and .merged_at == null and
    .head.repo.full_name == $repo and .base.repo.full_name == $repo and
    .head.ref == $branch and .base.ref == "main" and
    (.head.sha | type == "string" and test("^[a-f0-9]{40}$")) and
    (.changed_files | type == "number" and . > 0 and . <= 5 and floor == .) and
    ([.labels[].name] | index("autorelease: pending") != null)' "$temporary/pr.json" >/dev/null
}

read_pr
sha=$(jq -r '.head.sha' "$temporary/pr.json")
[[ -z "$generated_sha" || "$generated_sha" == "$sha" ]] || { printf 'Generated PR head changed.\n' >&2; exit 1; }
gh api --hostname github.com --method GET "repos/$repo/pulls/$number/files?per_page=100" > "$temporary/files.json"
jq -e --argjson count "$(jq '.changed_files' "$temporary/pr.json")" '
  type == "array" and length == $count and all(.[];
    .status == "modified" and (.filename as $path |
      [".release-please-manifest.json", "packages/astro-foldkit/package.json",
       "packages/foldkit-viz/package.json", "packages/astro-foldkit/CHANGELOG.md",
       "packages/foldkit-viz/CHANGELOG.md"] | index($path) != null))' "$temporary/files.json" >/dev/null

# Only pinned Markdown blobs and directory-entry metadata are read; PR code is never executed.
snapshot_query='query ChangelogSnapshot($owner: String!, $name: String!, $astro: String!, $viz: String!, $astroFile: String!, $vizFile: String!) {
  repository(owner: $owner, name: $name) {
    nameWithOwner
    astro: object(expression: $astro) { __typename ... on Tree { entries { name mode type } } }
    viz: object(expression: $viz) { __typename ... on Tree { entries { name mode type } } }
    astroFile: object(expression: $astroFile) { __typename ... on Blob { text byteSize isBinary isTruncated } }
    vizFile: object(expression: $vizFile) { __typename ... on Blob { text byteSize isBinary isTruncated } }
  }
}'
jq -n --arg query "$snapshot_query" --arg astro "$sha:packages/astro-foldkit" --arg viz "$sha:packages/foldkit-viz" \
  --arg astroFile "$sha:packages/astro-foldkit/CHANGELOG.md" --arg vizFile "$sha:packages/foldkit-viz/CHANGELOG.md" \
  '{query: $query, variables: {owner: "opsydyn", name: "fold-kit-experiments", astro: $astro, viz: $viz, astroFile: $astroFile, vizFile: $vizFile}}' |
  gh api --hostname github.com --method POST graphql --input - > "$temporary/snapshot.json"
jq -e --arg repo "$repo" '((.errors // []) | length) == 0 and .data.repository.nameWithOwner == $repo' "$temporary/snapshot.json" >/dev/null

for package in astro-foldkit foldkit-viz; do
  key=astro
  [[ "$package" != foldkit-viz ]] || key=viz
  jq -e --arg key "$key" '.data.repository as $repo |
    ($repo[$key].__typename == "Tree") and
    ($repo[$key].entries | map(select(.name == "CHANGELOG.md")) |
      length == 1 and .[0].mode == 33188 and .[0].type == "blob") and
    ($repo[$key + "File"] | .__typename == "Blob" and .isBinary == false and .isTruncated == false and
      (.text | type == "string") and .byteSize <= 1048576 and .byteSize == (.text | utf8bytelength))' "$temporary/snapshot.json" >/dev/null
  mkdir "$temporary/$package"
  jq -j --arg key "${key}File" '.data.repository[$key].text' "$temporary/snapshot.json" > "$temporary/$package/CHANGELOG.md"
  cp "$temporary/$package/CHANGELOG.md" "$temporary/$package/before.md"
done

env -u GH_TOKEN -u GITHUB_TOKEN -u NPM_TOKEN -u NODE_AUTH_TOKEN \
  "$root/node_modules/.bin/oxfmt" --config "$root/.oxfmtrc.json" --disable-nested-config \
  "$temporary/astro-foldkit/CHANGELOG.md" "$temporary/foldkit-viz/CHANGELOG.md"
env -u GH_TOKEN -u GITHUB_TOKEN -u NPM_TOKEN -u NODE_AUTH_TOKEN \
  "$root/node_modules/.bin/oxfmt" --check --config "$root/.oxfmtrc.json" --disable-nested-config \
  "$temporary/astro-foldkit/CHANGELOG.md" "$temporary/foldkit-viz/CHANGELOG.md"

printf '[]' > "$temporary/additions.json"
for package in astro-foldkit foldkit-viz; do
  if cmp -s "$temporary/$package/before.md" "$temporary/$package/CHANGELOG.md"; then
    continue
  else
    status=$?
    [[ "$status" == 1 ]] || exit "$status"
  fi
  jq --arg path "packages/$package/CHANGELOG.md" --rawfile text "$temporary/$package/CHANGELOG.md" \
    '. + [{path: $path, contents: ($text | @base64)}]' "$temporary/additions.json" > "$temporary/additions.next"
  mv "$temporary/additions.next" "$temporary/additions.json"
done
[[ $(jq length "$temporary/additions.json") != 0 ]] || { printf 'Release changelogs already normalized.\n'; exit 0; }

read_pr
[[ $(jq -r '.head.sha' "$temporary/pr.json") == "$sha" ]] || { printf 'PR head changed before commit.\n' >&2; exit 1; }
# GitHub atomically checks expectedHeadOid and creates a single commit; no force-push or retry.
mutation='mutation FormatReleaseChangelogs($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) { commit { oid } }
}'
jq -n --arg query "$mutation" --arg repo "$repo" --arg branch "$branch" --arg sha "$sha" \
  --slurpfile additions "$temporary/additions.json" '{query: $query, variables: {input: {
    branch: {repositoryNameWithOwner: $repo, branchName: $branch}, expectedHeadOid: $sha,
    message: {headline: "chore: format generated release changelogs"}, fileChanges: {additions: $additions[0]}
  }}}' | gh api --hostname github.com --method POST graphql --input - > "$temporary/commit.json"
commit=$(jq -er 'select(((.errors // []) | length) == 0) | .data.createCommitOnBranch.commit.oid |
  select(type == "string" and test("^[a-f0-9]{40}$"))' "$temporary/commit.json")
printf 'Normalized release PR #%s at %s. Final-revision CI is still required.\n' "$number" "$commit"

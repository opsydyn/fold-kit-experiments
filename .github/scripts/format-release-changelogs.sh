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

# The packages release-please versions. A release PR may bring, for each, its package.json
# and its CHANGELOG.md (added on a package's first release), plus the manifest: nothing else.
packages=(astro-foldkit foldkit-viz effect-three effect-three-foldkit effect-three-rapier effect-three-troika)
packages_json=$(printf '%s\n' "${packages[@]}" | jq -R . | jq -s .)
most_files=$((1 + 2 * ${#packages[@]}))

read_pr() {
  gh api --hostname github.com --method GET "repos/$repo/pulls/$number" > "$temporary/pr.json"
  jq -e --arg repo "$repo" --arg branch "$branch" --argjson number "$number" --argjson most "$most_files" '
    .number == $number and .state == "open" and .merged_at == null and
    .head.repo.full_name == $repo and .base.repo.full_name == $repo and
    .head.ref == $branch and .base.ref == "main" and
    (.head.sha | type == "string" and test("^[a-f0-9]{40}$")) and
    (.changed_files | type == "number" and . > 0 and . <= $most and floor == .) and
    ([.labels[].name] | index("autorelease: pending") != null)' "$temporary/pr.json" >/dev/null
}

read_pr
sha=$(jq -r '.head.sha' "$temporary/pr.json")
[[ -z "$generated_sha" || "$generated_sha" == "$sha" ]] || { printf 'Generated PR head changed.\n' >&2; exit 1; }
gh api --hostname github.com --method GET "repos/$repo/pulls/$number/files?per_page=100" > "$temporary/files.json"
jq -e --argjson count "$(jq '.changed_files' "$temporary/pr.json")" --argjson packages "$packages_json" '
  ([$packages[] | "packages/\(.)/package.json"]) as $manifests |
  ([$packages[] | "packages/\(.)/CHANGELOG.md"]) as $changelogs |
  type == "array" and length == $count and all(.[]; .filename as $path | .status as $status |
    (($path == ".release-please-manifest.json" or ($manifests | index($path) != null)) and
      $status == "modified") or
    (($changelogs | index($path) != null) and ($status == "modified" or $status == "added")))' \
  "$temporary/files.json" >/dev/null

# The packages whose changelog the PR brings, in the order above.
changed=()
while IFS= read -r package; do changed+=("$package"); done < <(
  jq -r --argjson packages "$packages_json" '[.[].filename] as $names |
    $packages[] as $package |
    select(($names | index("packages/\($package)/CHANGELOG.md")) != null) | $package' "$temporary/files.json")
[[ ${#changed[@]} != 0 ]] || { printf 'No changelog in the release PR.\n'; exit 0; }

# Only pinned Markdown blobs and directory-entry metadata are read; PR code is never executed.
# Aliases are numbered by position in `changed`, which holds only names from `packages`.
declarations='$owner: String!, $name: String!'
selections=''
variables=$(jq -n '{owner: "opsydyn", name: "fold-kit-experiments"}')
for i in "${!changed[@]}"; do
  declarations+=", \$p$i: String!, \$p${i}File: String!"
  selections+="
    p$i: object(expression: \$p$i) { __typename ... on Tree { entries { name mode type } } }
    p${i}File: object(expression: \$p${i}File) { __typename ... on Blob { text byteSize isBinary isTruncated } }"
  variables=$(jq --arg tree "p$i" --arg file "p${i}File" \
    --arg treeValue "$sha:packages/${changed[$i]}" --arg fileValue "$sha:packages/${changed[$i]}/CHANGELOG.md" \
    '. + {($tree): $treeValue, ($file): $fileValue}' <<< "$variables")
done
snapshot_query="query ChangelogSnapshot($declarations) {
  repository(owner: \$owner, name: \$name) {
    nameWithOwner$selections
  }
}"
jq -n --arg query "$snapshot_query" --argjson variables "$variables" '{query: $query, variables: $variables}' |
  gh api --hostname github.com --method POST graphql --input - > "$temporary/snapshot.json"
jq -e --arg repo "$repo" '((.errors // []) | length) == 0 and .data.repository.nameWithOwner == $repo' "$temporary/snapshot.json" >/dev/null

formatted=()
for i in "${!changed[@]}"; do
  package=${changed[$i]}
  jq -e --arg key "p$i" '.data.repository as $repo |
    ($repo[$key].__typename == "Tree") and
    ($repo[$key].entries | map(select(.name == "CHANGELOG.md")) |
      length == 1 and .[0].mode == 33188 and .[0].type == "blob") and
    ($repo[$key + "File"] | .__typename == "Blob" and .isBinary == false and .isTruncated == false and
      (.text | type == "string") and .byteSize <= 1048576 and .byteSize == (.text | utf8bytelength))' "$temporary/snapshot.json" >/dev/null
  mkdir "$temporary/$package"
  jq -j --arg key "p${i}File" '.data.repository[$key].text' "$temporary/snapshot.json" > "$temporary/$package/CHANGELOG.md"
  cp "$temporary/$package/CHANGELOG.md" "$temporary/$package/before.md"
  formatted+=("$temporary/$package/CHANGELOG.md")
done

env -u GH_TOKEN -u GITHUB_TOKEN -u NPM_TOKEN -u NODE_AUTH_TOKEN \
  "$root/node_modules/.bin/oxfmt" --config "$root/.oxfmtrc.json" --disable-nested-config "${formatted[@]}"
env -u GH_TOKEN -u GITHUB_TOKEN -u NPM_TOKEN -u NODE_AUTH_TOKEN \
  "$root/node_modules/.bin/oxfmt" --check --config "$root/.oxfmtrc.json" --disable-nested-config "${formatted[@]}"

printf '[]' > "$temporary/additions.json"
for package in "${changed[@]}"; do
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

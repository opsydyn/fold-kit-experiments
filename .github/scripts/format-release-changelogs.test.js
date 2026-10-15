import { afterEach, expect, test } from 'bun:test';
import { chmod, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = join(root, '.github/scripts/format-release-changelogs.sh');
const { repository, raw, formatted } = {
  repository: 'opsydyn/fold-kit-experiments',
  raw: '# Changelog\n\n## 1.0.0\n\n\n### Features\n\n* preserve [link](https://example.com) and café\n',
  formatted:
    '# Changelog\n\n## 1.0.0\n\n### Features\n\n- preserve [link](https://example.com) and café\n',
};
const head = 'a'.repeat(40);
const paths = ['packages/astro-foldkit/CHANGELOG.md', 'packages/foldkit-viz/CHANGELOG.md'];
const directories = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const fakeGh = `#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';
const file = process.env.FIXTURE;
const state = JSON.parse(readFileSync(file, 'utf8'));
const args = process.argv.slice(2);
state.calls.push(args);
let response;
if (args.includes('graphql')) {
  const request = JSON.parse(readFileSync(0, 'utf8'));
  state.requests.push(request);
  if (request.query.includes('mutation')) {
    state.mutations.push(request);
    if (state.scenario === 'race' || request.variables.input.expectedHeadOid !== state.pr.head.sha) {
      response = { errors: [{ message: 'expectedHeadOid mismatch' }] };
    } else {
      state.commits.push(request.variables.input);
      response = { data: { createCommitOnBranch: { commit: { oid: 'b'.repeat(40) } } } };
    }
  } else {
    response = state.snapshot;
  }
} else if (args.some((arg) => arg.endsWith('/files?per_page=100'))) {
  response = state.files;
} else {
  state.prReads += 1;
  response = state.pr;
  if (state.scenario === 'closed-before-write' && state.prReads > 1) response = { ...state.pr, state: 'closed' };
  if (state.scenario === 'head-before-write' && state.prReads > 1) response = { ...state.pr, head: { ...state.pr.head, sha: 'c'.repeat(40) } };
}
writeFileSync(file, JSON.stringify(state));
console.log(JSON.stringify(response));
`;

async function run(scenario = 'raw', output = null) {
  const directory = await mkdtemp(join(tmpdir(), 'foldkit-release-format-test-'));
  directories.push(directory);
  const bin = join(directory, 'bin');
  await mkdir(bin);
  await Bun.write(join(bin, 'gh'), fakeGh);
  await chmod(join(bin, 'gh'), 0o755);
  const content = scenario === 'formatted' ? formatted : raw;
  const blob = {
    __typename: 'Blob',
    text: content,
    byteSize: Buffer.byteLength(content),
    isBinary: false,
    isTruncated: false,
  };
  const entry = { name: 'CHANGELOG.md', mode: 0o100644, type: 'blob' };
  const state = {
    scenario,
    calls: [],
    requests: [],
    mutations: [],
    commits: [],
    prReads: 0,
    pr: {
      number: 23,
      state: 'open',
      merged_at: null,
      changed_files: 5,
      head: { ref: 'release-please--branches--main', sha: head, repo: { full_name: repository } },
      base: { ref: 'main', repo: { full_name: repository } },
      labels: [{ name: 'autorelease: pending' }],
    },
    files: [
      '.release-please-manifest.json',
      ...paths,
      'packages/astro-foldkit/package.json',
      'packages/foldkit-viz/package.json',
    ].map((filename) => ({ filename, status: 'modified' })),
    snapshot: {
      data: {
        repository: {
          nameWithOwner: repository,
          astro: { __typename: 'Tree', entries: [structuredClone(entry)] },
          viz: { __typename: 'Tree', entries: [structuredClone(entry)] },
          astroFile: structuredClone(blob),
          vizFile: structuredClone(blob),
        },
      },
    },
  };
  if (scenario === 'fork') state.pr.head.repo.full_name = 'someone/fork';
  if (scenario === 'wrong-branch') state.pr.head.ref = 'main';
  if (scenario === 'wrong-base') state.pr.base.ref = 'other';
  if (scenario === 'not-release') state.pr.labels = [];
  if (scenario === 'closed') state.pr.state = 'closed';
  if (scenario === 'unexpected-file') state.files[0].filename = '.github/workflows/ci.yml';
  if (scenario === 'renamed-file') state.files[0].status = 'renamed';
  if (scenario === 'incomplete-files') state.pr.changed_files = 6;
  if (scenario === 'symlink') state.snapshot.data.repository.astro.entries[0].mode = 0o120000;
  if (scenario === 'binary') state.snapshot.data.repository.astroFile.isBinary = true;
  if (scenario === 'truncated') state.snapshot.data.repository.astroFile.isTruncated = true;
  if (scenario === 'oversized') state.snapshot.data.repository.astroFile.byteSize = 1048577;
  if (scenario === 'missing-blob') state.snapshot.data.repository.astroFile = null;
  if (scenario === 'partial-query-error') state.snapshot.errors = [{ message: 'Partial response' }];
  if (scenario === 'one-file')
    state.snapshot.data.repository.vizFile = {
      ...blob,
      text: formatted,
      byteSize: Buffer.byteLength(formatted),
    };
  const fixture = join(directory, 'state.json');
  await Bun.write(fixture, Response.json(state));
  const prs =
    output ??
    (await Response.json([
      {
        number: 23,
        headBranchName: 'release-please--branches--main',
        baseBranchName: 'main',
        sha: head,
      },
    ]).text());
  const scriptPath =
    scenario === 'missing-formatter'
      ? join(directory, '.github/scripts/format-release-changelogs.sh')
      : script;
  if (scenario === 'missing-formatter') {
    await mkdir(join(directory, '.github/scripts'), { recursive: true });
    await Bun.write(scriptPath, Bun.file(script));
    await Bun.write(join(directory, '.oxfmtrc.json'), Bun.file(join(root, '.oxfmtrc.json')));
  }
  const child = Bun.spawn(['bash', scriptPath], {
    cwd: root,
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      FIXTURE: fixture,
      GH_TOKEN: 'test-only',
      GITHUB_REPOSITORY: repository,
      RELEASE_PLEASE_PRS: prs,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = await new Response(child.stdout).text();
  const stderr = await new Response(child.stderr).text();
  const code = await child.exited;
  return { code, stdout, stderr, state: await Bun.file(fixture).json() };
}

test('normalizes generated changelogs in one head-pinned commit without changing other files', async () => {
  const result = await run();
  expect(result.code).toBe(0);
  expect(result.state.commits).toHaveLength(1);
  const commit = result.state.commits[0];
  expect(commit.expectedHeadOid).toBe(head);
  expect(commit.branch).toEqual({
    repositoryNameWithOwner: repository,
    branchName: 'release-please--branches--main',
  });
  expect(commit.fileChanges.additions.map((file) => file.path)).toEqual(paths);
  expect(
    commit.fileChanges.additions.map((file) =>
      Buffer.from(file.contents, 'base64').toString('utf8'),
    ),
  ).toEqual([formatted, formatted]);
  expect(commit.fileChanges.deletions).toBeUndefined();
  expect(result.state.requests[0].variables.astroFile).toBe(
    `${head}:packages/astro-foldkit/CHANGELOG.md`,
  );
  expect(result.state.calls.every((args) => args.includes('github.com'))).toBe(true);
});

test('already normalized changelogs cause no commit', async () => {
  const result = await run('formatted');
  expect(result.code).toBe(0);
  expect(result.state.mutations).toEqual([]);
});

test('no generated PR means no GitHub calls', async () => {
  const result = await run('raw', '[]');
  expect(result.code).toBe(0);
  expect(result.state.calls).toEqual([]);
});

test('writes only the changelog that needs normalization', async () => {
  const result = await run('one-file');
  expect(result.code).toBe(0);
  expect(result.state.commits[0].fileChanges.additions.map((file) => file.path)).toEqual([
    paths[0],
  ]);
});

test.each([
  'fork',
  'wrong-branch',
  'wrong-base',
  'not-release',
  'closed',
  'unexpected-file',
  'renamed-file',
  'incomplete-files',
  'symlink',
  'binary',
  'truncated',
  'oversized',
  'missing-blob',
  'partial-query-error',
  'missing-formatter',
  'closed-before-write',
  'head-before-write',
])('rejects %s before any mutation', async (scenario) => {
  const result = await run(scenario);
  expect(result.code).not.toBe(0);
  expect(result.state.mutations).toEqual([]);
});

test('a concurrent head update is rejected without retry or successful commit', async () => {
  const result = await run('race');
  expect(result.code).not.toBe(0);
  expect(result.state.mutations).toHaveLength(1);
  expect(result.state.commits).toEqual([]);
});

test.each([
  '',
  'not-json',
  '{}',
  '[{"number":23,"headBranchName":"main","baseBranchName":"main"}]',
])('malformed or out-of-scope action output is rejected: %s', async (output) => {
  const result = await run('raw', output);
  expect(result.code).not.toBe(0);
  expect(result.state.calls).toEqual([]);
});

test('normalization is isolated from publication and uses only trusted workflow code', async () => {
  const workflow = Bun.YAML.parse(
    await Bun.file(join(root, '.github/workflows/release-please.yml')).text(),
  );
  expect(workflow.jobs).toHaveProperty('normalize-changelogs');
  const job = workflow.jobs['normalize-changelogs'];
  expect(job.needs).toBe('release');
  expect(job.if).toBe(
    "${{ always() && !cancelled() && needs.release.outputs.prs_created == 'true' }}",
  );
  expect(job.permissions).toEqual({ contents: 'write', 'pull-requests': 'read' });
  expect(job['timeout-minutes']).toBe(5);
  expect(workflow.jobs.release.needs).toBeUndefined();
  expect(workflow.jobs.release.outputs.prs).toBe('${{ steps.release.outputs.prs }}');
  const checkout = job.steps.find((step) => step.uses === 'actions/checkout@v4');
  expect(checkout.with).toEqual({ ref: '${{ github.sha }}', 'persist-credentials': false });
  expect(job.steps.find((step) => step.name === 'Install trusted formatter').run).toBe(
    'bun install --frozen-lockfile --ignore-scripts',
  );
  const normalize = job.steps.find((step) => step.name === 'Normalize generated changelogs');
  expect(normalize.run).toBe('bash .github/scripts/format-release-changelogs.sh');
  expect(normalize.env.RELEASE_PLEASE_PRS).toBe('${{ needs.release.outputs.prs }}');
  expect(normalize.env.GH_TOKEN).toBe(workflow.jobs.release.steps[0].with.token);
  const publishSteps = workflow.jobs.release.steps.filter((step) =>
    step.name.startsWith('Publish '),
  );
  expect(publishSteps.map((step) => step.run)).toEqual([
    'npm publish --access public --provenance',
    'npm publish --access public --provenance',
  ]);
  expect(publishSteps.map((step) => step.if)).toEqual([
    "${{ steps.release.outputs['packages/astro-foldkit--release_created'] == 'true' && env.NPM_TOKEN != '' }}",
    "${{ steps.release.outputs['packages/foldkit-viz--release_created'] == 'true' && env.NPM_TOKEN != '' }}",
  ]);
});

test('root tests include the hook while strict checks and workspace tests stay intact', async () => {
  const manifest = await Bun.file(join(root, 'package.json')).json();
  expect(manifest.scripts.test).toBe(
    "bun test ./.github/scripts/format-release-changelogs.test.js && bun run --sequential --filter '*' test",
  );
  // The effect-three packages add their stricter package-local lint between the two.
  expect(manifest.scripts.check).toBe(
    'NODE_OPTIONS="--experimental-strip-types" oxlint . && bun run --filter \'@opsydyn/effect-three*\' check && oxfmt --check .',
  );
  const ci = Bun.YAML.parse(await Bun.file(join(root, '.github/workflows/ci.yml')).text());
  expect(ci.jobs.check.steps.filter((step) => step.run).map((step) => step.run)).toEqual([
    'bun install --frozen-lockfile',
    'bun run check',
    'bun typecheck',
    'bun run test',
    'bun run build',
  ]);
});

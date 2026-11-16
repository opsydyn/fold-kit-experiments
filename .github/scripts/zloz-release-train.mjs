// ADR-0115: one immutable, resumable family train; npm never receives workspace sources.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const components = [
  'foldkit-zloz',
  'foldkit-zloz-elk',
  'foldkit-zloz-force',
  'foldkit-zloz-mermaid',
];
const repository = 'https://github.com/opsydyn/fold-kit-experiments';
const registry = 'https://registry.npmjs.org';
const exactVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const digest = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const pause = (ms) => new Promise((done) => setTimeout(done, ms));

export function releasePlan(candidates, sourceSha, tagShas, privateFlags, releaseSha = sourceSha) {
  assert.match(sourceSha, /^[a-f0-9]{40}$/, 'A full immutable source SHA is required');
  assert.match(releaseSha, /^[a-f0-9]{40}$/, 'A full immutable product release SHA is required');
  assert.equal(candidates.length, 4, 'All four public packages are required');
  assert.deepEqual(
    tagShas,
    components.map(() => releaseSha),
    'All four release tags must resolve to product release SHA',
  );
  assert.deepEqual(privateFlags, [true, true], 'CLI and Alchemy must remain private');
  const ordered = components.map((component) => {
    const matches = candidates.filter((item) => item.component === component);
    assert.equal(matches.length, 1, `Missing or duplicate ${component}`);
    return matches[0];
  });
  const version = ordered[0].manifest.version;
  assert.match(version, exactVersion);
  for (const item of ordered) {
    const manifest = item.manifest;
    assert.equal(manifest.name, `@opsydyn/${item.component}`);
    assert.equal(manifest.version, version, 'Family versions must match');
    assert.notEqual(manifest.private, true, 'Private packages cannot be published');
    if (item.component !== components[0])
      assert.equal(
        manifest.peerDependencies?.['@opsydyn/foldkit-zloz'],
        version,
        'Exact core peer required',
      );
    for (const [name, dependency] of Object.entries(manifest.dependencies ?? {})) {
      assert.match(
        dependency,
        exactVersion,
        `Packed dependency ${name} must be an exact registry version`,
      );
      assert(!name.startsWith('@opsydyn/foldkit-flow'), 'Obsolete identities are forbidden');
    }
  }
  return { sourceSha, releaseSha, version, candidates: ordered };
}

/** A repaired controller can publish an existing tag only with identical product/build inputs. */
export function assertControllerSource(sourceSha, releaseSha, changedPaths) {
  assert.match(sourceSha, /^[a-f0-9]{40}$/);
  assert.match(releaseSha, /^[a-f0-9]{40}$/);
  const allowed = new Set([
    '.github/scripts/zloz-release-train.mjs',
    '.github/scripts/zloz-release-train.test.js',
    '.github/scripts/zloz-registry-consumer.mjs',
    '.github/workflows/zloz-release-train.yml',
    'docs/adr/0115-serialize-zloz-publication-with-registry-verification.md',
    'docs/releases/foldkit-zloz.md',
  ]);
  assert(
    changedPaths.every((path) => allowed.has(path)),
    'Controller differs from tagged product/build inputs',
  );
  if (sourceSha === releaseSha) assert.deepEqual(changedPaths, []);
}

/** Public registry reads only: no credentials, redirects or arbitrary artifact hosts. */
export async function registryRequest(url, fetcher = fetch, wait = pause, binary = false) {
  const target = new URL(url.replaceAll('%2f', '%2F'));
  assert.equal(target.origin, registry);
  assert.equal(target.username + target.password, '');
  for (let attempt = 0; attempt < 4; attempt += 1) {
    target.searchParams.set('release-verification', `${Date.now()}-${attempt}`);
    const response = await fetcher(target.href, {
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: binary ? 'application/octet-stream' : 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
    if (response.status === 404) {
      await response.body?.cancel();
      return null;
    }
    if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 3) {
      await response.body?.cancel();
      await wait(5_000);
      continue;
    }
    assert(response.ok, `Registry HTTP ${response.status}: ${target.pathname}`);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      assert(size <= 64 * 1024 * 1024, 'Registry response exceeds 64 MiB');
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    return binary ? bytes : JSON.parse(bytes.toString('utf8'));
  }
  throw new Error('Registry retries exhausted');
}

export function verifyPublished(candidate, metadata, bytes, attestations, sourceSha) {
  const expected = candidate.manifest;
  assert.equal(metadata.name, expected.name);
  assert.equal(metadata.version, expected.version);
  assert.notEqual(metadata.private, true);
  assert.deepEqual(
    metadata.dependencies ?? {},
    expected.dependencies ?? {},
    'Published runtime dependencies differ',
  );
  assert.deepEqual(
    metadata.peerDependencies ?? {},
    expected.peerDependencies ?? {},
    'Published peers differ',
  );
  assert.equal(
    metadata.dist.integrity,
    candidate.integrity,
    'Published bytes differ from checked candidate',
  );
  assert.equal(digest(bytes), candidate.integrity, 'Downloaded tarball integrity differs');
  const expectedSubject = `pkg:npm/%40opsydyn/${candidate.component}@${expected.version}`;
  const expectedDigest = createHash('sha512').update(bytes).digest('hex');
  const statements = (attestations?.attestations ?? []).flatMap((entry) => {
    if (entry.predicateType !== 'https://slsa.dev/provenance/v1') return [];
    const envelope = entry.bundle?.dsseEnvelope ?? entry.bundle?.content?.dsseEnvelope;
    if (!envelope?.payload) return [];
    return [JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf8'))];
  });
  const matching = statements.find((statement) => {
    const build = statement.predicate?.buildDefinition;
    const workflow = build?.externalParameters?.workflow;
    return (
      statement._type === 'https://in-toto.io/Statement/v1' &&
      statement.predicateType === 'https://slsa.dev/provenance/v1' &&
      statement.subject?.some(
        (subject) => subject.name === expectedSubject && subject.digest?.sha512 === expectedDigest,
      ) &&
      workflow?.repository === repository &&
      ['.github/workflows/zloz-release-train.yml', '.github/workflows/release-please.yml'].includes(
        workflow.path,
      ) &&
      build.resolvedDependencies?.some(
        (dependency) =>
          dependency.uri?.startsWith(`git+${repository}@`) &&
          dependency.digest?.gitCommit === sourceSha,
      )
    );
  });
  assert(matching, 'No package/digest/repository/source-bound provenance statement');
  return {
    name: expected.name,
    version: expected.version,
    sourceSha,
    integrity: candidate.integrity,
    tarball: metadata.dist.tarball,
    attestations: metadata.dist.attestations.url,
    dependencies: metadata.dependencies ?? {},
    peers: metadata.peerDependencies ?? {},
    observedAt: new Date().toISOString(),
  };
}

/** Boundaries supplied by the runner; tests exercise the same sequencing and stop rules. */
export async function runTrain(plan, io) {
  // Inspect every already-published version before the first irreversible write.
  const observed = new Map();
  for (const item of plan.candidates) {
    const metadata = await io.lookup(item);
    if (metadata !== null) await io.verify(item, metadata);
    observed.set(item.component, metadata);
  }
  for (const item of plan.candidates)
    for (const [name, version] of Object.entries(item.manifest.dependencies ?? {}))
      if (!plan.candidates.some((other) => other.manifest.name === name))
        await io.verifyDependency(name, version);
  for (const item of plan.candidates) {
    let metadata = observed.get(item.component);
    if (metadata === null) {
      await io.publish(item); // Never retry an uncertain upload; rerun reconciles registry state.
      metadata = await io.waitForPublication(item);
    }
    const receipt = await io.verify(item, metadata);
    await io.audit(item); // npm validates registry signatures and Sigstore provenance.
    await io.record({ ...receipt, releaseSha: plan.releaseSha, signatureAudit: 'passed' });
  }
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const command = (exe, args, options = {}) =>
  execFileSync(exe, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 180_000,
    ...options,
  });
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const versionUrl = (name, version) =>
  `${registry}/${encodeURIComponent(name).replace('%40', '@')}/${version}`;

/** Compiler cleanup can remove dist/pack; only retained, checked archives reach publication. */
export function loadCandidates(source, directory) {
  return source.candidates.map((item) => {
    const path = join(directory, 'candidates', `opsydyn-${item.component}-${source.version}.tgz`);
    const manifest = JSON.parse(command('tar', ['-xOf', path, 'package/package.json']));
    return { ...item, path, manifest, integrity: digest(readFileSync(path)) };
  });
}

function checkSource(releaseSha) {
  assert.match(releaseSha, /^[a-f0-9]{40}$/, 'Expected full product release SOURCE_SHA');
  const sourceSha = process.env.GITHUB_SHA;
  assert.match(sourceSha, /^[a-f0-9]{40}$/, 'Expected full workflow source SHA');
  assert.equal(process.env.GITHUB_REPOSITORY, 'opsydyn/fold-kit-experiments');
  assert.equal(command('git', ['rev-parse', 'HEAD']).trim(), sourceSha);
  const differences = command('git', ['diff', '--name-only', releaseSha, sourceSha]).trim();
  assertControllerSource(sourceSha, releaseSha, differences === '' ? [] : differences.split('\n'));
  const candidates = components.map((component) => {
    const manifest = json(join(root, 'packages', component, 'package.json'));
    const dependencies = Object.fromEntries(
      Object.entries(manifest.dependencies ?? {}).map(([name, version]) => [
        name,
        version === 'workspace:*'
          ? json(join(root, 'packages', name.replace('@opsydyn/', ''), 'package.json')).version
          : version,
      ]),
    );
    return { component, manifest: { ...manifest, dependencies } };
  });
  const version = candidates[0].manifest.version;
  const tags = components.map((component) =>
    command('git', ['rev-parse', `refs/tags/${component}-v${version}^{commit}`]).trim(),
  );
  return releasePlan(
    candidates,
    sourceSha,
    tags,
    ['foldkit-zloz-cli', 'foldkit-zloz-alchemy'].map(
      (name) => json(join(root, 'packages', name, 'package.json')).private,
    ),
    releaseSha,
  );
}

export async function waitForCI(
  sourceSha,
  readRuns = () =>
    JSON.parse(
      command('gh', [
        'api',
        `repos/opsydyn/fold-kit-experiments/actions/workflows/ci.yml/runs?head_sha=${sourceSha}&event=push&per_page=10`,
      ]),
    ),
  wait = pause,
) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const runs = await readRuns();
    const run = runs.workflow_runs.find((item) => item.head_sha === sourceSha);
    if (run?.status === 'completed') {
      assert.equal(run.conclusion, 'success', `Exact-source CI failed: ${run.html_url}`);
      console.log(`Qualified source CI: ${run.html_url}`);
      return;
    }
    console.log('Waiting for exact-source main CI');
    await wait(15_000);
  }
  throw new Error('Exact-source CI did not complete in 30 minutes');
}

async function verifyFromRegistry(candidate, metadata, sourceSha) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const bytes = await registryRequest(metadata.dist.tarball, fetch, pause, true);
    const attestations = metadata.dist.attestations?.url
      ? await registryRequest(metadata.dist.attestations.url)
      : null;
    if (bytes !== null && attestations !== null)
      return verifyPublished(candidate, metadata, bytes, attestations, sourceSha);
    await pause(5_000);
    metadata =
      (await registryRequest(versionUrl(candidate.manifest.name, candidate.manifest.version))) ??
      metadata;
  }
  throw new Error(`Artifact/provenance propagation timed out: ${candidate.component}`);
}

async function main() {
  const source = checkSource(process.env.SOURCE_SHA);
  const sourceSha = source.sourceSha;
  if (process.argv[2] === 'preflight') {
    await waitForCI(sourceSha);
    if (source.releaseSha !== sourceSha) await waitForCI(source.releaseSha);
    return;
  }
  assert(process.env.NODE_AUTH_TOKEN, 'NPM_TOKEN is required');
  const output = join(root, 'dist', 'zloz-release');
  mkdirSync(output, { recursive: true });
  const candidates = loadCandidates(source, output);
  const plan = releasePlan(
    candidates,
    sourceSha,
    components.map(() => source.releaseSha),
    [true, true],
    source.releaseSha,
  );
  writeFileSync(join(output, 'candidates.json'), `${JSON.stringify(plan, null, 2)}\n`);
  const consumer = mkdtempSync(join(tmpdir(), 'zloz-registry-consumer-'));
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  writeFileSync(join(consumer, '.npmrc'), `registry=${registry}\nignore-scripts=true\n`);
  const npmOptions = {
    cwd: consumer,
    stdio: 'inherit',
    timeout: 300_000,
    env: {
      ...process.env,
      NPM_CONFIG_CACHE: join(consumer, 'cache'),
      NPM_CONFIG_USERCONFIG: join(consumer, '.npmrc'),
    },
  };
  const receipts = [];
  const persist = (status, error = null) =>
    writeFileSync(
      join(output, 'verification.json'),
      `${JSON.stringify(
        {
          version: source.version,
          sourceSha,
          releaseSha: source.releaseSha,
          status,
          error,
          receipts,
          run: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
          limits: [
            'ELK server baseline Node 22+; standalone Bun ELK lifecycle unqualified',
            'Human device and assistive-technology acceptance pending',
          ],
        },
        null,
        2,
      )}\n`,
    );
  persist('running');
  // oxlint-disable-next-line linteffect/no-try-catch -- Native process boundary records failure evidence before propagating the original error.
  try {
    await runTrain(plan, {
      lookup: (item) => registryRequest(versionUrl(item.manifest.name, item.manifest.version)),
      verifyDependency: async (name, version) => {
        const metadata = await registryRequest(versionUrl(name, version));
        assert(
          metadata && metadata.name === name && metadata.version === version,
          `Missing external dependency ${name}@${version}`,
        );
        const bytes = await registryRequest(metadata.dist.tarball, fetch, pause, true);
        assert(
          bytes && digest(bytes) === metadata.dist.integrity,
          `Invalid dependency bytes: ${name}`,
        );
      },
      publish: (item) => {
        console.log(`Publishing checked archive: ${item.manifest.name}@${item.manifest.version}`);
        command(
          'npm',
          [
            'publish',
            item.path,
            '--registry',
            registry,
            '--access',
            'public',
            '--provenance',
            '--ignore-scripts',
          ],
          { stdio: 'inherit' },
        );
      },
      waitForPublication: async (item) => {
        for (let attempt = 0; attempt < 24; attempt += 1) {
          const metadata = await registryRequest(
            versionUrl(item.manifest.name, item.manifest.version),
          );
          if (metadata !== null) return metadata;
          await pause(5_000);
        }
        throw new Error(`Registry metadata propagation timed out: ${item.component}`);
      },
      verify: (item, metadata) => verifyFromRegistry(item, metadata, sourceSha),
      audit: (item) => {
        command(
          'npm',
          [
            'install',
            `${item.manifest.name}@${item.manifest.version}`,
            '--save-exact',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
          ],
          npmOptions,
        );
        const lock = json(join(consumer, 'package-lock.json'));
        assert.equal(lock.packages[`node_modules/${item.manifest.name}`].integrity, item.integrity);
        command('npm', ['audit', 'signatures'], npmOptions);
      },
      record: (receipt) => {
        receipts.push(receipt);
        persist('running');
        console.log(`Verified ${receipt.name}@${receipt.version}`);
      },
    });
    // Exercise the actual registry-installed family together, outside workspace resolution.
    const smoke = join(consumer, 'consumer.mjs');
    writeFileSync(
      smoke,
      readFileSync(join(root, '.github', 'scripts', 'zloz-registry-consumer.mjs')),
    );
    command('node', [smoke], npmOptions);
    persist('complete');
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `Published and registry-verified Zloz ${source.version} at ${sourceSha}. Four signature/provenance audits and the Node registry consumer passed.\n`,
      );
  } catch (error) {
    persist('failed', String(error));
    throw error;
  }
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();

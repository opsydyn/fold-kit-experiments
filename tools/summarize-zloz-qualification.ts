/** Summarize this task's Playwright JSON output without committing traces or base64 attachments. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { cpus, platform, release, arch, totalmem } from 'node:os';
import { resolve } from 'node:path';
type Attachment = Readonly<{ name: string; contentType: string; body?: string }>;
type TestResult = Readonly<{ status: string; attachments: readonly Attachment[] }>;
type Spec = Readonly<{
  title: string;
  tests: readonly Readonly<{ projectName: string; results: readonly TestResult[] }>[];
}>;
type Suite = Readonly<{ suites?: readonly Suite[]; specs?: readonly Spec[] }>;
type Report = Readonly<{
  suites: readonly Suite[];
  stats: object;
  config: Readonly<{ version: string }>;
}>;
type AxeCapture = Readonly<{
  violations: readonly Readonly<{ id: string; nodes: readonly object[] }>[];
  incomplete: readonly Readonly<{ id: string; nodes: readonly object[] }>[];
}>;
const root = resolve(import.meta.dirname, '..');
const directory = resolve(root, 'apps/zloz-demo/evidence/v3-completion');
// This is the local reporter output of the checked-in qualification suite, not a portable editor input.
const report: Report = JSON.parse(
  readFileSync(resolve(directory, 'playwright-results.json'), 'utf8'),
);
function flatten(suite: Suite): readonly Spec[] {
  return [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(flatten)];
}
const specs = report.suites.flatMap(flatten);
const observations: object[] = [],
  accessibility: object[] = [],
  cases: object[] = [];
for (const spec of specs)
  for (const test of spec.tests)
    for (const result of test.results) {
      cases.push({ project: test.projectName, title: spec.title, status: result.status });
      for (const attachment of result.attachments) {
        if (!attachment.body || attachment.contentType !== 'application/json') continue;
        const text = Buffer.from(attachment.body, 'base64').toString('utf8');
        if (attachment.name === 'observations.json') observations.push(JSON.parse(text));
        else if (attachment.name.startsWith('axe-')) {
          const axe: AxeCapture = JSON.parse(text);
          accessibility.push({
            project: test.projectName,
            state: attachment.name,
            violationCount: axe.violations.length,
            violations: axe.violations.map((v) => ({ id: v.id, affected: v.nodes.length })),
            incomplete: axe.incomplete.map((v) => ({ id: v.id, affected: v.nodes.length })),
          });
        }
      }
    }
const git = (args: readonly string[]) =>
  execFileSync('git', [...args], { cwd: root, encoding: 'utf8' }).trim();
const sources = git([
  'ls-files',
  '--cached',
  '--others',
  '--exclude-standard',
  'packages/foldkit-zloz/src',
  'packages/astro-foldkit/src',
  'apps/zloz-demo/src',
  'apps/web/e2e/zloz-native-release.spec.ts',
  'apps/web/playwright.zloz.config.ts',
])
  .split('\n')
  .filter(Boolean)
  .sort();
const hash = createHash('sha256');
for (const file of sources) {
  hash.update(file);
  hash.update(readFileSync(resolve(root, file)));
}
const artifactHash = createHash('sha256');
const artifacts = execFileSync('rg', ['--files', '--no-ignore', 'apps/zloz-demo/dist'], {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .sort();
for (const file of artifacts) {
  artifactHash.update(file);
  artifactHash.update(readFileSync(resolve(root, file)));
}
const evidence = {
  scope: 'local-automated-provisional-matrix',
  capturedAt: new Date().toISOString(),
  head: git(['rev-parse', 'HEAD']),
  workingTreeDirty: git(['status', '--porcelain']) !== '',
  sourceSha256: hash.digest('hex'),
  builtArtifactSha256: artifactHash.digest('hex'),
  sourceCapture:
    'Source bytes after formatting; builtArtifactSha256 identifies the measured built site.',
  host: {
    platform: platform(),
    release: release(),
    architecture: arch(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    memoryBytes: totalmem(),
    node: execFileSync('node', ['--version'], { encoding: 'utf8' }).trim(),
    bun: Bun.version,
    playwright: report.config.version,
  },
  stats: report.stats,
  cases,
  observations,
  accessibility,
  limits: [
    'Synthetic flat/nested 100 and 1000 total nodes, 99 or 999 edges; all nodes mounted without virtualization.',
    'Five sequential keyboard samples include Playwright scheduling and two animation frames. No numeric latency budget was agreed.',
    'Desktop 1440x1000 and touch-capable viewport 390x844 are provisional automated coverage; no physical-device or screen-reader sign-off is implied.',
    'Chromium CDP multitouch is synthetic browser input; Firefox/WebKit real-device pinch remains a human acceptance gate.',
    'Any axe incomplete results require manual review; no violation is not a blanket accessibility conformance claim.',
  ],
};
writeFileSync(resolve(directory, 'qualification.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(
  JSON.stringify({
    stats: report.stats,
    observations: observations.length,
    accessibility: accessibility.length,
    sourceSha256: evidence.sourceSha256,
  }),
);

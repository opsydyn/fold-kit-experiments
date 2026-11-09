import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  createEventStormingPattern,
  serializeGraph,
  eventStormingRelationshipRules,
  captureModelDocument,
  captureEdition,
  serializeModelDocument,
  parseSnapshot,
} from '@opsydyn/foldkit-zloz';

import mermaid from '../../foldkit-zloz-mermaid/package.json';
import core from '../../foldkit-zloz/package.json';
import manifest from '../package.json';

const exec = promisify(execFile);
const root = path.resolve(import.meta.dir, '../../..');
const empty = '{"version":1,"graph":{"nodes":[],"edges":[]}}';
const graph =
  '{"version":1,"graph":{"nodes":[{"id":"orders","label":"Orders","position":{"x":0,"y":0},"size":{"width":200,"height":100},"ports":[]}],"edges":[]}}';

test('qualified tarballs install a real zloz binary with Node/Bun exit and I/O contracts', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zloz-cli-consumer-'));
  // Native package/process fixtures must be removed even when a command fails.
  // oxlint-disable-next-line linteffect/no-try-catch
  try {
    await exec('bun', ['run', '--filter', manifest.name, 'pack:check'], {
      cwd: root,
      maxBuffer: 5 * 1024 * 1024,
    });
    for (const name of ['foldkit-zloz', 'foldkit-zloz-mermaid'])
      await exec('bun', ['pm', 'pack', '--destination', directory], {
        cwd: path.join(root, 'packages', name),
      });
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({
        private: true,
        type: 'module',
        dependencies: {
          [core.name]: `file:${path.join(directory, `opsydyn-foldkit-zloz-${core.version}.tgz`)}`,
          [mermaid.name]: `file:${path.join(directory, `opsydyn-foldkit-zloz-mermaid-${mermaid.version}.tgz`)}`,
          [manifest.name]: `file:${path.join(root, 'packages/foldkit-zloz-cli/dist/pack', `opsydyn-foldkit-zloz-cli-${manifest.version}.tgz`)}`,
        },
      }),
    );
    await exec('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: directory,
      maxBuffer: 5 * 1024 * 1024,
    });
    for (const dependency of [
      'foldkit',
      'astro',
      'react',
      'elkjs',
      'mermaid',
      'mermaid-ast',
      '@mermaid-js/parser',
    ])
      expect(existsSync(path.join(directory, 'node_modules', dependency))).toBe(false);
    const bin = path.join(directory, 'node_modules/.bin/zloz');
    const run = async (command: readonly string[], input = '') => {
      const child = Bun.spawn([...command], {
        cwd: directory,
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, NO_COLOR: '1' },
      });
      child.stdin.write(input);
      child.stdin.end();
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      return { code, stdout, stderr };
    };
    const help = await run([bin, '--help']);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain('validate');
    expect(help.stdout).toContain('mermaid');
    expect(help.stdout).toContain('relationships');
    expect(help.stderr).toBe('');
    const version = await run([bin, '--version']);
    expect(version.code).toBe(0);
    expect(version.stdout).toContain(manifest.version);
    const modelFile = path.join(directory, 'model.json');
    await writeFile(modelFile, graph);
    const checkpoint = captureEdition({
      id: 'baseline',
      name: 'Baseline',
      snapshot: parseSnapshot(graph),
    });
    const modelText = serializeModelDocument(
      captureModelDocument({
        id: 'alternative',
        name: 'Alternative',
        snapshot: checkpoint.snapshot,
        editions: [checkpoint],
        origin: { modelId: 'parent', modelName: 'Parent', edition: checkpoint },
      }),
    );
    const portableFile = path.join(directory, 'portable.model.json');
    await writeFile(portableFile, modelText);
    const causal = createEventStormingPattern();
    const firstCausal = causal.edges[0];
    if (!firstCausal) throw new Error('Missing causal fixture');
    const customText = serializeGraph({
      ...causal,
      edges: [
        {
          ...firstCausal,
          architecture: { family: 'event-storming', role: 'custom', name: 'approves' },
        },
      ],
    });
    const customRules = path.join(directory, 'causal-rules.json');
    const comparisonText = serializeModelDocument({
      id: 'audit-comparison',
      name: 'Audit comparison',
      origin: null,
      snapshot: {
        graph: {
          ...causal,
          edges: [
            {
              ...firstCausal,
              architecture: { family: 'event-storming', role: 'custom', name: 'approves' },
            },
          ],
        },
      },
      editions: [
        { id: 'baseline', name: 'Baseline', snapshot: { graph: causal } },
        {
          id: 'custom',
          name: 'Custom',
          snapshot: {
            graph: {
              ...causal,
              edges: [
                {
                  ...firstCausal,
                  architecture: { family: 'event-storming', role: 'custom', name: 'approves' },
                },
              ],
            },
          },
        },
      ],
    });
    const comparisonFile = path.join(directory, 'comparison.model.json');
    await writeFile(comparisonFile, comparisonText);
    await writeFile(
      customRules,
      JSON.stringify({
        version: 1,
        rules: [
          ...eventStormingRelationshipRules,
          {
            architecture: { family: 'event-storming', role: 'custom', name: 'approves' },
            sources: ['actor'],
            targets: ['command'],
            label: 'Approves',
          },
        ],
      }),
    );
    for (const runtime of ['node', 'bun']) {
      const regression = await run([
        runtime,
        bin,
        'relationships',
        'compare',
        '--baseline',
        'baseline',
        '-i',
        comparisonFile,
      ]);
      expect(regression.code).toBe(1);
      expect(regression.stderr).toBe('');
      expect(JSON.parse(regression.stdout)).toMatchObject({
        operation: 'relationships-compare',
        status: 'compared',
        data: { summary: { introduced: 1, resolved: 0, persisting: 0 } },
      });
      const persisting = await run(
        [runtime, bin, 'relationships', 'compare', '--baseline', 'custom'],
        comparisonText,
      );
      expect(persisting.code).toBe(0);
      expect(persisting.stderr).toBe('');
      expect(JSON.parse(persisting.stdout).data.summary).toEqual({
        introduced: 0,
        resolved: 0,
        persisting: 1,
      });
      const resolution = await run(
        [runtime, bin, 'relationships', 'compare', '--baseline', 'custom', '--edition', 'baseline'],
        comparisonText,
      );
      expect(resolution.code).toBe(0);
      expect(resolution.stderr).toBe('');
      expect(JSON.parse(resolution.stdout).data.summary.resolved).toBe(1);
      const conventionComparison = await run(
        [
          runtime,
          bin,
          'relationships',
          'compare',
          '--baseline',
          'baseline',
          '--rules',
          customRules,
        ],
        comparisonText,
      );
      expect(conventionComparison.code).toBe(0);
      expect(conventionComparison.stderr).toBe('');
      expect(JSON.parse(conventionComparison.stdout).data.summary.introduced).toBe(0);
      const missingEdition = await run(
        [runtime, bin, 'relationships', 'compare', '--baseline', 'absent'],
        comparisonText,
      );
      expect(missingEdition.code).toBe(2);
      expect(missingEdition.stderr).toBe('');
      expect(JSON.parse(missingEdition.stdout).diagnostics[0].code).toBe('unknown-baseline');
      const audited = await run([runtime, bin, 'relationships', 'audit'], serializeGraph(causal));
      expect(audited.code).toBe(0);
      expect(audited.stderr).toBe('');
      expect(JSON.parse(audited.stdout).data.summary).toEqual({
        edges: 4,
        typed: 4,
        inferred: 0,
        unrelated: 0,
        blocked: 0,
      });
      const incompatible = await run([runtime, bin, 'relationships', 'audit'], customText);
      expect(incompatible.code).toBe(1);
      expect(incompatible.stderr).toBe('');
      expect(JSON.parse(incompatible.stdout).diagnostics[0].code).toBe(
        'relationship-unknown-relationship',
      );
      const customAudit = await run(
        [runtime, bin, 'relationships', 'audit', '--rules', customRules],
        customText,
      );
      expect(customAudit.code).toBe(0);
      expect(customAudit.stderr).toBe('');
      expect(JSON.parse(customAudit.stdout).data.entries[0].relationshipKey).toBe(
        'custom:approves',
      );
      const badRules = await run([runtime, bin, 'relationships', 'audit', '--rules', '-'], empty);
      expect(badRules.code).toBe(2);
      expect(badRules.stderr).toBe('');
      expect(JSON.parse(badRules.stdout).diagnostics[0].code).toBe('invalid-rules');
      const portable = await run([runtime, bin, 'validate', '--input', portableFile]);
      expect(portable.code).toBe(0);
      expect(JSON.parse(portable.stdout).model).toEqual({
        id: 'alternative',
        name: 'Alternative',
        editions: 1,
        origin: { modelId: 'parent', editionId: 'baseline' },
      });
      const strictModel = await run([runtime, bin, 'mermaid', 'export', '-i', portableFile]);
      expect(strictModel.code).toBe(1);
      expect(
        JSON.parse(strictModel.stdout).diagnostics.map((d: { code: string }) => d.code),
      ).toContain('model-metadata-omitted');
      const projected = await run([
        runtime,
        bin,
        'mermaid',
        'export',
        '-i',
        portableFile,
        '--loss-policy',
        'report',
      ]);
      expect(projected.code).toBe(0);
      expect(
        JSON.parse(projected.stdout).diagnostics.map((d: { code: string }) => d.code),
      ).toContain('model-metadata-omitted');
      const valid = await run([runtime, bin, 'validate'], empty);
      expect(valid.code).toBe(0);
      expect(JSON.parse(valid.stdout).status).toBe('valid');
      expect(valid.stderr).toBe('');
      const rejected = await run([runtime, bin, 'mermaid', 'export', '-i', modelFile]);
      expect(rejected.code).toBe(1);
      expect(
        JSON.parse(rejected.stdout).diagnostics.map((d: { code: string }) => d.code),
      ).toContain('layout-omitted');
      expect(rejected.stderr).toBe('');
      const converted = await run([
        runtime,
        bin,
        'mermaid',
        'export',
        '-i',
        modelFile,
        '--loss-policy',
        'report',
      ]);
      expect(converted.code).toBe(0);
      expect(JSON.parse(converted.stdout).data.identity.nodes[0].flowId).toBe('orders');
      expect(converted.stderr).toBe('');
      const invalid = await run([runtime, bin, 'validate'], '{bad');
      expect(invalid.code).toBe(2);
      expect(JSON.parse(invalid.stdout).diagnostics[0].code).toBe('invalid-json');
      expect(invalid.stderr).toBe('');
      const flags = await run([runtime, bin, 'mermaid', 'export', '--direction', 'TD']);
      expect(flags.code).toBe(2);
      expect(flags.stdout).toBe('');
      expect(JSON.parse(flags.stderr).diagnostics[0].code).toBe('invalid-arguments');
      const missing = await run([runtime, bin, 'validate', '-i', 'missing.json']);
      expect(missing.code).toBe(2);
      expect(JSON.parse(missing.stdout).diagnostics[0].code).toBe('input-unavailable');
    }
    expect(await readFile(modelFile, 'utf8')).toBe(graph);
    expect(await readFile(portableFile, 'utf8')).toBe(modelText);
    expect(await readFile(comparisonFile, 'utf8')).toBe(comparisonText);
    const tooLarge = path.join(directory, 'oversized.json');
    await writeFile(tooLarge, ' '.repeat(1_048_577));
    const limited = await run([bin, 'validate', '-i', tooLarge]);
    expect(limited.code).toBe(2);
    expect(JSON.parse(limited.stdout).diagnostics[0].code).toBe('input-limit');
    const badConversion = await run(
      [bin, 'mermaid', 'export', '--loss-policy', 'report'],
      graph.replace('Orders', 'fa:house'),
    );
    expect(badConversion.code).toBe(1);
    expect(
      JSON.parse(badConversion.stdout).diagnostics.map((d: { code: string }) => d.code),
    ).toContain('unsupported-label-encoding');
    await writeFile(
      path.join(directory, 'consumer.ts'),
      `import { CliAuditRegression, readDocument, readGraph, run, cliProtocol, type CliDocument, type CliResponse } from '@opsydyn/foldkit-zloz-cli';
const comparison:Extract<CliResponse,{status:'compared'}>['data']['summary']={introduced:0,resolved:1,persisting:2}; void comparison; void CliAuditRegression;
const result: CliResponse = { protocol: cliProtocol, operation: 'validate', status: 'valid', summary: { nodes: 0, edges: 0 }, diagnostics: [] }; void run; void result; void readDocument; void readGraph; const document: CliDocument = { kind: 'snapshot', snapshot: { graph: { nodes: [], edges: [] } } }; void document;`,
    );
    const tsc = path.join(root, 'packages/foldkit-zloz-cli/node_modules/.bin/tsc');
    for (const mode of ['Bundler', 'NodeNext'])
      await exec(
        tsc,
        [
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--target',
          'ES2022',
          '--module',
          mode === 'NodeNext' ? 'NodeNext' : 'ESNext',
          '--moduleResolution',
          mode,
          'consumer.ts',
        ],
        { cwd: directory },
      );
    await writeFile(
      path.join(directory, 'signal.mjs'),
      `import { NodeRuntime, NodeServices } from '@effect/platform-node';
import { Console, Effect, Stdio, Stream } from 'effect'; import { program } from '@opsydyn/foldkit-zloz-cli';
const main = Effect.gen(function*(){ const stdio=yield* Stdio.Stdio; yield* program.pipe(Effect.provideService(Stdio.Stdio,Stdio.make({...stdio,stdin:stdio.stdin.pipe(Stream.tap(()=>Console.error('cli-ready')))}))); });
NodeRuntime.runMain(main.pipe(Effect.provide(NodeServices.layer)),{disableErrorReporting:true});`,
    );
    const child = Bun.spawn(['node', 'signal.mjs', 'validate'], {
      cwd: directory,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const reader = child.stderr.getReader();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // This process belongs to the fixture; kill it on timeout as well as assertion failure.
    // oxlint-disable-next-line linteffect/no-try-catch
    try {
      child.stdin.write('{');
      const ready = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('CLI did not begin reading stdin')), 5000);
        }),
      ]);
      expect(new TextDecoder().decode(ready.value)).toContain('cli-ready');
      child.kill('SIGINT');
      expect(await child.exited).toBe(130);
      expect(await new Response(child.stdout).text()).toBe('');
    } finally {
      clearTimeout(timer);
      reader.releaseLock();
      if (child.exitCode === null) child.kill();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);

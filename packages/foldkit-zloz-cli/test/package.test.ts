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
import c4ReceiptWire from '../../foldkit-zloz/test/fixtures/c4-conversion-v1.json';
import dddExpected from '../../foldkit-zloz/test/fixtures/ddd-audit-report.json';
import dddWire from '../../foldkit-zloz/test/fixtures/ddd-audit-v1.json';
import dddReview from '../../foldkit-zloz/test/fixtures/ddd-review-model.json';
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
    const run = async (command: readonly string[], input: string | Uint8Array = '') => {
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
    expect(help.stdout).toContain('review');
    expect(help.stderr).toBe('');
    const reviewHelp = await run([bin, 'review', '--help']);
    expect(reviewHelp.code).toBe(0);
    expect(reviewHelp.stdout).toContain('inspect');
    expect(reviewHelp.stdout).toContain('validate');
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
    const patchLiteral = JSON.parse(
      await readFile(
        path.join(root, 'packages/foldkit-zloz/test/fixtures/modelling-patch-v1.json'),
        'utf8',
      ),
    );
    const patchSourceFile = path.join(directory, 'patch-source.model.json');
    await writeFile(
      patchSourceFile,
      serializeModelDocument(
        captureModelDocument({
          id: patchLiteral.source.modelId,
          name: 'Commerce',
          snapshot: { graph: patchLiteral.source.graph },
          editions: [],
          origin: null,
        }),
      ),
    );
    const dddFile = path.join(directory, 'ddd.json'),
      dddRulesFile = path.join(directory, 'ddd-rules.json');
    const dddText = JSON.stringify(dddWire);
    const dddCustom = JSON.stringify({
      ...dddWire,
      graph: {
        ...dddWire.graph,
        edges: dddWire.graph.edges.filter((edge) => edge.id === 'e-custom'),
      },
    });
    const dddRulesText = JSON.stringify({
      version: 1,
      rules: [
        {
          architecture: { family: 'ddd', scope: 'tactical', role: 'custom', name: 'enriches' },
          sources: ['aggregate-root'],
          targets: ['domain-event'],
          label: 'Enriches',
          direction: 'directed',
        },
      ],
    });
    await writeFile(dddFile, dddText);
    await writeFile(dddRulesFile, dddRulesText);
    for (const runtime of ['node', 'bun']) {
      const c4Input = JSON.stringify(c4ReceiptWire);
      const c4Report = await run([runtime, bin, 'c4', 'receipt', 'inspect'], c4Input);
      expect(c4Report.code).toBe(0);
      expect(c4Report.stderr).toBe('');
      expect(c4Report.stdout.trim().split('\n')).toHaveLength(1);
      expect(JSON.parse(c4Report.stdout)).toMatchObject({
        operation: 'c4-receipt-inspect',
        status: 'inspected',
        data: {
          authority: 'read-only-evidence',
          provenance: c4ReceiptWire.source,
          target: c4ReceiptWire.document,
        },
      });
      const c4Future = await run(
        [runtime, bin, 'c4', 'receipt', 'inspect'],
        JSON.stringify({ ...c4ReceiptWire, version: 2 }),
      );
      expect(c4Future.code).toBe(1);
      expect(c4Future.stderr).toBe('');
      expect(JSON.parse(c4Future.stdout).diagnostics[0].code).toBe('incompatible-c4-receipt');
      const c4Invalid = await run(
        [runtime, bin, 'c4', 'receipt', 'inspect'],
        JSON.stringify({
          ...c4ReceiptWire,
          document: { ...c4ReceiptWire.document, name: 'Forged target' },
        }),
      );
      expect(c4Invalid.code).toBe(2);
      expect(c4Invalid.stderr).toBe('');
      expect(JSON.parse(c4Invalid.stdout).diagnostics[0].code).toBe('invalid-c4-receipt');
      const c4Utf8 = await run(
        [runtime, bin, 'c4', 'receipt', 'inspect'],
        new Uint8Array([0xc3, 0x28]),
      );
      expect(c4Utf8.code).toBe(2);
      expect(JSON.parse(c4Utf8.stdout).diagnostics[0].code).toBe('invalid-utf8');

      const compareInput = JSON.stringify(dddReview);
      const dddComparison = await run(
        [runtime, bin, 'ddd', 'compare', '--baseline', 'ddd-before'],
        compareInput,
      );
      expect(dddComparison.code).toBe(1);
      expect(dddComparison.stderr).toBe('');
      expect(dddComparison.stdout.trim().split('\n')).toHaveLength(1);
      expect(JSON.parse(dddComparison.stdout)).toMatchObject({
        operation: 'ddd-compare',
        status: 'compared',
        data: { summary: { introduced: 2, resolved: 3, persisting: 1 } },
      });
      const stable = await run(
        [runtime, bin, 'ddd', 'compare', '--baseline', 'ddd-before', '--edition', 'ddd-before'],
        compareInput,
      );
      expect(stable.code).toBe(0);
      expect(stable.stderr).toBe('');
      expect(JSON.parse(stable.stdout).data.selected.audit.status).toBe('incompatible');
      const customComparison = await run(
        [runtime, bin, 'ddd', 'compare', '--baseline', 'ddd-before', '--rules', dddRulesFile],
        compareInput,
      );
      expect(customComparison.code).toBe(0);
      expect(JSON.parse(customComparison.stdout).data.summary).toEqual({
        introduced: 0,
        resolved: 2,
        persisting: 2,
      });
      for (const [args, value, code] of [
        [['--baseline', 'missing'], compareInput, 'unknown-baseline'],
        [['--baseline', 'ddd-before', '--edition', 'missing'], compareInput, 'unknown-edition'],
        [['--baseline', 'ddd-before'], empty, 'model-required'],
        [['--baseline', 'ddd-before'], '{bad', 'invalid-json'],
        [['--baseline', 'ddd-before', '--rules', '-'], compareInput, 'invalid-rules'],
      ] as const) {
        const invalid = await run([runtime, bin, 'ddd', 'compare', ...args], value);
        expect(invalid.code).toBe(2);
        expect(invalid.stderr).toBe('');
        expect(JSON.parse(invalid.stdout)).toMatchObject({
          operation: 'ddd-compare',
          status: 'rejected',
          diagnostics: [{ code }],
        });
      }
      const missingBaseline = await run([runtime, bin, 'ddd', 'compare'], compareInput);
      expect(missingBaseline.code).toBe(2);
      expect(missingBaseline.stdout).toBe('');
      expect(JSON.parse(missingBaseline.stderr).operation).toBe('invocation');
      const dddHelp = await run([runtime, bin, 'ddd', 'audit', '--help']);
      expect(dddHelp.code).toBe(0);
      expect(dddHelp.stderr).toBe('');
      expect(dddHelp.stdout).toContain('--rules');
      const dddIncompatible = await run([runtime, bin, 'ddd', 'audit', '-i', dddFile]);
      expect(dddIncompatible.code).toBe(1);
      expect(dddIncompatible.stderr).toBe('');
      expect(dddIncompatible.stdout.trim().split('\n')).toHaveLength(1);
      expect(JSON.parse(dddIncompatible.stdout)).toMatchObject({
        operation: 'ddd-audit',
        status: 'audited',
      });
      expect(JSON.parse(dddIncompatible.stdout).data).toEqual(dddExpected);
      const dddCompatible = await run(
        [runtime, bin, 'ddd', 'audit', '--rules', dddRulesFile],
        dddCustom,
      );
      expect(dddCompatible.code).toBe(0);
      expect(dddCompatible.stderr).toBe('');
      expect(JSON.parse(dddCompatible.stdout).data.summary).toEqual({
        edges: 1,
        typed: 1,
        unrelated: 0,
        blocked: 0,
      });
      const dddEmpty = await run([runtime, bin, 'ddd', 'audit'], empty);
      expect(dddEmpty.code).toBe(0);
      expect(dddEmpty.stderr).toBe('');
      for (const value of ['{bad', new Uint8Array([0xc3]), ' '.repeat(1048577)]) {
        const rejected = await run([runtime, bin, 'ddd', 'audit'], value);
        expect(rejected.code).toBe(2);
        expect(rejected.stderr).toBe('');
        expect(JSON.parse(rejected.stdout)).toMatchObject({
          operation: 'ddd-audit',
          status: 'rejected',
        });
      }
      const wrongFamily = await run([runtime, bin, 'ddd', 'audit', '--rules', customRules], empty);
      expect(wrongFamily.code).toBe(2);
      expect(wrongFamily.stderr).toBe('');
      expect(JSON.parse(wrongFamily.stdout).diagnostics[0].code).toBe('invalid-rules');
      const invalidDddFlag = await run([runtime, bin, 'ddd', 'audit', '--family', 'causal']);
      expect(invalidDddFlag.code).toBe(2);
      expect(invalidDddFlag.stdout).toBe('');
      expect(JSON.parse(invalidDddFlag.stderr)).toMatchObject({
        operation: 'invocation',
        status: 'rejected',
      });
      expect(await readFile(dddFile, 'utf8')).toBe(dddText);
      expect(await readFile(dddRulesFile, 'utf8')).toBe(dddRulesText);
      const patchArgs = [
        runtime,
        bin,
        'patch',
        'dry-run',
        '--source',
        patchSourceFile,
        '--session',
        patchLiteral.source.sessionId,
        '--revision',
        '7',
      ];
      const patchDryRun = await run(patchArgs, JSON.stringify(patchLiteral));
      expect(patchDryRun.code).toBe(0);
      expect(patchDryRun.stderr).toBe('');
      expect(JSON.parse(patchDryRun.stdout).data.graph.nodes[0].label).toBe('Order management');
      const patchStale = await run([...patchArgs.slice(0, -1), '8'], JSON.stringify(patchLiteral));
      expect(patchStale.code).toBe(1);
      expect(JSON.parse(patchStale.stdout).data.findings[0].code).toBe('source-changed');
      const patchInvalid = await run(patchArgs, new Uint8Array([0xc3]));
      expect(patchInvalid.code).toBe(2);
      expect(JSON.parse(patchInvalid.stdout).diagnostics[0].code).toBe('invalid-utf8');

      const packet = await run([
        runtime,
        bin,
        'review',
        'packet',
        '--baseline',
        'baseline',
        '-i',
        comparisonFile,
        '--loss-policy',
        'report',
      ]);
      expect(packet.code).toBe(0);
      expect(packet.stderr).toBe('');
      expect(JSON.parse(packet.stdout)).toMatchObject({
        operation: 'review-packet',
        status: 'created',
        data: { format: 'foldkit-zloz-review', comparison: { summary: { introduced: 1 } } },
      });
      const rawPacket = JSON.stringify(JSON.parse(packet.stdout).data);
      const reviewPacketFile = path.join(directory, 'portable-review.json');
      await writeFile(reviewPacketFile, rawPacket);
      const validated = await run([runtime, bin, 'review', 'validate', '-i', reviewPacketFile]);
      expect(validated.code).toBe(0);
      expect(validated.stderr).toBe('');
      expect(JSON.parse(validated.stdout)).toMatchObject({
        operation: 'review-validate',
        status: 'valid',
        summary: { audit: { status: 'regressed', summary: { introduced: 1 } } },
      });
      const inspected = await run([runtime, bin, 'review', 'inspect'], rawPacket);
      expect(inspected.code).toBe(0);
      expect(inspected.stderr).toBe('');
      expect(JSON.parse(inspected.stdout).data).toEqual(JSON.parse(rawPacket));
      expect(await readFile(reviewPacketFile, 'utf8')).toBe(rawPacket);
      const badPacket = JSON.parse(rawPacket);
      badPacket.projections.selected.source += ' forged';
      const refused = await run([runtime, bin, 'review', 'inspect'], JSON.stringify(badPacket));
      expect(refused.code).toBe(2);
      expect(refused.stderr).toBe('');
      expect(JSON.parse(refused.stdout)).toMatchObject({
        operation: 'review-inspect',
        status: 'rejected',
        diagnostics: [{ code: 'inconsistent-packet', path: '/projections/selected/source' }],
      });
      const badUtf8 = await run([runtime, bin, 'review', 'validate'], Uint8Array.of(0xc3));
      expect(badUtf8.code).toBe(2);
      expect(JSON.parse(badUtf8.stdout).diagnostics[0].code).toBe('invalid-utf8');
      const strictPacket = await run(
        [runtime, bin, 'review', 'packet', '--baseline', 'baseline'],
        comparisonText,
      );
      expect(strictPacket.code).toBe(1);
      expect(strictPacket.stderr).toBe('');
      expect(JSON.parse(strictPacket.stdout).status).toBe('rejected');
      const customPacket = await run(
        [
          runtime,
          bin,
          'review',
          'packet',
          '--baseline',
          'baseline',
          '--rules',
          customRules,
          '--loss-policy',
          'report',
        ],
        comparisonText,
      );
      expect(customPacket.code).toBe(0);
      expect(customPacket.stderr).toBe('');
      expect(JSON.parse(customPacket.stdout).data.conventions.source).toBe('custom');
      expect(JSON.parse(customPacket.stdout).data.comparison.summary.introduced).toBe(0);
      expect(JSON.stringify(JSON.parse(customPacket.stdout).data)).not.toContain(customRules);
      const missingPacket = await run(
        [runtime, bin, 'review', 'packet', '--baseline', 'absent', '--loss-policy', 'report'],
        comparisonText,
      );
      expect(missingPacket.code).toBe(2);
      expect(missingPacket.stderr).toBe('');
      expect(JSON.parse(missingPacket.stdout).diagnostics[0].code).toBe('unknown-baseline');
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
      `import { CliReviewInputRejected, CliAuditRegression, readDocument, readGraph, run, cliProtocol, type CliDocument, type CliResponse, type CliC4ReceiptInspection } from '@opsydyn/foldkit-zloz-cli';
const c4Authority:CliC4ReceiptInspection['authority']='read-only-evidence'; void c4Authority;
// @ts-expect-error Historical loss acceptance is never current Apply authority.
const c4Apply:CliC4ReceiptInspection['authority']='apply-authorized'; void c4Apply;
const c4Scope:Extract<CliResponse,{operation:'c4-receipt-inspect',status:'inspected'}>['scope']='recorded-conversion'; void c4Scope;
const dddDelta:Extract<CliResponse,{operation:'ddd-compare',status:'compared'}>['data']['summary']={introduced:0,resolved:0,persisting:0}; void dddDelta;
const dddReport:Extract<CliResponse,{status:'audited',operation:'ddd-audit'}>['data']['summary']={edges:0,typed:0,unrelated:0,blocked:0}; void dddReport;
// @ts-expect-error DDD response data never has an inference count.
const dddInference:Extract<CliResponse,{status:'audited',operation:'ddd-audit'}>['data']['summary']={edges:0,typed:0,unrelated:0,blocked:0,inferred:1}; void dddInference;
const packet:Extract<CliResponse,{status:'created'}>['data']['format']='foldkit-zloz-review'; void packet; void CliReviewInputRejected;
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

import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import elkManifest from '../../foldkit-flow-elk/package.json';
import coreManifest from '../package.json';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const options = { cwd: root, maxBuffer: 5 * 1024 * 1024 };

test('npm tarballs install without workspace links and expose runtime and TypeScript contracts', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'foldkit-flow-consumer-'));
  try {
    // The adapter builds its core dependency; pack core last to retain both archives.
    for (const name of ['foldkit-flow-elk', 'foldkit-flow'])
      await exec('bun', ['run', '--filter', `@opsydyn/${name}`, 'pack:check'], options);
    const core = path.join(
      root,
      `packages/foldkit-flow/dist/pack/opsydyn-foldkit-flow-${coreManifest.version}.tgz`,
    );
    const elk = path.join(
      root,
      `packages/foldkit-flow-elk/dist/pack/opsydyn-foldkit-flow-elk-${elkManifest.version}.tgz`,
    );
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    await exec('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', core], {
      ...options,
      cwd: directory,
    });
    for (const unwanted of ['foldkit', 'effect', 'elkjs', 'react'])
      expect(existsSync(path.join(directory, 'node_modules', unwanted))).toBe(false);
    const pure =
      "import { createEditor, serializeGraph, parseGraph } from '@opsydyn/foldkit-flow'; const s=createEditor({nodes:[],edges:[]}); console.log(JSON.stringify(parseGraph(serializeGraph(s.graph))));";
    for (const runtime of ['node', 'bun']) {
      const result = await exec(runtime, ['--input-type=module', '-e', pure], {
        ...options,
        cwd: directory,
      });
      expect(result.stdout.trim()).toBe('{"nodes":[],"edges":[]}');
    }
    await exec(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        core,
        elk,
        'foldkit@0.170.0',
        'effect@4.1.0',
        '@effect/platform-browser@4.1.0',
      ],
      { ...options, cwd: directory },
    );
    const source = `import { createEditor, updateEditor, layoutRequest, applyLayout, type FlowGraph, type EditorEvent } from '@opsydyn/foldkit-flow';
import { flowView, type FlowBackground } from '@opsydyn/foldkit-flow/foldkit';
import { createElkLayout } from '@opsydyn/foldkit-flow-elk';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
const graph: FlowGraph = {nodes:[{id:'a',label:'External',position:{x:0,y:0},size:{width:100,height:80},ports:[]}],edges:[]};
const groupState=createEditor({nodes:[{id:'g',kind:'group',label:'Group',position:{x:0,y:0},size:{width:400,height:200},ports:[]}],edges:[]});
const sized=updateEditor(groupState,{type:'GroupDimensionChanged',id:'g',dimension:'height',value:240});
if (sized.graph.nodes[0]?.size.height!==240) throw new Error('Missing packed dimension editing');
const state=createEditor(graph,{gridSpacing:32});
const request=layoutRequest(state,'consumer');
const layout=await createElkLayout()(request);
const arranged=applyLayout(state,request,layout);
const background:FlowBackground<EditorEvent>={type:'custom',render:(context,h)=>h.div([h.DataAttribute('packed-grid',context.id),h.DataAttribute('packed-spacing',String(context.spacing))],[String(context.spacing)])};
const result=await Effect.runPromise(renderToString({Flags:Schema.Struct({}),init:()=>({model:arranged}),view:(model,h:HtmlBuilder<EditorEvent>)=>({title:'Consumer',body:flowView(h,model,{id:'external',label:'External graph',background,resizeReadout:false,onEvent:event=>event})})},{flags:{},isHydratable:false}));
if (!result.html.includes('data-packed-grid="external"')) throw new Error('Missing packed custom grid');
if (!result.html.includes('data-packed-spacing="32"')) throw new Error('Missing packed grid spacing');
if (!result.html.includes('External graph')) throw new Error('Missing packed renderer output');
console.log('packed-consumer-ok');
`;
    const consumer = path.join(directory, 'consumer.ts');
    await writeFile(consumer, source);
    const tsc = path.join(root, 'packages/foldkit-flow/node_modules/.bin/tsc');
    for (const resolution of ['Bundler', 'NodeNext'])
      await exec(
        tsc,
        [
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--target',
          'ES2022',
          '--module',
          resolution === 'NodeNext' ? 'NodeNext' : 'ESNext',
          '--moduleResolution',
          resolution,
          consumer,
        ],
        { ...options, cwd: directory },
      );
    await exec(
      tsc,
      [
        '--skipLibCheck',
        '--target',
        'ES2022',
        '--module',
        'NodeNext',
        '--outDir',
        'compiled',
        consumer,
      ],
      { ...options, cwd: directory },
    );
    const output = await exec('node', [path.join(directory, 'compiled/consumer.js')], {
      ...options,
      cwd: directory,
      timeout: 15_000,
    });
    expect(output.stdout.trim()).toBe('packed-consumer-ok');
    const files = await exec('tar', ['-tzf', core], options);
    expect(files.stdout).toContain('package/LICENSE');
    expect(files.stdout).toContain('package/README.md');
    expect(files.stdout).not.toMatch(/package\/(src|test|node_modules|dist\/pack)\//);
    for (const name of ['foldkit-flow', 'foldkit-flow-elk']) {
      const manifest = await readFile(
        path.join(directory, 'node_modules/@opsydyn', name, 'package.json'),
        'utf8',
      );
      expect(manifest).not.toMatch(/workspace:|catalog:/);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 180_000);

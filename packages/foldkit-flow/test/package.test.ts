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
    const source = `import { createEditor, updateEditor, layoutRequest, applyLayout, portAnchor, portPosition, portBoundaryPosition, resolveConnectionPreview, type FlowConnectionGeometryPolicy, resolveEdgeGeometry, type FlowEdgeGeometryPolicy, type FlowEdge, type FlowGraph, type EditorEvent } from '@opsydyn/foldkit-flow';
import { flowView, flowNodeFrame, flowGroupFrame, flowDragHandle, flowPort, flowResizeHandle, flowEdgeHitTarget, resolveFlowDiagnostics, type FlowViewOptions, type FlowBackground, type FlowDiagnostics } from '@opsydyn/foldkit-flow/foldkit';
import { createElkLayout } from '@opsydyn/foldkit-flow-elk';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
const externalEdge:FlowEdge={id:'external-edge',source:{node:'a',port:'out'},target:{node:'b',port:'in'},label:'External relation'};
const graph: FlowGraph = {nodes:[{id:'a',label:'External',position:{x:0,y:0},size:{width:100,height:80},ports:[{id:'out',kind:'output',side:'right',anchor:{x:0.75,y:0.25}}]},{id:'b',label:'Target',position:{x:300,y:0},size:{width:100,height:80},ports:[{id:'in',kind:'input',side:'left',anchor:{x:0.25,y:0.75}}]}],edges:[externalEdge]};
const first=graph.nodes[0],firstPort=first?.ports[0];
if (!first || !firstPort || portAnchor(firstPort).x!==0.75 || portPosition(first,firstPort.id).x!==75 || portBoundaryPosition(first,firstPort.id).x!==100) throw new Error('Missing packed anchor geometry');
const movedPorts=updateEditor(createEditor(graph),{type:'PortPositionsChanged',positions:[{endpoint:{node:'a',port:'out'},position:{side:'right',anchor:{x:0.6,y:0.4}}}]});
if (movedPorts.graph.nodes[0]?.ports[0]?.anchor?.x!==0.6 || movedPorts.past.length!==1) throw new Error('Missing packed anchor editing');
const groupState=createEditor({nodes:[{id:'g',kind:'group',label:'Group',position:{x:0,y:0},size:{width:400,height:200},ports:[]}],edges:[]});
const sized=updateEditor(groupState,{type:'GroupDimensionChanged',id:'g',dimension:'height',value:240});
if (sized.graph.nodes[0]?.size.height!==240) throw new Error('Missing packed dimension editing');
const quiet:FlowDiagnostics=resolveFlowDiagnostics({minimalMode:true,diagnostics:{measurements:true}});
if (Object.values(quiet).some(Boolean)) throw new Error('Minimal mode did not override diagnostics');
const state=createEditor(graph,{gridSpacing:32});
const request=layoutRequest(state,'consumer');
const layout=await createElkLayout()(request);
const arranged=applyLayout(state,request,layout);
const policy:FlowEdgeGeometryPolicy=({source,target})=>({path:'M'+source.x+','+source.y+' L'+target.x+','+target.y,labelPosition:{x:(source.x+target.x)/2,y:(source.y+target.y)/2}});
const geometry=resolveEdgeGeometry(arranged.graph,externalEdge,{policy});
const previewPolicy:FlowConnectionGeometryPolicy=({source,target})=>({path:'M'+source.x+','+source.y+' L'+target.x+','+target.y,labelPosition:undefined});
const dragging=updateEditor(arranged,{type:'ConnectionDragStarted',endpoint:{node:'a',port:'out'},pointer:1,point:{x:100,y:80}});
const preview=resolveConnectionPreview(dragging,previewPolicy);
if (!preview || preview.feedback.type!=='free') throw new Error('Missing packed connection preview resolver');
const previewOptions:FlowViewOptions<EditorEvent>={id:'external-preview',label:'External preview',onEvent:event=>event,connectionGeometry:previewPolicy,renderConnection:(context,builder)=>builder.path([builder.D(context.path),builder.Stroke(context.stroke),builder.DataAttribute('packed-preview','')],[])};
const background:FlowBackground<EditorEvent>={type:'custom',render:(context,h)=>h.div([h.DataAttribute('packed-grid',context.id),h.DataAttribute('packed-spacing',String(context.spacing))],[String(context.spacing)])};
const result=await Effect.runPromise(renderToString({Flags:Schema.Struct({}),init:()=>({model:arranged}),view:(model,h:HtmlBuilder<EditorEvent>)=>({title:'Consumer',body:h.div([],[flowView(h,dragging,previewOptions),h.svg([], [flowEdgeHitTarget(h,{edge:externalEdge,path:geometry.path})]),flowView(h,model,{id:'external',label:'External graph',connectionGeometry:previewPolicy,renderConnection:(context,builder)=>builder.path([builder.D(context.path),builder.Stroke(context.stroke)],[]),edgeGeometry:policy,background,minimalMode:true,diagnostics:{status:true},resizeReadout:false,onEvent:event=>event,renderGroupShell:(context,builder)=>flowGroupFrame(builder,context,[],[flowDragHandle(builder,context,[],[context.node.label])]),renderNodeShell:(context,builder)=>flowNodeFrame(builder,context,[builder.Class('packed-shell')],[flowDragHandle(builder,context,[],[context.node.label]),...context.node.ports.map(port=>flowPort(builder,context,port,[],['→'])),flowResizeHandle(builder,context,'right',[],['Resize'])])})])})},{flags:{},isHydratable:false}));
if (!result.html.includes('data-packed-grid="external"')) throw new Error('Missing packed custom grid');
if (!result.html.includes('data-packed-spacing="32"')) throw new Error('Missing packed grid spacing');
if (!result.html.includes('External graph')) throw new Error('Missing packed renderer output');
if (!result.html.includes('packed-shell') || !result.html.includes('Connect from External: out')) throw new Error('Missing packed composition');
if (!result.html.includes(geometry.path)) throw new Error('Missing packed shared edge geometry');
if (!result.html.includes('data-packed-preview')) throw new Error('Missing packed preview renderer');
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

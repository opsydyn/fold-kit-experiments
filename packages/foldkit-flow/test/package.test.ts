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
import { flowView, type FlowSelectionMarqueeContext, type FlowAlignmentGuideContext, type FlowResizeReadoutContext, flowConnectionButton, flowContextTrigger, type FlowConnectionsContext, flowContextAction, flowContextDimensionInput, type FlowContextMenuContext, flowEdgeToolbarButton, flowEdgePathStyleSelect, type FlowEdgeToolbarContext, flowEdgeLabelBadge, flowEdgeLabelForm, flowEdgeLabelInput, flowEdgeLabelCancel, flowViewportControl, flowMinimap, flowMinimapViewport, type FlowMinimapContext, type FlowViewportControlsContext, flowNodeFrame, flowGroupFrame, flowDragHandle, flowPort, flowResizeHandle, flowEdgeHitTarget, resolveFlowDiagnostics, type FlowViewOptions, type FlowBackground, type FlowDiagnostics } from '@opsydyn/foldkit-flow/foldkit';
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
const measured=updateEditor(arranged,{type:'SurfaceMeasured',size:{width:800,height:440}});
const navigationOptions:FlowViewOptions<EditorEvent>={id:'packed-navigation',label:'Packed navigation',onEvent:event=>event,viewportControls:true,minimap:true,renderViewportControls:(context:FlowViewportControlsContext,builder)=>flowViewportControl(builder,context.actions.fitView,event=>event,[],['Packed fit']),renderMinimap:(context:FlowMinimapContext,builder)=>flowMinimap(builder,context,event=>event,[],[flowMinimapViewport(builder,context.geometry,[builder.Stroke('orange')])])};
const editing=updateEditor(arranged,{type:'EdgeLabelEditingStarted',id:externalEdge.id});
const labelOptions:FlowViewOptions<EditorEvent>={
  id:'packed-label',label:'Packed labels',onEvent:event=>event,edgeGeometry:policy,
  renderEdgeLabel:(context,h)=>flowEdgeLabelBadge(h,context,event=>event,[h.Class('packed-badge')],[context.edge.label ?? 'Add label']),
  renderEdgeLabelEditor:(context,h)=>flowEdgeLabelForm(h,context,event=>event,[h.Class('packed-label-editor')],[
    flowEdgeLabelInput(h,context,event=>event,[]),
    h.button([h.Type('submit')],['Apply']),
    flowEdgeLabelCancel(h,context,event=>event,[],['Discard']),
  ]),
};
const selected=updateEditor(arranged,{type:'EdgeSelected',id:externalEdge.id,additive:false});
const toolbarOptions:FlowViewOptions<EditorEvent>={
  id:'packed-toolbar',label:'Packed toolbar',onEvent:event=>event,edgeGeometry:policy,edgeToolbar:true,
  renderEdgeToolbar:(context:FlowEdgeToolbarContext,h)=>h.div([h.Class('packed-toolbar')],[
    flowEdgePathStyleSelect(h,context,event=>event,[]),
    flowEdgeToolbarButton(h,context.actions.deleteEdge,event=>event,[],['Delete edge']),
  ]),
};
const groupContext=updateEditor(groupState,{type:'ContextOpened',context:{kind:'node',id:'g',point:{x:12,y:12}}});
const edgeContext=updateEditor(arranged,{type:'ContextOpened',context:{kind:'edge',id:externalEdge.id,point:{x:12,y:12}}});
const contextOptions:FlowViewOptions<EditorEvent>={
  id:'packed-context',label:'Packed context',onEvent:event=>event,contextActions:true,
  renderContextMenu:(context:FlowContextMenuContext,h)=>h.div([h.Class('packed-context')],[
    ...(context.kind==='node' && context.group ? [flowContextDimensionInput(h,context.group,'width',event=>event,[])] : []),
    flowContextAction(h,context.kind==='edge'?context.rename:context.close,event=>event,[],['Packed action']),
  ]),
};
const listOptions:FlowViewOptions<EditorEvent>={
  ...toolbarOptions,id:'packed-list',label:'Packed connections',contextActions:true,
  renderConnections:(context:FlowConnectionsContext,h)=>h.ul([h.Class(context.readOnly?'packed-readonly-list':'packed-list')],context.entries.map(entry=>h.li([],[
    flowConnectionButton(h,entry,event=>event,[],[entry.label]),
    ...(entry.contextAction?[flowContextTrigger(h,entry.contextAction,event=>event,[],['Packed more'])]:[]),
  ]))),
};
const quietList=updateEditor({...selected,readOnly:true},{type:'ConnectionListToggled'});
const selectedGroup=updateEditor(groupState,{type:'NodeSelected',id:'g',additive:false});
const readoutOptions:FlowViewOptions<EditorEvent>={
  id:'packed-readout',label:'Packed readout',onEvent:event=>event,resizeHandles:true,
  renderResizeReadout:(context:FlowResizeReadoutContext,h)=>h.div([h.Class('packed-readout')],[context.widthText+' by '+context.heightText]),
};
const guideStart=updateEditor(createEditor({nodes:[...groupState.graph.nodes,{id:'neighbor',label:'Neighbor',position:{x:503,y:80},size:{width:100,height:80},ports:[]}],edges:[]},{snapToAlignment:true}),{type:'NodeResizeStarted',id:'g',handle:'right',pointer:1,point:{x:0,y:0}});
const guideState=updateEditor(guideStart,{type:'PointerMoved',pointer:1,point:{x:101,y:0}});
const guideOptions:FlowViewOptions<EditorEvent>={
  id:'packed-guide',label:'Packed guide',onEvent:event=>event,
  renderAlignmentGuide:(context:FlowAlignmentGuideContext,h)=>h.line([h.Class('packed-guide'),h.DataAttribute('packed-start-x',String(context.start.x)),h.X1(String(context.start.x)),h.Y1(String(context.start.y)),h.X2(String(context.end.x)),h.Y2(String(context.end.y))],[]),
};
const marqueeStart=updateEditor({...measured,viewport:{x:20,y:30,zoom:2}},{type:'BoxSelectionStarted',pointer:2,point:{x:320,y:350}});
const marqueeState=updateEditor(marqueeStart,{type:'PointerMoved',pointer:2,point:{x:60,y:70}});
const marqueeOptions:FlowViewOptions<EditorEvent>={
  id:'packed-marquee',label:'Packed marquee',onEvent:event=>event,minimalMode:true,
  renderSelectionMarquee:({bounds,viewport}:FlowSelectionMarqueeContext,h)=>h.div([h.DataAttribute('packed-marquee',bounds.left+','+bounds.top+','+bounds.right+','+bounds.bottom+'@'+viewport.zoom)],[]),
};
const result=await Effect.runPromise(renderToString({Flags:Schema.Struct({}),init:()=>({model:arranged}),view:(model,h:HtmlBuilder<EditorEvent>)=>({title:'Consumer',body:h.div([],[flowView(h,marqueeState,marqueeOptions),flowView(h,guideState,guideOptions),flowView(h,selectedGroup,readoutOptions),flowView(h,selected,listOptions),flowView(h,quietList,{...listOptions,id:'packed-readonly-list',minimalMode:true}),flowView(h,groupContext,contextOptions),flowView(h,edgeContext,{...contextOptions,id:'packed-edge-context'}),flowView(h,selected,toolbarOptions),flowView(h,selected,{...toolbarOptions,id:'hidden-toolbar',renderEdgeToolbar:()=>null}),flowView(h,{...arranged,readOnly:true},labelOptions),flowView(h,editing,{...labelOptions,id:'packed-label-editing'}),flowView(h,measured,navigationOptions),flowView(h,dragging,previewOptions),h.svg([], [flowEdgeHitTarget(h,{edge:externalEdge,path:geometry.path})]),flowView(h,model,{id:'external',label:'External graph',connectionGeometry:previewPolicy,renderConnection:(context,builder)=>builder.path([builder.D(context.path),builder.Stroke(context.stroke)],[]),edgeGeometry:policy,background,minimalMode:true,diagnostics:{status:true},resizeReadout:false,onEvent:event=>event,renderGroupShell:(context,builder)=>flowGroupFrame(builder,context,[],[flowDragHandle(builder,context,[],[context.node.label])]),renderNodeShell:(context,builder)=>flowNodeFrame(builder,context,[builder.Class('packed-shell')],[flowDragHandle(builder,context,[],[context.node.label]),...context.node.ports.map(port=>flowPort(builder,context,port,[],['→'])),flowResizeHandle(builder,context,'right',[],['Resize'])])})])})},{flags:{},isHydratable:false}));
if (!result.html.includes('data-packed-marquee="20,20,150,160@2"') || !result.html.includes('data-flow-selection-box')) throw new Error('Missing packed selection marquee');
if (!result.html.includes('data-packed-start-x="503"') || !result.html.includes('data-flow-alignment-guide="x"')) throw new Error('Missing packed guide composition');
if (!result.html.includes('class="packed-readout"') || !result.html.includes('400 by 200') || !result.html.includes('Group dimensions in graph units')) throw new Error('Missing packed resize readout composition');
if (!result.html.includes('class="packed-list"') || !result.html.includes('aria-controls="packed-list-edge-actions"') || !result.html.includes('Packed more')) throw new Error('Missing packed connection row composition');
if (!result.html.includes('class="packed-readonly-list"') || !result.html.includes('aria-controls="packed-readonly-list-connections"') || result.html.includes('id="packed-readonly-list-edge-actions"')) throw new Error('Missing packed read-only connection disclosure');
if (!result.html.includes('class="packed-context"') || !result.html.includes('Width of Group') || !result.html.includes('Edge context actions') || !result.html.includes('Packed action')) throw new Error('Missing packed context menu composition');
if (!result.html.includes('class="packed-toolbar"') || !result.html.includes('Selected edge path style') || !result.html.includes('aria-controls="packed-toolbar-edge-actions"')) throw new Error('Missing packed toolbar composition');
if (result.html.includes('id="hidden-toolbar-edge-actions"') || result.html.includes('aria-controls="hidden-toolbar-edge-actions"')) throw new Error('Hidden toolbar exposed dangling controls');
if (!result.html.includes('<div class="packed-badge"') || !result.html.includes('packed-label-editor') || !result.html.includes('Edge label for a:out')) throw new Error('Missing packed edge label composition');
if (!result.html.includes('Packed fit') || !result.html.includes('data-flow-minimap-viewport')) throw new Error('Missing packed navigation primitives');
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

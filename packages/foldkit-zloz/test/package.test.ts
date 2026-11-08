import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import elkManifest from '../../foldkit-zloz-elk/package.json';
import coreManifest from '../package.json';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const options = { cwd: root, maxBuffer: 5 * 1024 * 1024 };

test('npm tarballs install without workspace links and expose runtime and TypeScript contracts', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'foldkit-zloz-consumer-'));
  try {
    // The adapter builds its core dependency; pack core last to retain both archives.
    for (const name of ['foldkit-zloz-elk', 'foldkit-zloz'])
      await exec('bun', ['run', '--filter', `@opsydyn/${name}`, 'pack:check'], options);
    const core = path.join(
      root,
      `packages/foldkit-zloz/dist/pack/opsydyn-foldkit-zloz-${coreManifest.version}.tgz`,
    );
    const elk = path.join(
      root,
      `packages/foldkit-zloz-elk/dist/pack/opsydyn-foldkit-zloz-elk-${elkManifest.version}.tgz`,
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
      "import { createEditor, serializeGraph, parseGraph } from '@opsydyn/foldkit-zloz'; const s=createEditor({nodes:[],edges:[]}); console.log(JSON.stringify(parseGraph(serializeGraph(s.graph))));";
    for (const runtime of ['node', 'bun']) {
      const result = await exec(runtime, ['--input-type=module', '-e', pure], {
        ...options,
        cwd: directory,
      });
      expect(result.stdout.trim()).toBe('{"nodes":[],"edges":[]}');
    }
    const architectureSource = `import { createArchitectureNode, createEditor, updateEditor, nodeShapeGeometry, portPosition, type ZlozNodeArchitecture } from '@opsydyn/foldkit-zloz';
const architecture:ZlozNodeArchitecture={family:'c4',role:'container',technology:'PostgreSQL'};
// @ts-expect-error C4 and DDD roles cannot be mixed
const invalid:ZlozNodeArchitecture={family:'c4',role:'entity'};
// @ts-expect-error Person has no container technology
const invalidTechnology:ZlozNodeArchitecture={family:'c4',role:'person',technology:'SQL'};
const node=createArchitectureNode({id:'orders',label:'Orders',position:{x:0,y:0},size:{width:200,height:100},ports:[{id:'out',kind:'output',side:'top',offset:0}],architecture,appearance:{shape:'cylinder'},data:{host:true}});
const initial=createEditor({nodes:[node],edges:[]});
const edited=updateEditor(initial,{type:'NodeArchitectureChanged',id:node.id,architecture:{family:'ddd',role:'repository'}});
if(portPosition(node,'out').y!==16) throw new Error('Missing shaped anchor');
if(nodeShapeGeometry(node).shape!=='cylinder') throw new Error('Missing shape geometry');
if(updateEditor(edited,{type:'UndoPressed'}).graph.nodes[0]?.architecture?.family!=='c4') throw new Error('Missing architecture Undo');
console.log('headless-architecture-ok');
`;
    const architectureConsumer = path.join(directory, 'architecture.mts');
    await writeFile(architectureConsumer, architectureSource);
    const rootTsc = path.join(root, 'packages/foldkit-zloz/node_modules/.bin/tsc');
    for (const resolution of ['Bundler', 'NodeNext'])
      await exec(
        rootTsc,
        [
          '--noEmit',
          '--strict',
          '--exactOptionalPropertyTypes',
          '--skipLibCheck',
          '--target',
          'ES2022',
          '--module',
          resolution === 'NodeNext' ? 'NodeNext' : 'ESNext',
          '--moduleResolution',
          resolution,
          architectureConsumer,
        ],
        { ...options, cwd: directory },
      );
    await exec(
      rootTsc,
      [
        '--strict',
        '--exactOptionalPropertyTypes',
        '--skipLibCheck',
        '--target',
        'ES2022',
        '--module',
        'NodeNext',
        '--outDir',
        'pure-compiled',
        architectureConsumer,
      ],
      { ...options, cwd: directory },
    );
    for (const runtime of ['node', 'bun']) {
      const result = await exec(runtime, ['pure-compiled/architecture.mjs'], {
        ...options,
        cwd: directory,
      });
      expect(result.stdout.trim()).toBe('headless-architecture-ok');
    }
    for (const unwanted of ['foldkit', 'effect', 'elkjs', 'react'])
      expect(existsSync(path.join(directory, 'node_modules', unwanted))).toBe(false);
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
    const source = `import { createArchitectureNode, createEditor, updateEditor, resolveEndpointChoices, resolveConnectionCreation, resolveEdgeReconnection, resolveDeletion, type BoxSelectionMatch, type EditorPolicy, layoutRequest, applyLayout, portAnchor, portPosition, portBoundaryPosition, resolveConnectionPreview, type ZlozConnectionGeometryPolicy, resolveEdgeGeometry, type ZlozEdgeGeometryPolicy, type ZlozEdge, type ZlozGraph, type ZlozNode, type EditorEvent } from '@opsydyn/foldkit-zloz';
import { zlozC4Node, zlozC4Group, type ZlozC4NodeOptions, createZlozNodeBodyCache, type ZlozNodeBodyCache, zlozEndpointSearchInput, zlozEndpointSearchClear, zlozEndpointSearchFeedback, zlozConnectionCreation, zlozConnectionCreationField, zlozConnectionCreationSelect, zlozConnectionCreationReasons, zlozConnectionCreationCancel, zlozEdgeEndpointField, zlozEdgeEndpointSelect, zlozEdgeEndpointReasons, zlozView, type ZlozWheelNavigation, type ZlozCanvasHelpContext, type ZlozCanvasStatusContext, type ZlozSelectionMarqueeContext, type ZlozAlignmentGuideContext, type ZlozResizeReadoutContext, zlozConnectionButton, zlozContextTrigger, type ZlozConnectionsContext, zlozContextAction, zlozContextDimensionInput, type ZlozContextMenuContext, zlozEdgeToolbarButton, zlozEdgePathStyleSelect, type ZlozEdgeToolbarContext, zlozEdgeLabelBadge, zlozEdgeLabelForm, zlozEdgeLabelInput, zlozEdgeLabelCancel, zlozViewportControl, zlozMinimap, zlozMinimapViewport, type ZlozMinimapContext, type ZlozViewportControlsContext, zlozNodeFrame, zlozGroupFrame, zlozDragHandle, zlozPort, zlozResizeHandle, zlozEdgeHitTarget, resolveZlozDiagnostics, type ZlozViewOptions, type ZlozViewLayoutParts, type ZlozBackground, type ZlozDiagnostics } from '@opsydyn/foldkit-zloz/foldkit';
import { createElkLayout } from '@opsydyn/foldkit-zloz-elk';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
const externalEdge:ZlozEdge={id:'external-edge',source:{node:'a',port:'out'},target:{node:'b',port:'in'},label:'External relation'};
const graph: ZlozGraph = {nodes:[{id:'a',label:'External',position:{x:0,y:0},size:{width:100,height:80},ports:[{id:'out',kind:'output',side:'right',anchor:{x:0.75,y:0.25}}]},{id:'b',label:'Target',position:{x:300,y:0},size:{width:100,height:80},ports:[{id:'in',kind:'input',side:'left',anchor:{x:0.25,y:0.75}}]}],edges:[externalEdge]};
const first=graph.nodes[0],firstPort=first?.ports[0];
if (!first || !firstPort || portAnchor(firstPort).x!==0.75 || portPosition(first,firstPort.id).x!==75 || portBoundaryPosition(first,firstPort.id).x!==100) throw new Error('Missing packed anchor geometry');
const movedPorts=updateEditor(createEditor(graph),{type:'PortPositionsChanged',positions:[{endpoint:{node:'a',port:'out'},position:{side:'right',anchor:{x:0.6,y:0.4}}}]});
if (movedPorts.graph.nodes[0]?.ports[0]?.anchor?.x!==0.6 || movedPorts.past.length!==1) throw new Error('Missing packed anchor editing');
const groupState=createEditor({nodes:[{id:'g',kind:'group',label:'Group',position:{x:0,y:0},size:{width:400,height:200},ports:[]}],edges:[]});
const sized=updateEditor(groupState,{type:'GroupDimensionChanged',id:'g',dimension:'height',value:240});
if (sized.graph.nodes[0]?.size.height!==240) throw new Error('Missing packed dimension editing');
const quiet:ZlozDiagnostics=resolveZlozDiagnostics({minimalMode:true,diagnostics:{measurements:true}});
if (Object.values(quiet).some(Boolean)) throw new Error('Minimal mode did not override diagnostics');
const state=createEditor(graph,{gridSpacing:32});
const request=layoutRequest(state,'consumer');
const layout=await createElkLayout()(request);
const arranged=applyLayout(state,request,layout);
const policy:ZlozEdgeGeometryPolicy=({source,target})=>({path:'M'+source.x+','+source.y+' L'+target.x+','+target.y,labelPosition:{x:(source.x+target.x)/2,y:(source.y+target.y)/2}});
const geometry=resolveEdgeGeometry(arranged.graph,externalEdge,{policy});
const previewPolicy:ZlozConnectionGeometryPolicy=({source,target})=>({path:'M'+source.x+','+source.y+' L'+target.x+','+target.y,labelPosition:undefined});
const dragging=updateEditor(arranged,{type:'ConnectionDragStarted',endpoint:{node:'a',port:'out'},pointer:1,point:{x:100,y:80}});
const preview=resolveConnectionPreview(dragging,previewPolicy);
if (!preview || preview.feedback.type!=='free') throw new Error('Missing packed connection preview resolver');
const previewOptions:ZlozViewOptions<EditorEvent>={id:'external-preview',label:'External preview',onEvent:event=>event,connectionGeometry:previewPolicy,renderConnection:(context,builder)=>builder.path([builder.D(context.path),builder.Stroke(context.stroke),builder.DataAttribute('packed-preview','')],[])};
const background:ZlozBackground<EditorEvent>={type:'custom',render:(context,h)=>h.div([h.DataAttribute('packed-grid',context.id),h.DataAttribute('packed-spacing',String(context.spacing))],[String(context.spacing)])};
const measured=updateEditor(arranged,{type:'SurfaceMeasured',size:{width:800,height:440}});
const packedShellBodyCache=createZlozNodeBodyCache();
const packedShellArtwork=(builder:HtmlBuilder<EditorEvent>,node:ZlozNode)=>builder.span([builder.DataAttribute('packed-custom-body',node.id)],[node.label]);
const packedBodyCache:ZlozNodeBodyCache=createZlozNodeBodyCache();
const layoutOptions:ZlozViewOptions<EditorEvent>={id:'packed-layout',label:'Packed layout canvas',onEvent:event=>event,height:'fill',viewportControls:true,minimap:true,renderLayout:(parts:ZlozViewLayoutParts,h)=>h.div([],[h.aside([h.Id('packed-layout-sidebar')],[parts.help,...(parts.controls?[parts.controls]:[]),...(parts.minimap?[parts.minimap]:[]),parts.connections,parts.status]),h.main([],[parts.canvas])])};
const navigationOptions:ZlozViewOptions<EditorEvent>={nodeBodyCache:packedBodyCache,canConnectPort:()=>null,id:'packed-navigation',label:'Packed navigation',onEvent:event=>event,viewportControls:true,minimap:true,renderViewportControls:(context:ZlozViewportControlsContext,builder)=>zlozViewportControl(builder,context.actions.fitView,event=>event,[],['Packed fit']),renderMinimap:(context:ZlozMinimapContext,builder)=>zlozMinimap(builder,context,event=>event,[],[zlozMinimapViewport(builder,context.geometry,[builder.Stroke('orange')])])};
const editing=updateEditor(arranged,{type:'EdgeLabelEditingStarted',id:externalEdge.id});
const labelOptions:ZlozViewOptions<EditorEvent>={
  id:'packed-label',label:'Packed labels',onEvent:event=>event,edgeGeometry:policy,
  renderEdgeLabel:(context,h)=>zlozEdgeLabelBadge(h,context,event=>event,[h.Class('packed-badge')],[context.edge.label ?? 'Add label']),
  renderEdgeLabelEditor:(context,h)=>zlozEdgeLabelForm(h,context,event=>event,[h.Class('packed-label-editor')],[
    zlozEdgeLabelInput(h,context,event=>event,[]),
    h.button([h.Type('submit')],['Apply']),
    zlozEdgeLabelCancel(h,context,event=>event,[],['Discard']),
  ]),
};
const creationContext=resolveConnectionCreation(arranged);
const searchChoices=resolveEndpointChoices(creationContext.target.entries,{query:'missing-port'});
if (searchChoices.matchCount!==0 || searchChoices.entries.length!==0) throw new Error('Packed search did not filter');
const endpointContext=resolveEdgeReconnection(arranged,externalEdge.id,'target');
if (!endpointContext) throw new Error('Missing packed endpoint context');
const selected=updateEditor(arranged,{type:'EdgeSelected',id:externalEdge.id,additive:false});
const toolbarOptions:ZlozViewOptions<EditorEvent>={
  id:'packed-toolbar',label:'Packed toolbar',onEvent:event=>event,edgeGeometry:policy,edgeToolbar:true,edgeReconnection:true,connectionCreation:true,
  renderConnectionCreation:(context,h)=>h.div([h.Role('group'),h.AriaLabel('Packed creation')],[
    zlozConnectionCreation(h,context,event=>event,{idPrefix:'packed-create'}),
    zlozConnectionCreationField(h,context.source,event=>event,{idPrefix:'packed-create-field'}),
    zlozConnectionCreationSelect(h,creationContext.target,event=>event,[],{idPrefix:'packed-create-select',groupByNode:true,groupLabel:group=>group.label+' ['+group.id+']'}),
    zlozConnectionCreationReasons(h,creationContext.target,[],{idPrefix:'packed-create-select',groupByNode:true,groupLabel:group=>group.label+' ['+group.id+']'}),
    zlozConnectionCreationCancel(h,context,event=>event),
  ]),
  renderEdgeToolbar:(context:ZlozEdgeToolbarContext,h)=>h.div([h.Class('packed-toolbar')],[
    zlozEdgeEndpointField(h,endpointContext,event=>event,{idPrefix:'packed-endpoint'}),
    zlozEdgeEndpointSelect(h,endpointContext,event=>event,[],{idPrefix:'packed-select'}),
    zlozEdgeEndpointReasons(h,endpointContext,[],{idPrefix:'packed-select'}),
    zlozEdgePathStyleSelect(h,context,event=>event,[]),
    zlozEdgeToolbarButton(h,context.actions.deleteEdge,event=>event,[],['Delete edge']),
  ]),
};
const groupContext=updateEditor(groupState,{type:'ContextOpened',context:{kind:'node',id:'g',point:{x:12,y:12}}});
const edgeContext=updateEditor(arranged,{type:'ContextOpened',context:{kind:'edge',id:externalEdge.id,point:{x:12,y:12}}});
const contextOptions:ZlozViewOptions<EditorEvent>={
  id:'packed-context',label:'Packed context',onEvent:event=>event,contextActions:true,
  renderContextMenu:(context:ZlozContextMenuContext,h)=>h.div([h.Class('packed-context')],[
    ...(context.kind==='node' && context.group ? [zlozContextDimensionInput(h,context.group,'width',event=>event,[])] : []),
    zlozContextAction(h,context.kind==='edge'?context.rename:context.close,event=>event,[],['Packed action']),
  ]),
};
const listOptions:ZlozViewOptions<EditorEvent>={
  ...toolbarOptions,id:'packed-list',label:'Packed connections',contextActions:true,
  renderConnections:(context:ZlozConnectionsContext,h)=>h.ul([h.Class(context.readOnly?'packed-readonly-list':'packed-list')],context.entries.map(entry=>h.li([],[
    zlozConnectionButton(h,entry,event=>event,[],[entry.label]),
    ...(entry.contextAction?[zlozContextTrigger(h,entry.contextAction,event=>event,[],['Packed more'])]:[]),
  ]))),
};
const quietList=updateEditor({...selected,readOnly:true},{type:'ConnectionListToggled'});
const selectedGroup=updateEditor(groupState,{type:'NodeSelected',id:'g',additive:false});
const readoutOptions:ZlozViewOptions<EditorEvent>={
  id:'packed-readout',label:'Packed readout',onEvent:event=>event,resizeHandles:true,
  renderResizeReadout:(context:ZlozResizeReadoutContext,h)=>h.div([h.Class('packed-readout')],[context.widthText+' by '+context.heightText]),
};
const guideStart=updateEditor(createEditor({nodes:[...groupState.graph.nodes,{id:'neighbor',label:'Neighbor',position:{x:503,y:80},size:{width:100,height:80},ports:[]}],edges:[]},{snapToAlignment:true}),{type:'NodeResizeStarted',id:'g',handle:'right',pointer:1,point:{x:0,y:0}});
const guideState=updateEditor(guideStart,{type:'PointerMoved',pointer:1,point:{x:101,y:0}});
const guideOptions:ZlozViewOptions<EditorEvent>={
  id:'packed-guide',label:'Packed guide',onEvent:event=>event,
  renderAlignmentGuide:(context:ZlozAlignmentGuideContext,h)=>h.line([h.Class('packed-guide'),h.DataAttribute('packed-start-x',String(context.start.x)),h.X1(String(context.start.x)),h.Y1(String(context.start.y)),h.X2(String(context.end.x)),h.Y2(String(context.end.y))],[]),
};
const marqueeMatch:BoxSelectionMatch='partial';
const marqueeReady=createEditor(graph,{boxSelectionMatch:marqueeMatch});
const marqueeStart=updateEditor({...marqueeReady,viewport:{x:20,y:30,zoom:2}},{type:'BoxSelectionStarted',pointer:2,point:{x:320,y:350}});
const marqueeState=updateEditor(marqueeStart,{type:'PointerMoved',pointer:2,point:{x:60,y:70}});
const marqueeOptions:ZlozViewOptions<EditorEvent>={
  id:'packed-marquee',label:'Packed marquee',onEvent:event=>event,minimalMode:true,
  renderSelectionMarquee:({bounds,viewport,match,previewNodeIds}:ZlozSelectionMarqueeContext,h)=>h.div([h.DataAttribute('packed-preview-nodes',previewNodeIds.join(',')),h.DataAttribute('packed-match',match),h.DataAttribute('packed-marquee',bounds.left+','+bounds.top+','+bounds.right+','+bounds.bottom+'@'+viewport.zoom)],[]),
};
const copyOptions:ZlozViewOptions<EditorEvent>={
  id:'packed-copy',label:'Packed copy',onEvent:event=>event,minimalMode:true,
  renderCanvasHelp:(context:ZlozCanvasHelpContext,h)=>h.div([h.DataAttribute('packed-help',String(context.visible))],[context.defaultText]),
  renderCanvasStatus:(context:ZlozCanvasStatusContext,h)=>h.span([h.DataAttribute('packed-status',String(context.visible))],[context.defaultText]),
};
const deletionPolicy:EditorPolicy={canDelete:candidate=>candidate.edges.some(edge=>edge.id===externalEdge.id)?'Packed required link':null};
const deletion=resolveDeletion(arranged.graph,{nodeIds:['a'],edgeIds:[]},deletionPolicy.canDelete);
const denied=updateEditor(selected,{type:'EdgeDeleted',id:externalEdge.id},deletionPolicy);
if (deletion.type!=='blocked' || denied.graph!==selected.graph || denied.notice!=='Packed required link') throw new Error('Missing packed deletion policy');
const wheelNavigation:ZlozWheelNavigation='pan';
const ConsumerSearchMessage=defineMessageUnion({ChangedQuery:{query:Schema.String}});
type ConsumerSearchMessage=typeof ConsumerSearchMessage.Type;
const searchResult=await Effect.runPromise(renderToString({Flags:Schema.Struct({}),init:()=>({model:searchChoices}),view:(model,h:HtmlBuilder<ConsumerSearchMessage>)=>({title:'Search consumer',body:h.div([], [
  zlozEndpointSearchInput(h,model,query=>ConsumerSearchMessage.ChangedQuery({query}),[],{idPrefix:'packed-search'}),
  zlozEndpointSearchClear(h,query=>ConsumerSearchMessage.ChangedQuery({query})),
  zlozEndpointSearchFeedback(h,model,[],{idPrefix:'packed-search'}),
])})},{flags:{},isHydratable:false}));
if (!searchResult.html.includes('No ports match this search.')) throw new Error('Missing packed search feedback');
const result=await Effect.runPromise(renderToString({Flags:Schema.Struct({}),init:()=>({model:arranged}),view:(model,h:HtmlBuilder<EditorEvent>)=>({title:'Consumer',body:h.div([],[zlozView(h,measured,layoutOptions),zlozView(h,selected,{...toolbarOptions,id:'packed-protected',renderEdgeToolbar:undefined,canDelete:deletionPolicy.canDelete}),zlozView(h,{...measured,notice:'Packed status notice',selectionMode:true},copyOptions),zlozView(h,marqueeState,marqueeOptions),zlozView(h,guideState,guideOptions),zlozView(h,selectedGroup,readoutOptions),zlozView(h,selected,listOptions),zlozView(h,quietList,{...listOptions,id:'packed-readonly-list',minimalMode:true}),zlozView(h,groupContext,contextOptions),zlozView(h,edgeContext,{...contextOptions,id:'packed-edge-context'}),zlozView(h,selected,toolbarOptions),zlozView(h,selected,{...toolbarOptions,id:'hidden-toolbar',renderEdgeToolbar:()=>null}),zlozView(h,{...arranged,readOnly:true},labelOptions),zlozView(h,editing,{...labelOptions,id:'packed-label-editing'}),zlozView(h,measured,{...navigationOptions,wheelNavigation}),zlozView(h,dragging,previewOptions),h.svg([], [zlozEdgeHitTarget(h,{edge:externalEdge,path:geometry.path})]),zlozView(h,model,{id:'external',label:'External graph',connectionGeometry:previewPolicy,renderConnection:(context,builder)=>builder.path([builder.D(context.path),builder.Stroke(context.stroke)],[]),edgeGeometry:policy,background,minimalMode:true,diagnostics:{status:true},resizeReadout:false,onEvent:event=>event,renderGroupShell:(context,builder)=>zlozGroupFrame(builder,context,[],[zlozDragHandle(builder,context,[],[context.node.label])]),renderNodeShell:(context,builder)=>zlozNodeFrame(builder,context,[builder.Class('packed-shell')],[zlozDragHandle(builder,context,[],[packedShellBodyCache(context.node,packedShellArtwork,[builder,context.node])]),...context.node.ports.map(port=>zlozPort(builder,context,port,[],['→'])),zlozResizeHandle(builder,context,'right',[],['Resize'])])})])})},{flags:{},isHydratable:false}));
if (!result.html.includes('data-packed-custom-body')) throw new Error('Missing packed custom body cache');
if (!result.html.includes('data-flow-node-body')) throw new Error('Missing packed body retention');
if (!result.html.includes('data-flow-wheel-navigation="pan"') || !result.html.includes('Scroll to pan. Hold Ctrl or Command')) throw new Error('Missing packed wheel navigation');
if (!result.html.includes('title="Packed required link"') || !result.html.includes('Packed required link</small>')) throw new Error('Missing packed deletion action reason');
if (!result.html.includes('data-packed-help="false"') || !result.html.includes('aria-describedby="packed-copy-help"') || !result.html.includes('data-packed-status="false"') || !result.html.includes('Packed status notice')) throw new Error('Missing packed canvas copy');
if (!result.html.includes('data-packed-marquee="20,20,150,160@2"') || !result.html.includes('data-packed-preview-nodes="a"') || !result.html.includes('data-flow-selection-preview="true"') || !result.html.includes('data-packed-match="partial"') || !result.html.includes('data-flow-selection-box')) throw new Error('Missing packed selection marquee');
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
if (!result.html.includes('id="packed-layout-sidebar"')) throw new Error('Missing public layout slot');
const c4Node=createArchitectureNode({id:'component',label:'Packed component',position:{x:20,y:50},size:{width:240,height:180},ports:[],architecture:{family:'c4',role:'component',technology:'TypeScript'}});
const c4Group=createArchitectureNode({id:'boundary',kind:'group',label:'Packed system',position:{x:0,y:0},size:{width:400,height:300},ports:[],architecture:{family:'c4',role:'software-system'}});
const c4Options:ZlozC4NodeOptions<EditorEvent>={bodyCache:createZlozNodeBodyCache(),renderTechnology:({architecture},builder)=>builder.span([],['Custom technology'])};
const c4Output=await Effect.runPromise(renderToString({Flags:Schema.Struct({}),init:()=>({model:createEditor({nodes:[{...c4Node,parentId:'boundary'},c4Group],edges:[]})}),view:(model,h:HtmlBuilder<EditorEvent>)=>({title:'Packed C4',body:zlozView(h,model,{id:'packed-c4',label:'Packed C4',onEvent:event=>event,renderNodeShell:(context,builder)=>zlozC4Node(context,builder,c4Options),renderGroupShell:zlozC4Group})})},{flags:{},isHydratable:false}));
if(!c4Output.html.includes('data-flow-c4-node=') || !c4Output.html.includes('data-flow-c4-group=') || !c4Output.html.includes('Custom technology') || !c4Output.html.includes('Select Packed component')) throw new Error('Missing packed C4 renderer contract');
console.log('packed-consumer-ok');
`;
    const consumer = path.join(directory, 'consumer.ts');
    await writeFile(consumer, source);
    const tsc = path.join(root, 'packages/foldkit-zloz/node_modules/.bin/tsc');
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
    for (const name of ['foldkit-zloz', 'foldkit-zloz-elk']) {
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

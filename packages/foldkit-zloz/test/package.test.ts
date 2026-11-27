import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import elkManifest from '../../foldkit-zloz-elk/package.json';
import coreManifest from '../package.json';
import nativeC4Wire from './fixtures/c4-conversion-v2.json';
import connectionWire from './fixtures/connection-v2-loose.json';
import dddAuditWire from './fixtures/ddd-audit-v1.json';
import nativeDddWire from './fixtures/ddd-conversion-v2.json';
import dddReviewWire from './fixtures/ddd-review-model.json';
import groupV1Wire from './fixtures/group-document-v1-portless.json';
import groupV3Wire from './fixtures/group-document-v3-ported.json';
import nativeModelWire from './fixtures/model-native-v2.json';
import modelModesWire from './fixtures/model-v2-modes.json';
import patchReceiptV3Wire from './fixtures/modelling-patch-receipt-v3.json';
import patchV1Wire from './fixtures/modelling-patch-v1.json';
import nativePatchWire from './fixtures/modelling-patch-v2.json';
import patchV3Wire from './fixtures/modelling-patch-v3.json';
import workshopWire from './fixtures/workshop-v1.json';
const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const options = { cwd: root, maxBuffer: 5 * 1024 * 1024 };

async function checkNativeGroupPackage(
  directory: string,
  core: string,
  elk: string,
  tsc: string,
): Promise<void> {
  const work = path.join(directory, 'native-group');
  await mkdir(work);
  const native = { ...options, cwd: work };
  const installedUi = path.dirname(fileURLToPath(import.meta.resolve('@effect/ui/package.json')));
  const packed = await exec(
    'npm',
    ['pack', '--ignore-scripts', '--pack-destination', work, installedUi],
    native,
  );
  const ui = path.join(work, packed.stdout.trim());
  await writeFile(
    path.join(work, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  await exec(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', core, elk, ui, 'effect@4.1.6'],
    native,
  );
  expect(existsSync(path.join(work, 'node_modules', 'foldkit'))).toBe(false);

  const entry = path.join(work, 'group.mts');
  await writeFile(
    entry,
    `import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { createArchitectureNode, startGroupHeaderMeasurement, captureGroupDocumentV3, createGroupWorkbenchV3, updateGroupWorkbenchV3, groupLayoutRequestV3, applyGroupWorkbenchLayoutV3, groupWorkbenchRoutesV3, createContextMapPattern, resolveContextMapRelationship, dddRelationshipPolicy, resolveDddRelationshipControls, createEventStormingPattern, resolveEventStormingRelationshipControls, eventStormingRelationshipPolicy, createEventStormingWorkshopPattern, resolveEventStormingWorkshopControls, captureModellingPatch, createEditor, resolveModellingPatchReview, createArchitecturePattern, createPlacement, resolvePlacementControls, captureEdition, compareEditions, resolveHistoryChangeNavigator, resolveHistoryComparisonControls, createEditionPlayback, resolveEditionPlaybackControls, resolveEditionScrubber, createSvgReview, resolveGroupSvgReviewV3, createPngReview, resolveGroupPngReviewV3, type ZlozGroupWorkbenchEventV3 } from '@opsydyn/foldkit-zloz';
import { groupSurfaceV3, groupInspectorV3, groupClipboardV3, graphSurface, groupHeaderMeasurementProbe, contextMapConnector, contextMapParticipant, dddRelationshipControls, dddRelationshipPatternSelect, eventStormingRelationshipControls, eventStormingRelationshipInference, workshopControls, workshopSelect, modellingPatchReview, placementHost, placementPalette, labelMeasurementProbe, svgReview, pngReview, playbackControls, playbackControl, editionScrubber, editionScrubberReadout, historyChangeNavigator, historyChangeButton, historyChangeNavigatorV2, historyChangeButtonV2, historyComparisonV2, historyGhosts, historyGhostsV2, historyComparisonControls, historyGhostToggle, type ZlozHistoryChangeNavigatorViewOptionsV2, type ZlozHistoryPresentationViewOptionsV2, type ZlozHistoryPresentationPartsV2, type ZlozHistoryGhostOptionsV2, type GroupSurfaceOptionsV3, type NativeNotationParts } from '@opsydyn/foldkit-zloz/effect-ui';
import { resolveHistoryChangeNavigatorV2, resolveHistoryChangeFocusV2, resolveHistoryChangeStepV2, type ZlozHistoryChangeEntryV2, type ZlozHistoryChangeCursorV2, type ZlozHistoryChangeFocusRequestV2, type ZlozHistoryChangeFocusTargetV2, type ZlozHistoryChangeNavigatorOptionsV2, type ZlozHistoryChangeNavigatorContextV2, parseModelDocumentV2, resolveHistoryComparisonPresentationV2, type ZlozHistoryPresentationOptionsV2, type ZlozHistoryPresentationContextV2 } from '@opsydyn/foldkit-zloz';
import { createElkGroupLayoutV3 } from '@opsydyn/foldkit-zloz-elk';

const model = createGroupWorkbenchV3(captureGroupDocumentV3(${JSON.stringify(groupV3Wire)}), { sessionId: 'packed-group' });
async function arrange() {
  const request = groupLayoutRequestV3(model.editor, 'packed-elk');
  const result = await createElkGroupLayoutV3({ direction: 'DOWN' })(request);
  const arranged = applyGroupWorkbenchLayoutV3(model, request, result);
  if (arranged.editor.history.past.length !== 1 || groupWorkbenchRoutesV3(arranged).length !== 1 ||
      arranged.editor.document.graph.nodes.find((node) => node.id === 'g')?.ports[0]?.id !== 'out') {
    throw new Error('Native ELK layout lost its route, group port, or undo entry');
  }
  return arranged;
}
// The default ELK worker keeps Bun alive. Exercise the packed layout under Node and SSR under both runtimes.
const arranged = 'Bun' in globalThis ? model : await arrange();
const selected = updateGroupWorkbenchV3(arranged, { type: 'NodeSelected', id: 'g', additive: false });
const copied = updateGroupWorkbenchV3(selected, { type: 'CopyPressed' });
const viewOptions: GroupSurfaceOptionsV3<string> = {
  id: 'packed-native-v3',
  minimalMode: true,
  onEvent: (event: ZlozGroupWorkbenchEventV3) => event.type,
  policy: { canEditPort: () => 'Published interface is protected.' },
};
const exportContext = {
  sourceRevision: 0,
  document: model.editor.document,
  title: 'Packed native export',
  theme: { colorScheme: 'light' },
  renderers: { nodes: 'built-in', edges: 'built-in' },
} as const;
const svg = resolveGroupSvgReviewV3(createSvgReview('packed-svg'), { ...exportContext, scope: 'packed-svg' });
const png = resolveGroupPngReviewV3(createPngReview('packed-png'), { ...exportContext, scope: 'packed-png' });
const playback = createEditionPlayback(['first', 'next']);
const transport = resolveEditionPlaybackControls(playback, { editionLabel: 'Packed first' });
const seek = resolveEditionScrubber(playback, { labelEdition: (id) => 'Packed ' + id });
const presentationModelV2=parseModelDocumentV2(${JSON.stringify(JSON.stringify(modelModesWire))});
const presentationBeforeV2=presentationModelV2.editions[0]!;
const presentationOptionsV2:ZlozHistoryPresentationOptionsV2={minimalMode:true,ghosts:{enabled:true},formatMode:(_change,text)=>text};
const presentationV2:ZlozHistoryPresentationContextV2=resolveHistoryComparisonPresentationV2(presentationBeforeV2,{...presentationBeforeV2,snapshot:{...presentationBeforeV2.snapshot,connectionMode:'strict'}},presentationOptionsV2);
const navigationOptionsV2:ZlozHistoryChangeNavigatorOptionsV2={focusReason:(_item,side)=>side==='baseline'?null:'Selected inspection protected'};
const navigationV2:ZlozHistoryChangeNavigatorContextV2=resolveHistoryChangeNavigatorV2(presentationV2.comparison,'baseline',navigationOptionsV2);
const navigationCursorV2:ZlozHistoryChangeCursorV2=navigationV2.entries[0]!.request;
const navigationFocusV2=resolveHistoryChangeFocusV2(presentationV2.comparison,'baseline',navigationCursorV2,navigationOptionsV2);
if(navigationFocusV2.type!=='ready'||navigationFocusV2.target.type!=='mode'||navigationFocusV2.target.side!=='baseline'||navigationFocusV2.target.connectionMode!=='loose'||'event' in navigationFocusV2.target||resolveHistoryChangeFocusV2(presentationV2.comparison,'selected',navigationCursorV2,navigationOptionsV2).type!=='blocked'||resolveHistoryChangeStepV2(presentationV2.comparison,'baseline',null,'next',navigationOptionsV2).type!=='ready')throw new Error('V2 navigation lost mode inspection, chosen side or live veto');
// @ts-expect-error Mode entries do not have an authored graph ID.
const impossibleModeRequestV2:ZlozHistoryChangeFocusRequestV2={baselineId:'a',selectedId:'b',entity:'mode',id:'invented'};void impossibleModeRequestV2;
// @ts-expect-error Mode targets cannot issue editor reveal events.
const impossibleModeTargetV2:ZlozHistoryChangeFocusTargetV2={type:'mode',side:'baseline',editionId:'a',connectionMode:'loose',event:{type:'NodeRevealRequested',id:'invented'}};void impossibleModeTargetV2;
if(navigationV2.entries[0]?.entity==='mode') {
// @ts-expect-error A mode transition is always a changed entry, never added or removed.
const impossibleModeEntryV2:ZlozHistoryChangeEntryV2={...navigationV2.entries[0],kind:'added'};void impossibleModeEntryV2;
}

const navigationViewV2: ZlozHistoryChangeNavigatorViewOptionsV2<string> = {
  renderEntry: (entry, h, onFocus) =>
    h.li(historyChangeButtonV2(h, entry, onFocus, undefined, ['Packed change ' + entry.label])),
};
const presentationViewV2: ZlozHistoryPresentationViewOptionsV2<string> = {
  renderMode: (context, h) => h.strong(context.modeText),
  renderLayout: (parts: ZlozHistoryPresentationPartsV2<string>) => [parts.summary, parts.mode],
};
const presentationGhostsV2: ZlozHistoryGhostOptionsV2<string> = { renderNode: () => null };
// @ts-expect-error Visibility belongs to the resolved context, not the drawing override.
const impossibleGhostsV2: ZlozHistoryGhostOptionsV2<string> = { enabled: true };
void impossibleGhostsV2;
if (historyGhostsV2(presentationV2, presentationGhostsV2) !== null ||
    !presentationV2.ghosts.enabled || presentationV2.effectiveGhosts.enabled) {
  throw new Error('Packed V2 minimal mode must suppress ghost artwork');
}

const historyNode = {
  id: 'packed-history-node', label: 'History node', position: { x: 0, y: 0 },
  size: { width: 100, height: 80 }, ports: [],
};
const before = captureEdition({
  id: 'packed-a', name: 'Packed original', snapshot: { graph: { nodes: [historyNode], edges: [] } },
});
const after = captureEdition({
  id: 'packed-b', name: 'Packed evolved',
  snapshot: { graph: { nodes: [{ ...historyNode, position: { x: 400, y: 90 } }], edges: [] } },
});
const history = compareEditions(before, after);
const navigator = resolveHistoryChangeNavigator(history);
const compare = resolveHistoryComparisonControls([before, after], after.id,
  { baselineId: before.id, ghosts: { enabled: true, nodes: false, edges: true, movements: true } },
  { ghostReasons: { edges: 'Packed policy' } },
);
const patch = captureModellingPatch(${JSON.stringify(patchV1Wire)});
const patchReview = resolveModellingPatchReview({ ...createEditor(patch.source.graph), revision: patch.source.revision }, patch.source, patch, {
  consent: null, blockedReason: 'Packed workspace protected',
});
const placementContext = { scope: 'packed-palette', editor: createEditor({ nodes: [], edges: [] }) };
const palette = resolvePlacementControls(createPlacement(placementContext.scope), placementContext, [{
  id: 'card', label: 'Packaged placement source',
  intent: { source: { type: 'palette', id: 'card' }, fragment: createArchitecturePattern('c4-context'), anchor: { x: 0, y: 0 } },
}]);
const dddControls = resolveDddRelationshipControls(createEditor(createContextMapPattern()), 'orders-billing', {
  policy: dddRelationshipPolicy({}, { canChangeEdgeArchitecture: () => 'Packed agreement protected' }),
});
const causalControls = resolveEventStormingRelationshipControls(
  createEditor(createEventStormingPattern({ includeAggregate: true })),
  'step:0',
  { policy: eventStormingRelationshipPolicy() },
);
const workshop = resolveEventStormingWorkshopControls(
  { ...createEditor(createEventStormingWorkshopPattern()), selectedNodes: ['retry-question'] },
  'retry-question',
);
const contextMap = createEditor(createContextMapPattern());
const c4Node = createArchitectureNode({ id: 'component', label: 'Packed component', position: { x: 20, y: 50 },
  size: { width: 240, height: 180 }, ports: [], architecture: { family: 'c4', role: 'component', technology: 'TypeScript' } });
const c4Group = createArchitectureNode({ id: 'boundary', kind: 'group', label: 'Packed system', position: { x: 0, y: 0 },
  size: { width: 400, height: 300 }, ports: [], architecture: { family: 'c4', role: 'software-system' } });
const c4Editor = createEditor({ nodes: [{ ...c4Node, parentId: 'boundary' }, c4Group], edges: [] });
const header = { id: c4Group.id, padding: { top: 32, right: 20, bottom: 20, left: 24 }, gap: 20 };
const measurement = startGroupHeaderMeasurement(c4Editor, 'packed-c4-measure', 'renderer', [header]);
if (measurement.type !== 'pending') throw new Error('Missing packed heading request');
const headingRequest = measurement.request;
const c4Parts: NativeNotationParts<string> = { renderTechnology: (_, h) => h.span.children('Packed custom technology') };
const App = Html.component({ name: 'PackedGroup', model: Schema.Null, message: Schema.String }).make({
  init: () => null,
  update: () => null,
  view: (h) => h.div(
    groupSurfaceV3(h, copied, viewOptions),
    groupInspectorV3(h, copied, viewOptions),
    groupClipboardV3(h, copied, viewOptions),
    modellingPatchReview(h, patchReview, (event) => event.type, {
      renderSummary: () => null,
      renderLayout: ({ changes, findings, status, acknowledgement, apply }, h) =>
        h.section.attr('data-packed-patch-review', '').children(changes, findings, status, acknowledgement, apply),
    }),
    placementHost(h, palette, (input) => input.type).children(
      placementPalette(h, palette, (input) => input.type, { renderEntry: (entry, h) => h.strong(entry.label) }),
    ),
    labelMeasurementProbe(h, { requestId: 'packed-label', revision: 0, renderKey: 'packed', source: '', edgeIds: [] },
      (result) => result.type, { timeoutMs: 150 }),

    h.div.attr('data-zloz-group-header-measurement-scope', '').children(
      graphSurface(h, c4Editor, {
        id: 'packed-c4', label: 'Packed C4', onInput: (event) => event.type,
        architectureNotation: true, notationParts: c4Parts,
        groupHeader: (node) => node.id === header.id ? { ...header, sizing: 'intrinsic' } : undefined,
      }),
      groupHeaderMeasurementProbe(h, headingRequest, (event) => event.type),
    ),
    graphSurface(h, contextMap, {
      id: 'packed-context-map',
      label: 'Packed Context Map',
      contextMapPresentation: true,
      onInput: (event) => event.type,
      edgeEditing: { onEdit: (event) => event.type },
      renderEdge: (context, h) => {
        const relation = resolveContextMapRelationship(contextMap.graph, context.edge);
        return relation ? contextMapConnector(h, context, relation) : undefined;
      },
      contextMapLabelOptions: {
        renderName: () => null,
        renderPattern: (relation, h) => h.strong('Packed context pattern: ' + relation.pattern),
        renderSource: (participant, _relation, h) => contextMapParticipant(h, participant, {
          renderName: () => h.strong('Packed context participant'),
        }),
      },
    }),
    dddRelationshipControls(h, dddControls, (request) => request.type, {
      renderPattern: (context, h, request) => h.label('Packed pattern', dddRelationshipPatternSelect(h, context, request)),
    }),
    eventStormingRelationshipControls(h, causalControls, (request) => request.type, {
      renderInference: (action, h, request) => eventStormingRelationshipInference(h, action, request, ['Custom inference']),
    }),
    workshopControls(h, workshop, (request) => request.type, {
      renderStatus: (context, h, request) => h.label('Packed workshop status', workshopSelect(h, context, 'status', request)),
    }),
    svgReview(h, svg, (request) => request.type, { idPrefix: 'packed-svg' }),
    pngReview(h, png, (request) => request.type, { idPrefix: 'packed-png' }),
    playbackControls(h, transport, (event) => event.type, {
      renderControl: (action, h, send) =>
        playbackControl(h, action, send, (button) => button.class('packed-pill'), ['Custom ' + action.label]),
    }),
    editionScrubber(h, seek, (request) => request.editionId ?? '', {
      renderReadout: (value, h) => editionScrubberReadout(h, value, undefined, ['Custom ' + value.valueText]),
    }),
    historyComparisonControls(h, compare, (request) => request.type, {
      renderGhost: (control, h, onRequest) =>
        h.label(historyGhostToggle(h, control, onRequest), 'Custom ' + control.label),
    }),
    historyChangeNavigator(h, navigator, { onFilter: (kind) => kind, onFocus: (request) => request.id }, {
      renderEntry: (entry, h, focus) => h.li(historyChangeButton(h, entry, focus, undefined, ['Custom ' + entry.summary])),
    }),
    h.div.attr('data-packed-history-ghosts', '').children(historyGhosts<string>(history, { edges: false })),
    historyChangeNavigatorV2(h, navigationV2, { onFocus: (request) => request.entity, onFilter: (kind) => kind }, navigationViewV2),
    historyComparisonV2(h, presentationV2, presentationViewV2),

  ),
});
const { html } = await Effect.runPromise(HtmlServer.renderToHtml(App, {}, { static: true }));
for (const text of ['data-flow-owner="g"', 'Fit view', 'Copy selection', 'Paste copy',
  'Published interface is protected.', 'crosses the copied selection', 'Download SVG', 'SVG export preview',
  'Render PNG', 'Accept the reported PNG losses', 'packed-pill', 'aria-description=', 'aria-valuetext=', 'Custom Packed first',
  'Packed policy', 'Custom Node ghosts', 'Packed evolved compared with Packed original.',
  'Custom changed node:', 'aria-label="History changes"', 'data-zloz-history-movement=',
  'data-zloz-history-change-v2="mode"', 'Packed change Connection mode',
  'Connection mode changed from loose to strict.', 'role="status"', 'data-packed-patch-review',
  'Packed workspace protected', 'authored-data-loss', 'data-zloz-placement-host', 'Packaged placement source',
  'Packed pattern', 'Packed agreement protected', 'Custom inference', 'Typed: Issues.', 'does not allow',
  'Packed workshop status', 'Hotspot status', 'Packed context pattern:', 'Packed context participant',
  'data-zloz-group-header-measurement-scope', 'data-zloz-group-header="boundary"',
  'data-flow-c4-node="component"', 'data-flow-c4-group="boundary"', 'Packed custom technology',
  'Select Packed component', 'data-zloz-context-map-edge="orders-billing"', 'data-zloz-context-map-label="orders-billing"']) {
  if (!html.includes(text)) throw new Error('Missing packed native group view: ' + text);
}
console.log('native-group-ok');
`,
  );
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
        entry,
      ],
      native,
    );
  await exec(
    tsc,
    ['--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--outDir', 'compiled', entry],
    native,
  );
  for (const runtime of ['bun', 'node']) {
    const result = await exec(runtime, ['compiled/group.mjs'], { ...native, timeout: 15_000 });
    expect(result.stdout.trim()).toBe('native-group-ok');
  }
}

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
    for (const unwanted of ['foldkit', 'effect', '@effect/ui', 'elkjs', 'react'])
      expect(existsSync(path.join(directory, 'node_modules', unwanted))).toBe(false);
    const stylesheet = await exec(
      'node',
      [
        '--input-type=module',
        '-e',
        "console.log(import.meta.resolve('@opsydyn/foldkit-zloz/effect-ui.css'))",
      ],
      { ...options, cwd: directory },
    );
    expect(await readFile(new URL(stylesheet.stdout.trim()), 'utf8')).toContain('.zloz-ui-surface');
    const pure =
      "import { createEditor, serializeGraph, parseGraph, insertPattern, createArchitecturePattern, createEditionPlayback, updateEditionPlayback, playbackEditionId, resolveEditionPlaybackControls, resolveEditionScrubber, editionScrubberRequest, resolveEditionSeek, resolveHistoryComparisonControls, resolveHistoryChangeNavigator, createEventStormingPattern, resolveEventStormingRelationship, resolveEventStormingRelationshipControls, auditEventStormingRelationships, compareModelEventStormingRelationships, resolveAuditComparisonControls, resolveAuditComparisonRequest } from '@opsydyn/foldkit-zloz'; const s=createEditor({nodes:[],edges:[]}); const inserted=insertPattern(s,createArchitecturePattern('ddd-aggregate')); if(inserted.type!=='inserted'||inserted.editor.past.length!==1||inserted.nodeIds.size!==3)throw new Error('Missing pattern contract'); const storm=insertPattern(s,createArchitecturePattern('event-storming')); if(storm.type!=='inserted'||storm.editor.graph.nodes[2]?.architecture?.role!=='domain-event')throw new Error('Missing event-storming contract'); const play=updateEditionPlayback(createEditionPlayback(['a','b'],{intervalMs:1000,reducedMotion:false}),{type:'PlayClicked'}); if(playbackEditionId(updateEditionPlayback(play,{type:'Elapsed',milliseconds:1000}))!=='b')throw new Error('Missing pure playback'); if(!resolveEditionPlaybackControls(play).actions.play.disabled)throw new Error('Missing pure transport'); if(resolveEditionSeek(play,editionScrubberRequest(resolveEditionScrubber(play),'1')).type!=='ready')throw new Error('Missing pure seek'); if(resolveHistoryComparisonControls([{id:'a',name:'A'},{id:'b',name:'B'}],'b',{baselineId:'a',ghosts:{enabled:true,nodes:true,edges:true,movements:true}}).baseline.value!=='a')throw new Error('Missing pure comparison'); if(resolveHistoryChangeNavigator(null).entries.length!==0)throw new Error('Missing headless navigator'); const causal=createEventStormingPattern({includeAggregate:true}); if(resolveEventStormingRelationship(causal,causal.edges[0]).type!=='allowed')throw new Error('Missing causal relationship contract'); if(resolveEventStormingRelationshipControls(createEditor(causal),causal.edges[0].id).value!=='issues')throw new Error('Missing headless relationship controls'); if(auditEventStormingRelationships(causal).summary.typed!==5)throw new Error('Missing headless audit'); const compared=compareModelEventStormingRelationships({id:'packed',name:'Packed',origin:null,snapshot:{graph:causal},editions:[{id:'base',name:'Base',snapshot:{graph:causal}}]},{baselineId:'base'}); if(compared.type!=='compared'||compared.comparison.summary.introduced!==0)throw new Error('Missing headless audit comparison'); const auditDoc={id:'controls',name:'Controls',origin:null,snapshot:{graph:causal},editions:[{id:'base',name:'Base',snapshot:{graph:causal}}]}; const auditState={baselineId:'base',selectedId:null,filters:{introduced:true,resolved:true,persisting:true}}; if(resolveAuditComparisonControls(auditDoc,auditState).entries.length!==0||resolveAuditComparisonRequest(auditDoc,auditState,{type:'FilterToggled',kind:'introduced'}).type!=='ready')throw new Error('Missing headless audit controls'); console.log(JSON.stringify(parseGraph(serializeGraph(s.graph))));";
    for (const runtime of ['node', 'bun']) {
      const result = await exec(runtime, ['--input-type=module', '-e', pure], {
        ...options,
        cwd: directory,
      });
      expect(result.stdout.trim()).toBe('{"nodes":[],"edges":[]}');
    }
    const nativeAuthoringConsumer = `import {parseModellingPatchV3,parseModellingPatchV2,dryRunModellingPatchV3,parseModellingPatchReceiptV3,auditGroupDddRelationshipsV3,createGroupEditorV3,resolveModellingPatchReviewV3,applyModellingPatchV3,updateGroupEditorV3,captureGroupEditorSourceV3} from '@opsydyn/foldkit-zloz';
const patchResult=parseModellingPatchV3(${JSON.stringify(JSON.stringify(patchV3Wire))});
if(patchResult.status!=='parsed')throw new Error('Native patch missing');
const patch=patchResult.value, source=patch.source;
if(dryRunModellingPatchV3(source,patch).type!=='reviewable'||parseModellingPatchV2(JSON.stringify(patch)).status!=='rejected')throw new Error('Version adapter mismatch');
const receipt=parseModellingPatchReceiptV3(${JSON.stringify(JSON.stringify(patchReceiptV3Wire))});
if(receipt.revision!==8||auditGroupDddRelationshipsV3(receipt.snapshot).summary.edges!==1)throw new Error('Native receipt/audit missing');
const {modelId,sessionId,revision,...document}=source,editor={...createGroupEditorV3(document,{sessionId}),revision};
const review=resolveModellingPatchReviewV3(editor,modelId,patch), result=applyModellingPatchV3(editor,modelId,patch,{consent:{key:review.key,reviewed:true,lossesAccepted:true}});
if(result.type!=='applied'||result.editor.history.past.length!==1)throw new Error('Native atomic Apply missing');
if(updateGroupEditorV3(result.editor,{type:'UndoPressed',source:captureGroupEditorSourceV3(result.editor)}).editor.document.graph.nodes[1].label!==document.graph.nodes[1].label)throw new Error('Native Undo missing');
console.log('native-authoring-ok');`;
    for (const runtime of ['node', 'bun']) {
      const result = await exec(runtime, ['--input-type=module', '-e', nativeAuthoringConsumer], {
        ...options,
        cwd: directory,
      });
      expect(result.stdout.trim()).toBe('native-authoring-ok');
    }
    const browserConsumer = `import { renderPngExport, renderGroupPngExportV3 } from '@opsydyn/foldkit-zloz/browser';
const result=await renderPngExport({snapshot:{graph:{nodes:[],edges:[]},viewport:{x:0,y:0,zoom:1}},svg:{title:'SSR',region:{type:'model',padding:0},theme:{colorScheme:'light'},background:{type:'transparent'},font:{family:'sans-serif',size:14,weight:400},renderers:{nodes:'built-in',edges:'built-in'}}});
if(result.type!=='failed'||result.code!=='unsupported')throw new Error('Browser entry imported unsafely under SSR');
const nativeResult=await renderGroupPngExportV3({document:${JSON.stringify(groupV3Wire)},svg:{title:'Native SSR',region:{type:'model',padding:24},theme:{colorScheme:'light'},background:{type:'theme'},font:{family:'sans-serif',size:14,weight:400},renderers:{nodes:'built-in',edges:'built-in'}},writing:{allowLosses:true}});
if(nativeResult.type!=='failed'||nativeResult.code!=='unsupported')throw new Error('Native browser entry imported unsafely');
console.log('browser-import-ok');`;
    for (const runtime of ['node', 'bun']) {
      const result = await exec(runtime, ['--input-type=module', '-e', browserConsumer], {
        ...options,
        cwd: directory,
      });
      expect(result.stdout.trim()).toBe('browser-import-ok');
    }
    const architectureSource = `import { renderPngExport, type ZlozPngBrowserOptions } from '@opsydyn/foldkit-zloz/browser';
const pngOptions:ZlozPngBrowserOptions={timeoutMs:1000};void pngOptions;void renderPngExport;
import { createEventStormingWorkshopPattern, resolveEventStormingWorkshopControls, resolveEventStormingWorkshopRequest, type ZlozWorkshopRequest, resolveEventStormingNodeSemantics, eventStormingWorkshopRelationshipRules, auditEventStormingRelationships as auditWorkshop, type EventStormingParticipantArchitecture, type EventStormingHotspotArchitecture, type EventStormingLaneArchitecture, compareModelDddRelationships, parseModelDocument as parseDddModel, resolveDddAuditControls, resolveDddAuditRequest, type ZlozDddAuditState, auditDddRelationships, type ZlozDddRelationshipAudit, type ZlozDddRelationshipAuditEntry, type ZlozDddRelationshipAuditCode, inspectSvgFontCoverage, validateSvgFontResource, type ZlozSvgFontResource, createSvgReview, resolveSvgReview, updateSvgReview, type ZlozSvgReviewContext } from '@opsydyn/foldkit-zloz';
import { writeSvgExport, type ZlozSvgPrimitive, type ZlozSvgAdapter, planSvgExport, type ZlozSvgExportOptions } from '@opsydyn/foldkit-zloz';
import { resolvePlacementControls, updatePlacementControls, createPlacement, updatePlacement, resolvePlacement, applyPlacement, type ZlozPlacementContext, type ZlozPlacementSource } from '@opsydyn/foldkit-zloz';
import { resolveEdgeWaypointControls, resolveEdgeWaypointPreview, resolveEdgeWaypointEdit, type ZlozEdgeWaypoint, type ZlozEdgeWaypointEdit, type ZlozEdgeWaypointEditDecision, serializeGraph as serializeWaypointGraph, parseGraph as parseWaypointGraph, edgePath as waypointPath } from '@opsydyn/foldkit-zloz';
import { assessPortableCompatibilityV2, type ZlozPortableCompatibilityV2, resolveConnectionPortPair, parseConnectionDocument, serializeConnectionDocument, captureConnectionDocument, planConnectionDocumentDowngrade, createEditorFromConnectionDocument, captureEditionV2, parseModelDocumentV2, serializeModelDocumentV2, parseEditionsV2, serializeEditionsV2, planModelDocumentV2Downgrade, createModelEditorV2, createHistoryReviewV2, updateHistoryReviewV2, mergeEditionsV2, restoreEditionV2, createEditionPlaybackV2, updateEditionPlaybackV2, reviewEditionPlaybackV2, type ZlozConnectionHistoryFrame, type ZlozEditionMergeResultV2, appendEditionV2, type ZlozEditionAppendResultV2, compareEditionsV2, type ZlozHistoryComparisonV2, type ZlozHistoryModeChangeV2, forkEditionV2, type ZlozEditionForkPolicyV2, type ZlozEditionForkResultV2, type ZlozHistoryReviewV2, type ZlozModelDocumentV2, type ZlozEditionV2, type ZlozConnectionDocument, type ZlozConnectionMode } from '@opsydyn/foldkit-zloz';
import { parseEventStormingC4Conversion, serializeEventStormingC4Conversion, applyEventStormingC4Conversion, type ZlozEventStormingC4ApplyResult, createEventStormingC4ConversionPlan, resolveEventStormingC4ConversionConsent, type ZlozEventStormingC4ConversionOptions, type ZlozEventStormingC4ConversionPlan, type ZlozEventStormingC4LossConsent, type ZlozEventStormingC4MembershipDecision } from '@opsydyn/foldkit-zloz';
import { previewEventStormingC4Mapping, type ZlozEventStormingC4Source, type ZlozEventStormingC4Preview } from '@opsydyn/foldkit-zloz';
import { applyEventStormingDddConversion, serializeEventStormingDddConversion, parseEventStormingDddConversion, type ZlozEventStormingDddConversion, createEventStormingDddConversionPlan, resolveEventStormingDddConversionConsent, type ZlozEventStormingDddLossConsent, previewEventStormingDddMapping, type ZlozEventStormingDddPreview, resolveDddRelationshipControls, resolveDddRelationshipRequest, type ZlozDddRelationshipRequest, createContextMapPattern, resolveContextMapRelationship, resolveDddRelationship, dddRelationshipPolicy, isDddEdgeArchitecture, type DddEdgeArchitecture } from '@opsydyn/foldkit-zloz';
import { createArchitectureNode, createEditor, updateEditor, nodeShapeGeometry, portPosition, insertPattern, createArchitecturePattern, type ZlozPatternInsertionResult, type EventStormingNodeArchitecture, createEditionPlayback, updateEditionPlayback, playbackEditionId, type ZlozEditionPlayback, resolveEditionPlaybackControls, type ZlozPlaybackControlsContext, resolveEditionScrubber, editionScrubberRequest, type ZlozEditionSeekRequest, type ZlozNodeArchitecture } from '@opsydyn/foldkit-zloz';

import { resolveDeclaredConsumption, isDeclaredConsumption, declaredConsumptionArchitecture, type ZlozDeclaredConsumption } from '@opsydyn/foldkit-zloz';
const declaredSource=createArchitectureNode({id:'declared-source',label:'Account',position:{x:0,y:0},size:{width:200,height:100},ports:[],architecture:{family:'ddd',role:'aggregate-root'}});
const declaredReader=createArchitectureNode({id:'declared-reader',label:'Balance',position:{x:240,y:0},size:{width:200,height:100},ports:[],architecture:{family:'ddd',role:'read-model'}});
const declaredConsumption:ZlozDeclaredConsumption={sourceNodeId:declaredSource.id,consumerNodeId:declaredReader.id};
const declaredDecision=resolveDeclaredConsumption({nodes:[declaredSource,declaredReader],edges:[]},declaredConsumption);
if(!isDeclaredConsumption(declaredConsumption)||declaredDecision.type!=='allowed'||declaredDecision.sourceRole!=='aggregate-root'||declaredDecision.relationship.architecture.role!=='feeds'||declaredConsumptionArchitecture.scope!=='tactical')throw new Error('Missing framework-neutral consumption contract');
// @ts-expect-error A logical declaration never implies a runtime event filter
const executableConsumption:ZlozDeclaredConsumption={sourceNodeId:'a',consumerNodeId:'b',events:['Deposited']};void executableConsumption;
const packedWorkshopStarter=createEventStormingWorkshopPattern();
const packedWorkshopEditor={...createEditor(packedWorkshopStarter),selectedNodes:['retry-question']};
const packedWorkshopContext=resolveEventStormingWorkshopControls(packedWorkshopEditor,'retry-question');
const packedWorkshopRequest:ZlozWorkshopRequest={...packedWorkshopContext.scope!,type:'StatusSelected',value:'resolved'};
const packedWorkshopDecision=resolveEventStormingWorkshopRequest(packedWorkshopEditor,'retry-question',packedWorkshopRequest);
if(packedWorkshopDecision.type!=='ready'||updateEditor(packedWorkshopEditor,packedWorkshopDecision.event).past.length!==1)throw new Error('Packed workshop controls lost Undo');
const packedWorkshop=parseWaypointGraph(${JSON.stringify(JSON.stringify(workshopWire))});
const canonicalV2:ZlozModelDocumentV2=parseModelDocumentV2(${JSON.stringify(JSON.stringify(modelModesWire))});
const canonicalEdition:ZlozEditionV2=captureEditionV2(canonicalV2.editions[0]!);
const appendedEditionV2:ZlozEditionAppendResultV2=appendEditionV2([canonicalEdition],{id:'consumer-second',name:'Second',snapshot:canonicalV2.snapshot});
if(appendedEditionV2.type!=='appended'||appendedEditionV2.editions.length!==2||appendedEditionV2.editions[0]?.snapshot.connectionMode!=='loose'||appendedEditionV2.editions[1]?.snapshot.connectionMode!=='strict'||!Object.isFrozen(appendedEditionV2.editions))throw new Error('V2 append lost checkpoint modes or frozen ordering');
const duplicateEditionV2=appendEditionV2(appendedEditionV2.editions,canonicalEdition);
const conflictedEditionV2=appendEditionV2(appendedEditionV2.editions,{...canonicalEdition,snapshot:{...canonicalEdition.snapshot,connectionMode:'strict'}});
if(duplicateEditionV2.type!=='blocked'||duplicateEditionV2.code!=='duplicate-edition'||conflictedEditionV2.type!=='blocked'||conflictedEditionV2.code!=='edition-conflict'||'editions' in conflictedEditionV2||conflictedEditionV2.existing.snapshot.connectionMode!=='loose'||conflictedEditionV2.proposed.snapshot.connectionMode!=='strict'||!Object.isFrozen(conflictedEditionV2.proposed.snapshot)||compareEditionsV2(conflictedEditionV2.existing,conflictedEditionV2.proposed).modeChange.kind!=='changed')throw new Error('V2 append lost explicit identity conflict, immutable review pins or mode-only comparison');
// @ts-expect-error A blocked append can never return an archive to publish.
const impossibleAppendV2:ZlozEditionAppendResultV2={type:'blocked',code:'edition-conflict',reason:'Conflict',existing:canonicalEdition,proposed:canonicalEdition,editions:[]};void impossibleAppendV2;
const canonicalSession=createModelEditorV2(canonicalV2);
const workflowMergeV2:ZlozEditionMergeResultV2=mergeEditionsV2(canonicalV2.editions,appendedEditionV2.editions);
if(workflowMergeV2.type!=='merged'||mergeEditionsV2(workflowMergeV2.editions,appendedEditionV2.editions).type!=='unchanged')throw new Error('V2 atomic/idempotent merge missing');
const workflowRestoreV2=restoreEditionV2(canonicalSession,canonicalEdition,{expectedRevision:canonicalSession.revision});
if(workflowRestoreV2.type!=='restored'||workflowRestoreV2.editor.connectionMode!=='loose'||workflowRestoreV2.editor.past.length!==1||updateEditor(workflowRestoreV2.editor,{type:'UndoPressed'}).connectionMode!=='strict'||updateEditor(updateEditor(workflowRestoreV2.editor,{type:'UndoPressed'}),{type:'RedoPressed'}).connectionMode!=='loose')throw new Error('V2 restore lost mode-aware Undo/Redo');
import { parseModellingPatchV2, dryRunModellingPatchV2, resolveModellingPatchReviewV2, applyModellingPatchV2, parseModellingPatchReceiptV2, serializeModellingPatchReceiptV2, auditConnectionDddRelationships, compareModelEventStormingRelationshipsV2, parseEventStormingC4ConversionV2, parseEventStormingDddConversionV2 } from '@opsydyn/foldkit-zloz';
const nativeModelV2=parseModelDocumentV2(${JSON.stringify(JSON.stringify(nativeModelWire))});
const nativePatchDecoded=parseModellingPatchV2(${JSON.stringify(JSON.stringify(nativePatchWire))});
if(nativePatchDecoded.status!=='parsed')throw new Error('Native patch decoder missing');
const nativeEditorV2=createModelEditorV2(nativeModelV2),nativeIdentityV2={modelId:nativeModelV2.id,sessionId:'native-v2-fixture'};
const nativeReviewV2=resolveModellingPatchReviewV2(nativeEditorV2,nativeIdentityV2,nativePatchDecoded.value);
if(!nativeReviewV2.key)throw new Error('Native review failed');
const nativeAppliedV2=applyModellingPatchV2(nativeEditorV2,nativeIdentityV2,nativePatchDecoded.value,{consent:{key:nativeReviewV2.key,reviewed:true,lossesAccepted:true}});
if(nativeAppliedV2.type!=='applied'||parseModellingPatchReceiptV2(serializeModellingPatchReceiptV2(nativeAppliedV2.receipt)).snapshot.connectionMode!=='loose'||updateEditor(nativeAppliedV2.editor,{type:'UndoPressed'}).graph.nodes[0]?.label!==nativeEditorV2.graph.nodes[0]?.label)throw new Error('Native atomic patch/receipt/Undo failed');
if(auditConnectionDddRelationships(nativeModelV2.snapshot).status!=='compatible'||compareModelEventStormingRelationshipsV2(nativeModelV2,{baselineId:'base'}).type!=='compared')throw new Error('Native audit contracts failed');
if(parseEventStormingC4ConversionV2(${JSON.stringify(JSON.stringify(nativeC4Wire))}).document.snapshot.connectionMode!=='loose'||parseEventStormingDddConversionV2(${JSON.stringify(JSON.stringify(nativeDddWire))}).document.snapshot.connectionMode!=='loose')throw new Error('Native conversion receipts lost mode');
const portableCapabilityV2:ZlozPortableCompatibilityV2=assessPortableCompatibilityV2(canonicalV2);
if(portableCapabilityV2.scope!=='format-capability-only'||portableCapabilityV2.adapters.find(a=>a.adapter==='modelling-patch')?.status!=='supported')throw new Error('V2 adapter gates failed');
const workflowPlaybackV2=createEditionPlaybackV2(workflowMergeV2.editions,{reducedMotion:false});
const workflowNextV2=updateEditionPlaybackV2(workflowPlaybackV2,{type:'NextClicked'});
if(reviewEditionPlaybackV2(workflowPlaybackV2,canonicalSession)?.editor.connectionMode!=='loose'||reviewEditionPlaybackV2(workflowNextV2,canonicalSession)?.editor.connectionMode!=='strict'||canonicalSession.past.length)throw new Error('V2 playback lost checkpoint mode or independent working history');
// @ts-expect-error History frames require an explicit supported mode.
const impossibleHistoryFrameV2:ZlozConnectionHistoryFrame={graph:canonicalSession.graph,connectionMode:'auto'};void impossibleHistoryFrameV2;
const forkPolicyV2:ZlozEditionForkPolicyV2={canForkEdition:(_source,edition,target)=>edition.snapshot.connectionMode==='loose'&&target.id==='consumer-fork'?null:'Protected'};
const forkResultV2:ZlozEditionForkResultV2=forkEditionV2(canonicalV2,canonicalEdition.id,{id:'consumer-fork',name:'Consumer fork'},forkPolicyV2);
if(forkResultV2.type!=='forked')throw new Error('V2 consumer fork was blocked');
const forkSessionV2=createModelEditorV2(forkResultV2.document);
// @ts-expect-error A blocked fork can never contain a prospective target document.
const impossibleForkResultV2:ZlozEditionForkResultV2={type:'blocked',reason:'Protected',document:canonicalV2};void impossibleForkResultV2;
if(forkResultV2.document.origin?.modelId!==canonicalV2.id||forkResultV2.document.origin.edition.snapshot.connectionMode!=='loose'||forkResultV2.document.snapshot.connectionMode!=='loose'||forkResultV2.document.editions.length!==0||forkSessionV2.connectionMode!=='loose'||forkSessionV2.past.length!==0||forkSessionV2.future.length!==0||forkSessionV2.revision!==0||forkEditionV2(canonicalV2,canonicalEdition.id,{id:'blocked',name:'Blocked'},forkPolicyV2).type!=='blocked')throw new Error('V2 fork lost provenance, checkpoint mode, fresh session or policy veto');

const comparisonV2:ZlozHistoryComparisonV2=compareEditionsV2(canonicalEdition,{...canonicalEdition,snapshot:{...canonicalEdition.snapshot,connectionMode:'strict'}});
const modeV2:ZlozHistoryModeChangeV2=comparisonV2.modeChange;
if(modeV2.kind!=='changed'||modeV2.before!=='loose'||modeV2.after!=='strict'||!comparisonV2.semanticChanged||comparisonV2.layoutChanged||comparisonV2.nodes.length||comparisonV2.edges.length||!Object.isFrozen(comparisonV2))throw new Error('V2 mode-only comparison lost explicit meaning or invented graph changes');
// @ts-expect-error A changed mode cannot name equal before/after modes.
const impossibleModeV2:ZlozHistoryModeChangeV2={kind:'changed',before:'strict',after:'strict'};
void impossibleModeV2;
const canonicalReview:ZlozHistoryReviewV2=createHistoryReviewV2(canonicalEdition,canonicalSession);
const reviewLocked:true=canonicalReview.editor.readOnly;void reviewLocked;
const canonicalNavigation=updateHistoryReviewV2(canonicalReview,{type:'ViewportNudged',delta:{x:20,y:0}});
if(canonicalSession.connectionMode!=='strict'||canonicalSession.past.length!==0||canonicalReview.editor.connectionMode!=='loose'||canonicalReview.editor.historyLimit!==0||canonicalNavigation.edition!==canonicalReview.edition||canonicalNavigation.editor.past.length!==0||canonicalNavigation.editor.viewport.x!==canonicalReview.editor.viewport.x+20||updateHistoryReviewV2(canonicalReview,{type:'NodeMeasured',id:'a',size:{width:999,height:999}})!==canonicalReview)throw new Error('V2 model/review lost independent mode, history or navigation boundary');

if(canonicalEdition.snapshot.connectionMode!=='loose'||parseModelDocumentV2(serializeModelDocumentV2(canonicalV2)).origin?.edition.snapshot.connectionMode!=='loose'||parseEditionsV2(serializeEditionsV2([canonicalEdition]))[0]?.snapshot.connectionMode!=='loose'||planModelDocumentV2Downgrade(canonicalV2).findings.length!==2)throw new Error('Canonical v2 lost checkpoint mode or downgrade findings');
// @ts-expect-error A checkpoint mode must be explicit in the canonical v2 contract.
const missingCanonicalMode:ZlozEditionV2={id:'bad',name:'Bad',snapshot:{version:2,graph:{nodes:[],edges:[]}}};void missingCanonicalMode;
const packedConnection:ZlozConnectionDocument=parseConnectionDocument(${JSON.stringify(JSON.stringify(connectionWire))});
if(packedConnection.connectionMode!=='loose'||planConnectionDocumentDowngrade(packedConnection).type!=='blocked'||parseConnectionDocument(serializeConnectionDocument(packedConnection)).graph.nodes[0]?.ports[0]?.kind!=='input')throw new Error('Packed v2 connection contract failed');
if(resolveConnectionPortPair({mode:'loose',sourceKind:'input',targetKind:'input'}).type!=='compatible'||resolveConnectionPortPair({sourceKind:'input',targetKind:'input'}).type!=='incompatible')throw new Error('Packed mode matrix failed');
const packedStrict=captureConnectionDocument({graph:{nodes:[],edges:[]}});if(packedStrict.connectionMode!=='strict')throw new Error('Default mode changed');
const connectionEditor=createEditorFromConnectionDocument(packedConnection);
const connectionEdited=updateEditor(connectionEditor,{type:'EdgeReconnected',id:packedConnection.graph.edges[0]!.id,end:'target',endpoint:packedConnection.graph.edges[0]!.source});
if(connectionEdited.past.length!==1||connectionEdited.connectionMode!=='loose'||captureConnectionDocument(updateEditor(connectionEdited,{type:'UndoPressed'})).connectionMode!=='loose')throw new Error('Packed loose editor lost atomic history or mode');
// @ts-expect-error Future mode is not silently accepted by the versioned contract.
const futureMode:ZlozConnectionMode='future';void futureMode;
const packedC4Source:ZlozEventStormingC4Source={document:{id:'packed-workshop',name:'Workshop',snapshot:{graph:packedWorkshop},editions:[],origin:null},sessionId:'consumer:1',revision:0};
const packedC4Preview:ZlozEventStormingC4Preview=previewEventStormingC4Mapping(packedC4Source,{nodes:[{nodeId:'system',architecture:{family:'c4',role:'software-system',scope:'external'}}]});
const packedC4Options:ZlozEventStormingC4ConversionOptions={mappings:{nodes:packedWorkshop.nodes.map(n=>n.id==='system'?{nodeId:n.id,architecture:{family:'c4' as const,role:'software-system' as const}}:{nodeId:n.id,architecture:null}),edges:packedWorkshop.edges.map(e=>({edgeId:e.id,relationship:null}))},memberships:[{nodeId:'system',placement:{type:'organization'}}]};
const packedC4Plan:ZlozEventStormingC4ConversionPlan=createEventStormingC4ConversionPlan(packedC4Source,packedC4Options);
if(packedC4Plan.type!=='reviewable'||packedC4Plan.memberships[0]?.type!=='resolved'||packedC4Plan.changes.nodes.length!==1)throw new Error('Packed C4 plan lost explicit membership');
// @ts-expect-error Missing intent is unresolved, never a blocked decision carrying an explicit placement.
const impossibleC4Membership:ZlozEventStormingC4MembershipDecision={nodeId:'system',before:{parentId:null,extent:null,expandParent:null},reason:'missing',type:'blocked',code:'choice-required',placement:{type:'root'}};void impossibleC4Membership;
const packedC4Consent:ZlozEventStormingC4LossConsent={planKey:packedC4Plan.key,accepted:true};
const packedC4Live=createEditor(packedWorkshop);
const packedC4LiveSource={...packedC4Source,revision:packedC4Live.revision,document:{...packedC4Source.document,snapshot:{graph:packedC4Live.graph,viewport:packedC4Live.viewport}}};
const packedC4LivePlan=createEventStormingC4ConversionPlan(packedC4LiveSource,packedC4Options);
const packedC4Applied:ZlozEventStormingC4ApplyResult=applyEventStormingC4Conversion(packedC4Live,packedC4LiveSource,{conversion:packedC4Options,consent:{planKey:packedC4LivePlan.key,accepted:true}});
if(packedC4Applied.type!=='applied'||packedC4Applied.editor.past.length!==1||packedC4Applied.conversion.source.sessionId!==packedC4Source.sessionId||updateEditor(packedC4Applied.editor,{type:'UndoPressed'}).graph.nodes.find(n=>n.id==='system')?.architecture?.family!=='event-storming')throw new Error('Packed C4 Apply lost atomic Undo or provenance');
if(packedC4Applied.type==='applied'&&parseEventStormingC4Conversion(serializeEventStormingC4Conversion(packedC4Applied.conversion)).document.snapshot.graph.nodes.find(n=>n.id==='system')?.architecture?.family!=='c4')throw new Error('Packed C4 portable receipt lost projection');

if(resolveEventStormingC4ConversionConsent(packedC4Source,packedC4Options,packedC4Consent).type!=='consented'||resolveEventStormingC4ConversionConsent(packedC4Source,packedC4Options,null).type!=='consent-required')throw new Error('Packed C4 exact consent failed');

if(packedC4Preview.nodes.find(n=>n.nodeId==='system')?.type!=='proposed'||packedC4Preview.nodes.find(n=>n.nodeId==='lane')?.type!=='unmapped'||!packedC4Preview.disclosures.some(d=>d.code==='workshop-meaning-replaced')||packedC4Preview.provenance.document===packedC4Source.document)throw new Error('Packed C4 preview lost explicit intent or provenance');

const packedWorkshopSvg=writeSvgExport({graph:packedWorkshop},{title:'Workshop',region:{type:'model',padding:40},theme:{colorScheme:'light'},background:{type:'theme'},font:{family:'sans-serif',size:14,weight:400},renderers:{nodes:'built-in',edges:'built-in'}},{allowLosses:true});
if(packedWorkshopSvg.type!=='written'||!packedWorkshopSvg.svg.includes('Open question')||!packedWorkshopSvg.svg.includes('External system')||!packedWorkshopSvg.svg.includes('Workshop lane'))throw new Error('Packed workshop export lost meaning');
if(JSON.stringify(packedWorkshop.nodes.map(n=>resolveEventStormingNodeSemantics(n)?.kind))!==JSON.stringify(['frame','participant','participant','participant','annotation','participant']))throw new Error('Packed workshop classification failed');
if(auditWorkshop(packedWorkshop,{rules:eventStormingWorkshopRelationshipRules}).summary.blocked!==0||auditWorkshop(packedWorkshop).summary.blocked!==3)throw new Error('Packed workshop opt-in convention failed');
const packedExternal:EventStormingParticipantArchitecture={family:'event-storming',role:'external-system'};void packedExternal;
const packedHotspot:EventStormingHotspotArchitecture={family:'event-storming',role:'hotspot',status:'open'};void packedHotspot;
const packedLane:EventStormingLaneArchitecture={family:'event-storming',role:'lane'};void packedLane;
// @ts-expect-error Hotspot status must be an authored fact.
const implicitHotspot:EventStormingHotspotArchitecture={family:'event-storming',role:'hotspot'};void implicitHotspot;
// @ts-expect-error Organizational lanes do not have annotation status.
const laneStatus:EventStormingLaneArchitecture={family:'event-storming',role:'lane',status:'resolved'};void laneStatus;
const packedDddModel=parseDddModel(${JSON.stringify(JSON.stringify(dddReviewWire))});
const packedDddState:ZlozDddAuditState={baselineId:'ddd-before',selectedId:'ddd-after',filters:{introduced:true,resolved:true,persisting:true}};
const packedDddComparison=compareModelDddRelationships(packedDddModel,{baselineId:'ddd-before'});
if(packedDddComparison.type!=='compared'||JSON.stringify(packedDddComparison.comparison.summary)!==JSON.stringify({introduced:2,resolved:3,persisting:1}))throw new Error('Packed DDD deltas failed');
const packedDddControls=resolveDddAuditControls(packedDddModel,packedDddState);
const packedDddFinding=packedDddControls.entries.find(e=>e.kind==='resolved')!;
const packedDddFocus=resolveDddAuditRequest(packedDddModel,packedDddState,{...packedDddFinding.request,subject:'source'});
if(packedDddFocus.type!=='focus'||packedDddFocus.source.kind!=='edition'||packedDddFocus.source.id!=='ddd-before'||packedDddFocus.event.type!=='NodeRevealRequested')throw new Error('Packed DDD finding navigation failed');
// @ts-expect-error Audit reviews do not grant an Apply action.
const packedDddApply:typeof packedDddFocus.type='apply';void packedDddApply;
const packedDddGraph=parseWaypointGraph(${JSON.stringify(JSON.stringify(dddAuditWire))});
const packedDddAudit:ZlozDddRelationshipAudit=auditDddRelationships(packedDddGraph);
const packedDddEntry:ZlozDddRelationshipAuditEntry=packedDddAudit.entries[0]!;
const packedDddCode:ZlozDddRelationshipAuditCode=packedDddEntry.code;void packedDddCode;
if(packedDddAudit.status!=='incompatible'||packedDddAudit.summary.typed!==4||packedDddAudit.summary.blocked!==5||packedDddAudit.summary.unrelated!==2||packedDddAudit.entries.map(entry=>entry.edgeId).join('|')!=='A-emits|b-strategic|c-side-absent|d-role|e-custom|f-self|g-foreign-participant|i-causal|j-bad-feed|z-feeds|á-untyped')throw new Error('Packed DDD audit contract failed');
// @ts-expect-error Authored DDD audits have no inference status.
const inferredDdd:ZlozDddRelationshipAuditEntry['status']='inferred';void inferredDdd;
const waypointEditor=createEditor(createArchitecturePattern('ddd-aggregate'));
const invalidFont:ZlozSvgFontResource={assetId:'font',format:'truetype',bytes:new Uint8Array([0,1,2])};
if(validateSvgFontResource(invalidFont).type!=='invalid')throw new Error('Missing font validation contract');
// @ts-expect-error URL resources cannot substitute for font bytes
const remoteFont:ZlozSvgFontResource={assetId:'font',format:'truetype',url:'https://example.com/font.ttf'};

const svgOptions:ZlozSvgExportOptions={title:'Packed architecture',region:{type:'model',padding:20},theme:{colorScheme:'dark'},background:{type:'transparent'},font:{family:'sans-serif',size:14,weight:400},renderers:{nodes:'built-in',edges:'built-in'}};
const packedFontBytes=Uint8Array.from(atob('${(await readFile(new URL('./fixtures/font/inter-latin-400.ttf', import.meta.url))).toString('base64')}'), character=>character.charCodeAt(0));
const packedFont:ZlozSvgFontResource={assetId:'packed-font',format:'truetype',bytes:packedFontBytes};
const fontCoverage=inspectSvgFontCoverage(packedFont,'Orders 漢😀');
if(fontCoverage.type!=='checked'||fontCoverage.missingCodePoints.join(',')!=='28450,128512')throw new Error('Missing scalar glyph coverage');

const fontSvg=writeSvgExport(waypointEditor,{...svgOptions,font:{...svgOptions.font,assetId:'packed-font'},assets:[{id:'packed-font',kind:'font',availability:'embedded'}]},{fontResources:[packedFont]});
if(fontSvg.type!=='written'||!fontSvg.svg.includes('data:font/ttf;base64,')||!fontSvg.svg.includes('@font-face'))throw new Error('Missing portable font embedding');

// @ts-expect-error Export must explicitly declare renderer coverage
const missingSvgCoverage:ZlozSvgExportOptions={title:'Missing coverage',region:svgOptions.region,theme:svgOptions.theme,background:svgOptions.background,font:svgOptions.font};
// @ts-expect-error A portable theme cannot defer to the host system scheme
const systemSvgTheme:ZlozSvgExportOptions['theme']={colorScheme:'system'};
const svgPlan=planSvgExport(waypointEditor,svgOptions);
if(svgPlan.type!=='reviewable'||svgPlan.background!==null||svgPlan.viewBox.width<=0||!svgPlan.findings.some(f=>f.code==='font-unverified')||waypointEditor.past.length!==0)throw new Error('Missing detached SVG planning contract');
// @ts-expect-error Raw executable markup is not a portable SVG primitive
const rawSvg:ZlozSvgPrimitive={type:'raw',markup:'<script/>'};
const writtenSvg=writeSvgExport(waypointEditor,svgOptions);
if(writtenSvg.type!=='written'||!writtenSvg.svg.includes('xmlns="http://www.w3.org/2000/svg"')||!writtenSvg.svg.includes('clipPath')||waypointEditor.past.length!==0)throw new Error('Missing standalone SVG writer');
const svgReviewContext:ZlozSvgReviewContext={scope:'packed/review',sourceRevision:0,snapshot:waypointEditor,title:'Packed SVG review',theme:{colorScheme:'dark'},renderers:{nodes:'built-in',edges:'built-in'}};
const svgReviewState=createSvgReview(svgReviewContext.scope);
const svgControls=resolveSvgReview(svgReviewState,svgReviewContext);
const svgDownload=updateSvgReview(svgReviewState,svgReviewContext,{...svgControls.identity,type:'SvgDownloadRequested'});
if(!svgDownload.payload||!svgDownload.payload.svg.includes('<svg')||svgDownload.state.download.type!=='pending')throw new Error('Missing reviewed SVG download payload');
const staleSvg=updateSvgReview(svgReviewState,{...svgReviewContext,sourceRevision:1},{...svgControls.identity,type:'SvgDownloadRequested'});
if(staleSvg.payload!==null)throw new Error('Stale SVG review downloaded');

const bends:readonly ZlozEdgeWaypoint[]=[{id:'turn',position:{x:900,y:700}}];
const waypointRequest:ZlozEdgeWaypointEdit={id:waypointEditor.graph.edges[0].id,revision:waypointEditor.revision,waypoints:bends};
// @ts-expect-error Every delayed edit carries its source revision
const missingWaypointRevision:ZlozEdgeWaypointEdit={id:'edge',waypoints:null};
const waypointDecision:ZlozEdgeWaypointEditDecision=resolveEdgeWaypointEdit(waypointEditor,waypointRequest);
if(waypointDecision.type!=='allowed')throw new Error('Missing waypoint preview');
const waypointEdited=updateEditor(waypointEditor,{type:'EdgeWaypointsChanged',...waypointRequest});
const waypointRestored=parseWaypointGraph(serializeWaypointGraph(waypointEdited.graph));
const waypointControls=resolveEdgeWaypointControls(waypointEdited,waypointRequest.id);
if(waypointControls?.handles[0]?.waypoint.id!=='turn')throw new Error('Missing composable controls');
let waypointDrag=updateEditor(waypointEdited,{type:'EdgeWaypointDragStarted',id:waypointRequest.id,waypointId:'turn',revision:waypointEdited.revision,pointer:1,point:{x:0,y:0}});
waypointDrag=updateEditor(waypointDrag,{type:'PointerMoved',pointer:1,point:{x:20,y:0}});
const waypointPreview=resolveEdgeWaypointPreview(waypointDrag);
if(waypointPreview.type!=='allowed'||waypointPreview.edge.waypoints?.[0]?.position.x!==920||waypointDrag.graph!==waypointEdited.graph)throw new Error('Missing pure transient drag');
if(updateEditor(waypointDrag,{type:'PointerReleased',pointer:1}).past.length!==2)throw new Error('Missing one-Undo drag');

if(waypointEdited.past.length!==1||!waypointPath(waypointRestored,waypointRestored.edges[0]).includes('900,700'))throw new Error('Missing portable waypoint transaction');
const placementContext:ZlozPlacementContext={scope:'packed/model-session',editor:createEditor({nodes:[],edges:[]})};
// @ts-expect-error External data is a normalized graph, never an executable source kind
const invalidPlacementSource:ZlozPlacementSource={type:'script',id:'bad'};
let pendingPlacement=createPlacement(placementContext.scope);
pendingPlacement=updatePlacement(pendingPlacement,placementContext,{type:'PlacementStarted',scope:placementContext.scope,generation:pendingPlacement.generation,intent:{source:{type:'external',id:'portable'},fragment:createArchitecturePattern('c4-context'),anchor:{x:30,y:65}}});
pendingPlacement=updatePlacement(pendingPlacement,placementContext,{type:'PlacementTargetChanged',scope:placementContext.scope,generation:pendingPlacement.generation,target:{space:'world',point:{x:20,y:40}}});
const placementPreview=resolvePlacement(pendingPlacement,placementContext);
if(placementPreview.type!=='ready'||placementContext.editor.graph.nodes.length!==0)throw new Error('Missing pure placement preview');
const placed=applyPlacement(pendingPlacement,placementContext,placementPreview.request);
if(placed.type!=='placed'||placed.editor.past.length!==1||placed.editor.graph.nodes[0].position.x!==20||placed.placement.type!=='idle')throw new Error('Missing atomic scoped placement');
const paletteEntries=[{id:'card',label:'C4 card',intent:{source:{type:'palette' as const,id:'card'},fragment:createArchitecturePattern('c4-context'),anchor:{x:30,y:65}}}];
const paletteContext={...placementContext,editor:{...placementContext.editor,surface:{width:800,height:600}}};
const paletteStarted=updatePlacementControls(createPlacement(paletteContext.scope),paletteContext,paletteEntries,{type:'PaletteEntryActivated',scope:paletteContext.scope,generation:0,id:'card'});
const paletteControls=resolvePlacementControls(paletteStarted.placement,paletteContext,paletteEntries);
const paletteApplied=updatePlacementControls(paletteStarted.placement,paletteContext,paletteEntries,{type:'PlacementAccepted',scope:paletteContext.scope,generation:paletteControls.generation,targetRevision:paletteControls.targetRevision});
if(paletteApplied.editor.past.length!==1||paletteApplied.placement.type!=='idle')throw new Error('Missing portable palette controls');
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
const patternResult:ZlozPatternInsertionResult=insertPattern(initial,createArchitecturePattern('c4-context'),{offset:{x:400,y:0},policy:{canInsertPattern:()=>null}});
if(patternResult.type!=='inserted'||patternResult.nodeIds.size!==2)throw new Error('Missing typed pattern contract');
const processNote:EventStormingNodeArchitecture={family:'event-storming',role:'policy'};
const storm=insertPattern(initial,createArchitecturePattern('event-storming'));
if(storm.type!=='inserted'||storm.nodeIds.size!==5||processNote.role!=='policy')throw new Error('Missing event-storming type contract');
const mapping:ZlozEventStormingDddPreview=previewEventStormingDddMapping(storm.editor.graph);
if(!mapping.nodes.some(n=>n.type==='ambiguous')||!mapping.disclosures.some(d=>d.kind==='node'))throw new Error('Missing headless workshop mapping preview');
// @ts-expect-error A preview does not expose an executable converted graph
const convertedGraph=mapping.graph;
const conversionSource={document:{id:'workshop-consumer',name:'Workshop',snapshot:{graph:storm.editor.graph,viewport:storm.editor.viewport},editions:[],origin:null},sessionId:'consumer-session',revision:storm.editor.revision};
const conversionPlan=createEventStormingDddConversionPlan(conversionSource,{nodes:mapping.nodes.filter(n=>n.type!=='proposed').map(n=>({nodeId:n.nodeId,architecture:null})),edges:mapping.edges.filter(e=>e.type!=='proposed'&&e.type!=='retained').map(e=>({edgeId:e.edgeId,architecture:null}))});
if(conversionPlan.type!=='reviewable'||conversionPlan.changes.nodes.length!==1)throw new Error('Missing reviewable conversion plan');
const lossConsent:ZlozEventStormingDddLossConsent={planKey:conversionPlan.key,accepted:true};
// @ts-expect-error A declining value is not an affirmative consent record
const declinedConsent:ZlozEventStormingDddLossConsent={planKey:conversionPlan.key,accepted:false};
if(resolveEventStormingDddConversionConsent(conversionSource,conversionPlan.mappings,lossConsent).type!=='consented')throw new Error('Missing exact-plan consent');
// @ts-expect-error A conversion plan exposes no converted graph or Apply event
const plannedGraph=conversionPlan.graph;
const appliedConversion=applyEventStormingDddConversion(storm.editor,conversionSource,{mappings:conversionPlan.mappings,consent:lossConsent});
if(appliedConversion.type!=='applied'||appliedConversion.editor.past.length!==storm.editor.past.length+1)throw new Error('Missing atomic conversion');
const retainedConversion:ZlozEventStormingDddConversion=parseEventStormingDddConversion(serializeEventStormingDddConversion(appliedConversion.conversion));
if(retainedConversion.source.document.id!=='workshop-consumer'||retainedConversion.document.snapshot.graph.nodes.length!==storm.editor.graph.nodes.length)throw new Error('Missing portable source provenance');
if(JSON.stringify(updateEditor(appliedConversion.editor,{type:'UndoPressed'}).graph)!==JSON.stringify(storm.editor.graph))throw new Error('Missing single conversion Undo');
// @ts-expect-error Loss consent is required as an explicit field, even when currently absent
const omittedLossConsent=()=>applyEventStormingDddConversion(storm.editor,conversionSource,{});
const playback:ZlozEditionPlayback=createEditionPlayback(['a','b'],{reducedMotion:false});
if(playbackEditionId(updateEditionPlayback(playback,{type:'NextClicked'}))!=='b')throw new Error('Missing typed playback');
const controls:ZlozPlaybackControlsContext=resolveEditionPlaybackControls(playback,{editionLabel:'First'});
if(controls.statusText!=='Paused · First')throw new Error('Missing typed controls');
const seek:ZlozEditionSeekRequest=editionScrubberRequest(resolveEditionScrubber(playback),'1');
if(seek.editionId!=='b')throw new Error('Missing typed seek');
const dddRelation:DddEdgeArchitecture={family:'ddd',scope:'strategic',role:'upstream-downstream',upstream:['open-host-service','published-language'],downstream:'anti-corruption-layer'};
// @ts-expect-error Tactical meaning cannot carry strategic side roles
const mixedScope:DddEdgeArchitecture={family:'ddd',scope:'tactical',role:'references',downstream:'conformist'};
// @ts-expect-error Symmetric partnerships have no upstream annotations
const symmetricSide:DddEdgeArchitecture={family:'ddd',scope:'strategic',role:'partnership',upstream:['published-language']};
const context=(id:string)=>({id,label:id,kind:'group' as const,position:{x:0,y:0},size:{width:100,height:100},ports:[],architecture:{family:'ddd' as const,role:'bounded-context' as const}});
const meaning=resolveDddRelationship({nodes:[context('up'),context('down')],edges:[]},{sourceNodeId:'up',targetNodeId:'down',architecture:dddRelation});
if(meaning.type!=='allowed'||meaning.direction!=='directed'||!isDddEdgeArchitecture(dddRelation)||typeof dddRelationshipPolicy().canConnect!=='function')throw new Error('Missing headless DDD contracts');
const map=createContextMapPattern();const link=map.edges[0];if(!link||map.nodes.length!==4||resolveContextMapRelationship(map,link)?.direction!=='directed')throw new Error('Missing pure context-map contract');
const controlEditor=createEditor(map), dddControls=resolveDddRelationshipControls(controlEditor,link.id);
const roleRequest:ZlozDddRelationshipRequest={type:'DownstreamRoleSelected',edgeId:link.id,revision:controlEditor.revision,role:'conformist'};
// @ts-expect-error Graph revision is required for a valid editing request
const staleRequest:ZlozDddRelationshipRequest={type:'PatternSelected',edgeId:link.id,key:null};
const roleResult=resolveDddRelationshipRequest(controlEditor,link.id,roleRequest,{policy:dddRelationshipPolicy()});
if(dddControls.upstream.length!==2||roleResult.type!=='ready')throw new Error('Missing DDD editing contract');
const roleEditor=updateEditor(controlEditor,roleResult.event,dddRelationshipPolicy());
if(roleEditor.past.length!==1||resolveDddRelationshipControls(roleEditor,link.id).downstream?.value!=='conformist')throw new Error('Missing DDD Undo contract');
console.log('headless-architecture-ok');
`;
    const groupConsumerSource = `
import {planGroupPortEditV3,applyGroupPortEditV3,createGroupEditorV3,captureGroupEditorSourceV3,applyGroupEditorTransactionV3,updateGroupEditorV3,resolveGroupEditorBoundaryV3,updateEditor,captureGroupDocumentV3,validateGroupDocumentV3,parseGroupDocumentV3,serializeGroupDocumentV3,upgradeGroupDocumentV3,planGroupDocumentDowngradeV3,parseConnectionDocument,createEditor,portPosition,groupDocumentV3Limits} from '@opsydyn/foldkit-zloz';
import type {ZlozGroupPortEditV3,ZlozGroupPortEditRequestV3,ZlozGroupPortEditPlanV3,ZlozGroupPortEditResultV3,ZlozGroupEditorStateV3,ZlozGroupEditorPolicyV3,ZlozGroupEditorResultV3,ZlozGroupEditorSourceV3,ZlozGroupEditorTransactionV3,ZlozGroupEditorEventV3,ZlozGroupEditorBoundaryV3,ZlozGroupEditorOptionsV3,ZlozGroupEditorCommitV3,ZlozGroupDocumentV3,ZlozGroupCapabilitiesV3,ZlozGroupDocumentV3ParseResult,ZlozGroupDocumentDowngradePlanV3} from '@opsydyn/foldkit-zloz';
const doc:ZlozGroupDocumentV3=captureGroupDocumentV3(${JSON.stringify(groupV3Wire)});
const caps:ZlozGroupCapabilitiesV3=doc.capabilities;
validateGroupDocumentV3(doc);
const parsed:ZlozGroupDocumentV3ParseResult=parseGroupDocumentV3(serializeGroupDocumentV3(doc));
const blocked:ZlozGroupDocumentDowngradePlanV3=planGroupDocumentDowngradeV3(doc);
if(parsed.status!=='parsed'||!caps.groupPorts||blocked.type!=='blocked'||'document' in blocked||portPosition(doc.graph.nodes[1]!,'out').x!==500||groupDocumentV3Limits.maxDepth!==64)throw new Error('Missing group v3 boundary');
import {planGroupSvgExportV3,writeGroupSvgExportV3,captureGroupSvgLayoutV3,createSvgReview,resolveGroupSvgReviewV3,updateGroupSvgReviewV3,type ZlozGroupSvgExportOptionsV3,type ZlozGroupSvgReviewContextV3} from '@opsydyn/foldkit-zloz';
const nativeSvgOptions:ZlozGroupSvgExportOptionsV3={title:'Packed native SVG',region:{type:'model',padding:40},theme:{colorScheme:'dark'},background:{type:'theme'},font:{family:'sans-serif',size:14,weight:400},renderers:{nodes:'built-in',edges:'built-in'}};
const nativeSvgPlan=planGroupSvgExportV3(doc,nativeSvgOptions),nativeSvg=writeGroupSvgExportV3(doc,nativeSvgOptions);
if(nativeSvg.type!=='written'||nativeSvgPlan.document.capabilities.groupPorts!==true||!nativeSvg.svg.includes('data-zloz-export-owner="g"')||!nativeSvg.svg.includes('data-zloz-document-version="3"'))throw new Error('Packed native v3 SVG source/artwork missing');
const nativeSvgContext:ZlozGroupSvgReviewContextV3={scope:'installed-svg-v3',sourceRevision:0,document:doc,title:'Packed review',theme:{colorScheme:'light'},renderers:nativeSvgOptions.renderers};
const nativeSvgState=createSvgReview(nativeSvgContext.scope),nativeSvgControls=resolveGroupSvgReviewV3(nativeSvgState,nativeSvgContext);
if(nativeSvgControls.result?.type!=='written'||updateGroupSvgReviewV3(nativeSvgState,nativeSvgContext,{...nativeSvgControls.identity,type:'SvgDownloadRequested'}).payload?.svg!==nativeSvgControls.result.svg)throw new Error('Packed SVG review missing');
const packedSourceEdge=doc.graph.edges[0]!;
const packedRoutes=captureGroupSvgLayoutV3(doc,[{id:packedSourceEdge.id,points:[packedSourceEdge.source,packedSourceEdge.target].map(e=>portPosition(doc.graph.nodes.find(n=>n.id===e.node)!,e.port))}],'installed');
if(writeGroupSvgExportV3(doc,{...nativeSvgOptions,layout:{snapshot:packedRoutes,renderKey:'installed'}}).type!=='written')throw new Error('Packed native retained routes missing');

import {planGroupPngExportV3,createPngReview,resolveGroupPngReviewV3,updateGroupPngReviewV3,type ZlozGroupPngReviewContextV3,type ZlozGroupPngRenderPayloadV3} from '@opsydyn/foldkit-zloz';
const nativePngContext:ZlozGroupPngReviewContextV3={...nativeSvgContext,scope:'installed-native-png',regions:[{id:'model',label:'One pixel fixture',value:{type:'bounds',bounds:{x:0,y:0,width:1,height:1}}}],layout:{snapshot:packedRoutes,renderKey:'installed'}};
const nativePngState=createPngReview(nativePngContext.scope),nativePngView=resolveGroupPngReviewV3(nativePngState,nativePngContext);
const nativePngAccepted=updateGroupPngReviewV3(nativePngState,nativePngContext,{...nativePngView.identity,type:'PngLossAcceptanceChanged',accepted:true}).state;
const nativePngJob=updateGroupPngReviewV3(nativePngAccepted,nativePngContext,{...nativePngView.identity,type:'PngRenderRequested'});
const nativePayload:ZlozGroupPngRenderPayloadV3|null=nativePngJob.payload;
if(!nativePayload||nativePayload.input.document.version!==3||nativePayload.input.document.capabilities.groupPorts!==true||nativePayload.input.expectedSvg!==nativePayload.plan.svg||planGroupPngExportV3(nativePayload.input).type!=='ready'||'snapshot' in nativePayload.input)throw new Error('Packed native PNG source/plan missing');
const nativePixel={dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=',byteLength:68,width:1,height:1};
const nativePngReady=updateGroupPngReviewV3(nativePngJob.state,nativePngContext,{...nativePngView.identity,type:'PngRenderSettled',run:nativePayload.run,result:{type:'rendered',artifact:nativePixel}});
if(updateGroupPngReviewV3(nativePngReady.state,nativePngContext,{...nativePngView.identity,type:'PngDownloadRequested'}).download?.artifact.dataUrl!==nativePixel.dataUrl)throw new Error('Packed native PNG exact artifact lifecycle missing');

let rejected=false;
try { createEditor(doc.graph); } catch { rejected=true; }
if(!rejected)throw new Error('Widened legacy editor');
const upgraded=upgradeGroupDocumentV3(${JSON.stringify(groupV1Wire)});
const plan=planGroupDocumentDowngradeV3(upgraded);
if(plan.type!=='reviewable'||parseConnectionDocument(JSON.stringify(plan.document)).connectionMode!=='strict')throw new Error('Missing explicit group upgrade/downgrade');
// @ts-expect-error v3 document version is not a v2 envelope.
const oldVersion:ZlozGroupDocumentV3={...doc,version:2};
// @ts-expect-error capability is required in the public document contract.
const missingCapability:ZlozGroupDocumentV3={version:3,coordinateSpace:'world',connectionMode:'strict',graph:doc.graph};
const editorOptions:ZlozGroupEditorOptionsV3={sessionId:'installed-v3'};
const session:ZlozGroupEditorStateV3=createGroupEditorV3(doc,editorOptions);
const source:ZlozGroupEditorSourceV3=captureGroupEditorSourceV3(session);
const transaction:ZlozGroupEditorTransactionV3={source,document:{...doc,viewport:{x:40,y:10,zoom:2}}};
const checked:ZlozGroupEditorCommitV3[]=[];
const policy:ZlozGroupEditorPolicyV3={canCommitGroupDocumentV3:change=>{checked.push(change);return null;}};
const applied:ZlozGroupEditorResultV3=applyGroupEditorTransactionV3(session,transaction,policy);
if(applied.type!=='applied'||applied.editor.history.past.length!==1||'graph' in applied.editor)throw new Error('Missing explicit v3 editor/transaction');
const undoEvent:ZlozGroupEditorEventV3={type:'UndoPressed',source:captureGroupEditorSourceV3(applied.editor)};
const undone=updateGroupEditorV3(applied.editor,undoEvent,policy);
const redone=updateGroupEditorV3(undone.editor,{type:'RedoPressed',source:captureGroupEditorSourceV3(undone.editor)},policy);
if(undone.type!=='applied'||redone.type!=='applied'||undone.editor.document.viewport?.x!==12||redone.editor.document.viewport?.x!==40||!undone.editor.document.capabilities.groupPorts||redone.editor.revision!==3||checked.length!==3)throw new Error('Lost v3 history capability/mode/camera');
const boundary:ZlozGroupEditorBoundaryV3='modelling-patch';
if(resolveGroupEditorBoundaryV3(session,boundary).type!=='unchanged'||applyGroupEditorTransactionV3(applied.editor,transaction).type!=='blocked')throw new Error('Missing v3 compatibility/source protection');
if(false){
// @ts-expect-error legacy reducer cannot consume v3 sessions.
updateEditor(session,{type:'UndoPressed'});
// @ts-expect-error v3 creation does not accept a bare graph.
createGroupEditorV3(doc.graph,editorOptions);
// @ts-expect-error history events require exact source freshness.
updateGroupEditorV3(session,{type:'UndoPressed'});
}
const portEdit:ZlozGroupPortEditV3={operation:'remove',endpoint:{node:'g',port:'out'}};
const portRequest:ZlozGroupPortEditRequestV3={source:captureGroupEditorSourceV3(session),edit:portEdit};
const portPlan:ZlozGroupPortEditPlanV3=planGroupPortEditV3(session,portRequest);
if(portPlan.type!=='ready'||portPlan.removedEdges[0]?.id!=='boundary-link'||session.revision!==0)throw new Error('Missing headless group port preview');
const portResult:ZlozGroupPortEditResultV3=applyGroupPortEditV3(session,portPlan.request);
if(portResult.type!=='applied'||portResult.editor.history.past.length!==1||portResult.editor.document.graph.edges.length!==0||updateGroupEditorV3(portResult.editor,{type:'UndoPressed',source:captureGroupEditorSourceV3(portResult.editor)}).editor.document.graph.edges[0]?.id!=='boundary-link')throw new Error('Missing atomic group port removal/Undo');
if(applyGroupPortEditV3(session,portPlan.request,{canDelete:()=> 'Protected edge.'}).type!=='blocked')throw new Error('Cached preview authorized protected removal');
if(false){
// @ts-expect-error a cached document transaction is not editable group-port intent.
applyGroupPortEditV3(session,portPlan.transaction);
// @ts-expect-error label removal is explicit null, not undefined.
const invalidLabel:ZlozGroupPortEditV3={operation:'label',endpoint:{node:'g',port:'out'},label:undefined};
}
import {planGroupConnectionV3,applyGroupConnectionV3,planGroupOperationV3,applyGroupOperationV3,captureModelDocumentV3,serializeModelDocumentV3,parseModelDocumentV3,createModelEditorV3,createHistoryReviewV3,compareEditionsV3,mergeEditionsV3,forkModelDocumentV3,restoreModelEditionV3,assessPortableCompatibilityV3,createGroupWorkbenchV3,updateGroupWorkbenchV3,groupWorkbenchGraphV3} from '@opsydyn/foldkit-zloz';
const v3Model=captureModelDocumentV3({id:'packed-v3',name:'Packed v3',snapshot:doc,editions:[{id:'first',name:'First',snapshot:doc}],origin:null});
if(parseModelDocumentV3(serializeModelDocumentV3(v3Model)).snapshot.capabilities.groupPorts!==true||createHistoryReviewV3(v3Model.editions[0]!,'review-packed-v3').editor.readOnly!==true||assessPortableCompatibilityV3(v3Model).downgrade.type!=='blocked')throw new Error('V3 portable model/history/gates missing');
const v3Editor=createModelEditorV3(v3Model,{sessionId:'workflow-packed-v3'});
const v3Operation={source:captureGroupEditorSourceV3(v3Editor),operation:{operation:'move',nodeIds:['g','child'],delta:{x:20,y:10}}} as const;
if(planGroupOperationV3(v3Editor,v3Operation).type!=='ready'||applyGroupOperationV3(v3Editor,v3Operation).editor.history.past.length!==1)throw new Error('V3 group operations missing');
const v3Connection={source:captureGroupEditorSourceV3(v3Editor),edit:{operation:'reconnect',edgeId:'boundary-link',end:'target',endpoint:{node:'b',port:'in'}}} as const;
if(planGroupConnectionV3(v3Editor,v3Connection).type!=='unchanged'||applyGroupConnectionV3(v3Editor,v3Connection).type!=='unchanged')throw new Error('V3 reconnection no-op missing');
const nativeV3=createGroupWorkbenchV3(doc,{sessionId:'native-packed-v3'});
const selectedV3=updateGroupWorkbenchV3(nativeV3,{type:'NodeSelected',id:'g',additive:false});
if(groupWorkbenchGraphV3(selectedV3).nodes.length!==3||updateGroupWorkbenchV3(selectedV3,{type:'SelectionNudged',delta:{x:20,y:0}}).editor.history.past.length!==1)throw new Error('V3 native controller missing');
const mergedV3=mergeEditionsV3(v3Model.editions,v3Model.editions);
if(mergedV3.type!=='unchanged'||compareEditionsV3(v3Model.editions[0]!,v3Model.editions[0]!).semanticChanged||forkModelDocumentV3(v3Model,'first',{id:'forked-v3',name:'Fork'}).origin?.modelId!=='packed-v3'||restoreModelEditionV3(v3Model,v3Editor,{source:captureGroupEditorSourceV3(v3Editor),modelId:v3Model.id,edition:v3Model.editions[0]!}).type!=='unchanged')throw new Error('V3 model workflow missing');
import {copyGroupSelectionV3,groupPasteRequestV3,planGroupPasteV3,applyGroupPasteV3,type ZlozGroupPasteRequestV3,type ZlozGroupClipboardV3} from '@opsydyn/foldkit-zloz';
const copiedNative=copyGroupSelectionV3(v3Editor,['g','b']);
if(copiedNative.type!=='copied')throw new Error('Installed native copy missing');
const clipboardNative:ZlozGroupClipboardV3=copiedNative.clipboard;
const pasteNative:ZlozGroupPasteRequestV3=groupPasteRequestV3(v3Editor,clipboardNative,{offset:{x:40,y:40}});
if(planGroupPasteV3(v3Editor,pasteNative).type!=='ready'||applyGroupPasteV3(v3Editor,pasteNative).editor.history.past.length!==1||applyGroupPasteV3(v3Editor,pasteNative,{canEditPort:()=> 'Locked'}).type!=='blocked')throw new Error('Installed native clipboard lost policy/atomicity');
// @ts-expect-error Legacy graphs are not full native clipboard contracts.
const graphClipboard:ZlozGroupClipboardV3=doc.graph;void graphClipboard;
// @ts-expect-error Native paste requires explicit scoped-port maps.
const partialPaste:ZlozGroupPasteRequestV3={source:pasteNative.source,clipboard:clipboardNative,offset:{x:0,y:0},identities:{nodes:[],edges:[]}};void partialPaste;
console.log('group-v3-ok');
`;
    const groupConsumer = path.join(directory, 'group-v3.mts');
    await writeFile(groupConsumer, groupConsumerSource);
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
          groupConsumer,
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
        groupConsumer,
      ],
      { ...options, cwd: directory },
    );
    for (const runtime of ['node', 'bun']) {
      const result = await exec(runtime, ['pure-compiled/architecture.mjs'], {
        ...options,
        cwd: directory,
      });
      expect(result.stdout.trim()).toBe('headless-architecture-ok');
      expect(
        (
          await exec(runtime, ['pure-compiled/group-v3.mjs'], { ...options, cwd: directory })
        ).stdout.trim(),
      ).toBe('group-v3-ok');
    }
    for (const unwanted of ['foldkit', 'effect', '@effect/ui', 'elkjs', 'react'])
      expect(existsSync(path.join(directory, 'node_modules', unwanted))).toBe(false);
    await checkNativeGroupPackage(directory, core, elk, rootTsc);
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
    const source = `import { createEventStormingWorkshopPattern as packedWorkshopPattern, resolveEventStormingWorkshopControls as packedWorkshopControls, type ZlozWorkshopRequest as PackedWorkshopRequest } from '@opsydyn/foldkit-zloz';
import { zlozEventStormingNode as packedWorkshopNode, zlozEventStormingGroup as packedWorkshopGroup } from '@opsydyn/foldkit-zloz/foldkit';
import { resolveDddAuditControls as resolvePackedDddControls, type ZlozDddAuditRequest } from '@opsydyn/foldkit-zloz';
import { zlozDddAuditControls, zlozDddAuditFindingButton } from '@opsydyn/foldkit-zloz/foldkit';
import { resolveModellingPatchReview, applyModellingPatch, parseModellingPatch, type ZlozModellingPatchParseResult, captureModellingPatch, dryRunModellingPatch, resolveAuditComparisonControls, type ZlozAuditComparisonControlsContext, compareModelEventStormingRelationships, type ZlozRelationshipAuditComparisonDecision, auditEventStormingRelationships, type ZlozEventStormingRelationshipAudit, resolveEventStormingRelationshipControls, resolveEventStormingRelationshipRequest, createEventStormingPattern, resolveEventStormingRelationship, eventStormingRelationshipPolicy, type EventStormingEdgeArchitecture, fitNodes, resolveHistoryChangeNavigator, resolveHistoryChangeFocus, resolveHistoryComparisonControls, createEditionPlayback, captureModelDocument, serializeModelDocument, parseModelDocument, forkEdition, createModelEditor, type ZlozModelDocument, mergeEditions, resolveEditionRestore, restoreEdition, type ZlozEditionRestoreOptions, type ZlozHistoryChange, captureEdition, appendEdition, serializeEditions, parseEditions, createHistoryReview, updateHistoryReview, compareEditions } from '@opsydyn/foldkit-zloz';
import { createPngReview, resolvePngReview, updatePngReview, type ZlozPngReviewContext, captureSvgLayout, planSvgExport, writeSvgExport, type ZlozSvgAdapter, type ZlozSvgLayoutOptions, startGroupHeaderMeasurement, updateGroupHeaderMeasurements, resolveGroupHeaderMeasurements, resolveLayoutGroupHeader, type LayoutGroupHeader, startLabelMeasurement, updateLabelMeasurements, resolveLabelMeasurements, createArchitectureNode, createEditor, updateEditor, resolveEndpointChoices, resolveConnectionCreation, resolveEdgeReconnection, resolveDeletion, type BoxSelectionMatch, type EditorPolicy, layoutRequest, applyLayout, applyPreviewLayout, portAnchor, portPosition, portBoundaryPosition, resolveConnectionPreview, type ZlozConnectionGeometryPolicy, resolveEdgeGeometry, type ZlozEdgeGeometryPolicy, type ZlozEdge, type ZlozGraph, type ZlozNode, type EditorEvent } from '@opsydyn/foldkit-zloz';
import { zlozAuditComparisonControls, zlozAuditFindingButton, type ZlozAuditComparisonViewOptions, zlozEventStormingNode, type ZlozEventStormingNodeOptions, zlozDddNode, zlozDddGroup, type ZlozDddNodeOptions, createZlozNodeBodyCache, type ZlozNodeBodyCache, zlozEndpointSearchInput, zlozEndpointSearchClear, zlozEndpointSearchFeedback, zlozConnectionCreation, zlozConnectionCreationField, zlozConnectionCreationSelect, zlozConnectionCreationReasons, zlozConnectionCreationCancel, zlozEdgeEndpointField, zlozEdgeEndpointSelect, zlozEdgeEndpointReasons, zlozView, type ZlozWheelNavigation, type ZlozCanvasHelpContext, type ZlozCanvasStatusContext, type ZlozSelectionMarqueeContext, type ZlozAlignmentGuideContext, type ZlozResizeReadoutContext, zlozConnectionButton, zlozContextTrigger, type ZlozConnectionsContext, zlozContextAction, zlozContextDimensionInput, type ZlozContextMenuContext, zlozEdgeToolbarButton, zlozEdgePathStyleSelect, type ZlozEdgeToolbarContext, zlozEdgeLabelBadge, zlozEdgeLabelForm, zlozEdgeLabelInput, zlozEdgeLabelCancel, zlozViewportControl, zlozMinimap, zlozMinimapViewport, type ZlozMinimapContext, type ZlozViewportControlsContext, zlozNodeFrame, zlozGroupFrame, zlozDragHandle, zlozPort, zlozResizeHandle, zlozEdgeHitTarget, resolveZlozDiagnostics, type ZlozViewOptions, type ZlozViewLayoutParts, type ZlozBackground, type ZlozDiagnostics } from '@opsydyn/foldkit-zloz/foldkit';
import { createElkLayout } from '@opsydyn/foldkit-zloz-elk';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';

import type { HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
const externalEdge:ZlozEdge={id:'external-edge',source:{node:'a',port:'out'},target:{node:'b',port:'in'},label:'External relation'};
const graph: ZlozGraph = {nodes:[{id:'a',label:'External',position:{x:0,y:0},size:{width:100,height:80},ports:[{id:'out',kind:'output',side:'right',anchor:{x:0.75,y:0.25}}]},{id:'b',label:'Target',position:{x:300,y:0},size:{width:100,height:80},ports:[{id:'in',kind:'input',side:'left',anchor:{x:0.25,y:0.75}}]}],edges:[externalEdge]};
const packedLayoutEditor=createEditor(graph);
const packedLayout:ZlozSvgLayoutOptions={snapshot:captureSvgLayout(packedLayoutEditor,'packed-svg'),renderKey:'packed-svg'};
const packedSvgOptions={title:'Packed layout',region:{type:'model',padding:4},theme:{colorScheme:'light'},background:{type:'transparent'},font:{family:'sans-serif',size:14,weight:400},renderers:{nodes:'built-in',edges:'built-in'},layout:packedLayout} as const;
if(planSvgExport(packedLayoutEditor,packedSvgOptions).layout?.renderKey!=='packed-svg'||writeSvgExport(packedLayoutEditor,packedSvgOptions,{allowLosses:true}).type!=='written')throw new Error('Missing packed SVG layout planning contract');
const packedRouted={...packedLayoutEditor,routes:[{id:externalEdge.id,points:[{x:-200,y:0},{x:600,y:0}],label:{position:{x:500,y:-100},size:{width:200,height:40}}}]};
const packedRoutedOptions={...packedSvgOptions,layout:{snapshot:captureSvgLayout(packedRouted,'packed-svg'),renderKey:'packed-svg'}};
if(planSvgExport(packedRouted,packedRoutedOptions).contentBounds.width!==800||writeSvgExport(packedRouted,packedRoutedOptions,{allowLosses:true}).type!=='written')throw new Error('Packed retained route bounds/writer guard failed');
const packedVector:ZlozSvgAdapter={id:'packed-vector',version:'1',render:context=>context.kind==='edge'?[{type:'polyline',points:context.layoutRoute?.points??[context.source,context.target]},{type:'text',text:context.edge.label??'',position:context.labelBox?.position??context.geometry.labelPosition??context.source,baseline:'middle'}]:[{type:'rect',position:context.node.position,width:10,height:10}]};
const packedVectorResult=writeSvgExport(packedRouted,{...packedRoutedOptions,renderers:{nodes:'built-in',edges:'built-in',overrides:[{target:{kind:'edge',id:externalEdge.id},renderer:{type:'svg',id:'packed-vector',version:'1',bounds:{x:-200,y:-120,width:800,height:200},fidelity:'equivalent',reason:'Packed vector context'}}]}},{adapters:[packedVector]});
if(packedVectorResult.type!=='written'||!packedVectorResult.svg.includes('dominant-baseline="middle"'))throw new Error('Missing packed retained vector context/baseline');
const packedPngContext:ZlozPngReviewContext={scope:'packed-png',sourceRevision:0,snapshot:packedRouted,title:'Packed retained PNG',theme:{colorScheme:'light'},renderers:{nodes:'built-in',edges:'built-in'},layout:packedRoutedOptions.layout};
const packedPngState=createPngReview(packedPngContext.scope),packedPngControls=resolvePngReview(packedPngState,packedPngContext);
const packedPngAccepted=updatePngReview(packedPngState,packedPngContext,{...packedPngControls.identity,type:'PngLossAcceptanceChanged',accepted:true}).state;
const packedPngJob=updatePngReview(packedPngAccepted,packedPngContext,{...packedPngControls.identity,type:'PngRenderRequested'});
if(!packedPngJob.payload||packedPngJob.payload.input.svg.layout===packedPngContext.layout||packedPngJob.payload.input.svg.layout?.snapshot.routes[0]?.points[0]?.x!==-200||!Object.isFrozen(packedPngJob.payload.input.svg.layout?.snapshot.routes[0]?.points)||packedPngJob.payload.input.expectedSvg!==packedPngJob.payload.plan.svg)throw new Error('Missing packed immutable retained PNG job');


const patchSource={modelId:'consumer',sessionId:'consumer/1',revision:0,graph};
const proposal=captureModellingPatch({format:'foldkit-zloz-patch',version:1,id:'consumer-patch',source:patchSource,provenance:{actor:{kind:'tool',id:'consumer'},reason:'Packed preview',references:[]},operations:[{id:'rename',type:'node.replace',node:{...graph.nodes[0],label:'Reviewed'}}]});
const decodedProposal:ZlozModellingPatchParseResult=parseModellingPatch(JSON.stringify(proposal));
if(decodedProposal.status!=='parsed'||!Object.isFrozen(decodedProposal.value.operations)||decodedProposal.value.source.sessionId!=='consumer/1')throw new Error('Packed patch decoder failed');
const duplicateProposal=parseModellingPatch('{"version":1,"\\u0076ersion":1}');
if(duplicateProposal.status!=='rejected'||duplicateProposal.code!=='invalid-json'||duplicateProposal.path!=='/version')throw new Error('Packed duplicate-key guard failed');
const wideProposal=parseModellingPatch('['+Array(150001).fill(0).join(',')+']');
if(wideProposal.status!=='rejected'||wideProposal.code!=='limit-exceeded')throw new Error('Packed patch value budget failed');
const patchPreview=dryRunModellingPatch(patchSource,proposal);
if(patchPreview.type!=='reviewable'||patchPreview.graph.nodes[0]?.label!=='Reviewed'||patchPreview.losses[0]?.fields.join(',')!=='label'||graph.nodes[0]?.label!=='External'||!Object.isFrozen(patchPreview.patch.provenance))throw new Error('Packed modelling patch failed');
if(dryRunModellingPatch({...patchSource,revision:1},proposal).type!=='rejected')throw new Error('Packed patch freshness failed');
const patchEditor=createEditor(graph),patchReview=resolveModellingPatchReview(patchEditor,{modelId:patchSource.modelId,sessionId:patchSource.sessionId},proposal);
if(!patchReview.key)throw new Error('Missing packed review');
const patchApplied=applyModellingPatch(patchEditor,{modelId:patchSource.modelId,sessionId:patchSource.sessionId},proposal,{consent:{key:patchReview.key,reviewed:true,lossesAccepted:true}});
if(patchApplied.type!=='applied'||patchApplied.editor.past.length!==1||patchApplied.receipt.patch.id!=='consumer-patch'||updateEditor(patchApplied.editor,{type:'UndoPressed'}).graph.nodes[0]?.label!=='External')throw new Error('Packed atomic Apply failed');

const first=graph.nodes[0],firstPort=first?.ports[0];
if (!first || !firstPort || portAnchor(firstPort).x!==0.75 || portPosition(first,firstPort.id).x!==75 || portBoundaryPosition(first,firstPort.id).x!==100) throw new Error('Missing packed anchor geometry');
const movedPorts=updateEditor(createEditor(graph),{type:'PortPositionsChanged',positions:[{endpoint:{node:'a',port:'out'},position:{side:'right',anchor:{x:0.6,y:0.4}}}]});
if (movedPorts.graph.nodes[0]?.ports[0]?.anchor?.x!==0.6 || movedPorts.past.length!==1) throw new Error('Missing packed anchor editing');
const groupState=createEditor({nodes:[{id:'g',kind:'group',label:'Group',position:{x:0,y:0},size:{width:400,height:200},ports:[]}],edges:[]});
const packedHeader:LayoutGroupHeader={id:'g',size:{width:800,height:112},padding:{top:24,right:24,bottom:24,left:24},gap:24};
const headerMeasurement=startGroupHeaderMeasurement(groupState,'packed-heading-measurement','packed-renderer',[packedHeader]);
const measuredHeaderState=updateGroupHeaderMeasurements(groupState,headerMeasurement,'packed-renderer',{type:'measured',requestId:'packed-heading-measurement',revision:0,renderKey:'packed-renderer',headers:[{id:'g',size:{width:321.75,height:90.5}}]});
const measuredHeaderContext=resolveGroupHeaderMeasurements(groupState,measuredHeaderState,'packed-renderer');
if(measuredHeaderContext.type!=='ready'||measuredHeaderContext.groupHeaders[0]?.size.width!==321.75||resolveGroupHeaderMeasurements(groupState,measuredHeaderState,'changed-renderer').type!=='unavailable')throw new Error('Missing packed heading measurement contract');
const packedHeaderRequest=layoutRequest(groupState,'packed-header',{groupHeaders:[packedHeader]});
const packedHeaderResult=await createElkLayout({direction:'DOWN'})(packedHeaderRequest);
const packedHeaderLayout=applyLayout(groupState,packedHeaderRequest,packedHeaderResult);
const packedHeaderNode=packedHeaderLayout.graph.nodes[0];
if(!packedHeaderNode||packedHeaderNode.size.width<848||resolveLayoutGroupHeader(packedHeaderNode,packedHeader).contentPadding.top!==160||packedHeaderLayout.past.length!==1)throw new Error('Missing packed group header reservation');
const sized=updateEditor(groupState,{type:'GroupDimensionChanged',id:'g',dimension:'height',value:240});
if (sized.graph.nodes[0]?.size.height!==240) throw new Error('Missing packed dimension editing');
const quiet:ZlozDiagnostics=resolveZlozDiagnostics({minimalMode:true,diagnostics:{measurements:true}});
if (Object.values(quiet).some(Boolean)) throw new Error('Minimal mode did not override diagnostics');
const state=createEditor(graph,{gridSpacing:32});
const request=layoutRequest(state,'consumer');
const layout=await createElkLayout()(request);
const arranged=applyLayout(state,request,layout);
const readonlyPreview=createEditor(graph,{readOnly:true}),previewRequest=layoutRequest(readonlyPreview,'preview-consumer',{edgeLabels:graph.edges.map(e=>({id:e.id,size:{width:176,height:36}}))});
const previewResult=await createElkLayout()(previewRequest);
const previewLayout=applyPreviewLayout(readonlyPreview,previewRequest,previewResult);
if(previewLayout.routes.some(r=>r.label?.size.width!==176||!Number.isFinite(r.label.position.x)))throw new Error('Missing packed label envelope');
if(!previewLayout.readOnly||previewLayout.revision!==1||previewLayout.past!==readonlyPreview.past||previewLayout.future!==readonlyPreview.future||previewLayout.graph.edges!==readonlyPreview.graph.edges||previewLayout.routes.length!==graph.edges.length)throw new Error('Missing geometry-only preview layout');

const policy:ZlozEdgeGeometryPolicy=({source,target})=>({path:'M'+source.x+','+source.y+' L'+target.x+','+target.y,labelPosition:{x:(source.x+target.x)/2,y:(source.y+target.y)/2}});
const geometry=resolveEdgeGeometry(arranged.graph,externalEdge,{policy});
const measuredLabels=startLabelMeasurement(readonlyPreview,'packed-measurement','packed-renderer');
if(measuredLabels.type!=='pending')throw new Error('Missing packed measurement request');
const acceptedLabels=updateLabelMeasurements(readonlyPreview,measuredLabels,'packed-renderer',{type:'measured',requestId:'packed-measurement',revision:0,renderKey:'packed-renderer',labels:graph.edges.map(e=>({id:e.id,size:{width:135.75,height:36.5}}))});
if(resolveLabelMeasurements(readonlyPreview,acceptedLabels,'packed-renderer').type!=='ready'||resolveLabelMeasurements(readonlyPreview,acceptedLabels,'changed-renderer').type!=='unavailable')throw new Error('Missing packed measurement freshness');
const previewPolicy:ZlozConnectionGeometryPolicy=({source,target})=>({path:'M'+source.x+','+source.y+' L'+target.x+','+target.y,labelPosition:undefined});
const dragging=updateEditor(arranged,{type:'ConnectionDragStarted',endpoint:{node:'a',port:'out'},pointer:1,point:{x:100,y:80}});
const preview=resolveConnectionPreview(dragging,previewPolicy);
if (!preview || preview.feedback.type!=='free') throw new Error('Missing packed connection preview resolver');
const previewOptions:ZlozViewOptions<EditorEvent>={labelMeasurement:{request:measuredLabels.request,onMeasured:()=>({type:'SelectionCleared'})},id:'external-preview',label:'External preview',onEvent:event=>event,connectionGeometry:previewPolicy,renderConnection:(context,builder)=>builder.path([builder.D(context.path),builder.Stroke(context.stroke),builder.DataAttribute('packed-preview','')],[])};
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
if(!result.html.includes('data-zloz-label-measurement-scope=')||!result.html.includes('data-zloz-measured-label='))throw new Error('Missing packed opt-in measurement hooks');
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
const dddNode=createArchitectureNode({id:'order',label:'Packed order',position:{x:20,y:90},size:{width:240,height:180},ports:[],architecture:{family:'ddd',role:'aggregate-root'}});
const dddGroup=createArchitectureNode({id:'aggregate',kind:'group',label:'Packed aggregate',position:{x:0,y:0},size:{width:400,height:350},ports:[],architecture:{family:'ddd',role:'aggregate'}});
const dddOptions:ZlozDddNodeOptions<EditorEvent>={groupHeader:{...packedHeader,id:'aggregate'},bodyCache:createZlozNodeBodyCache(),renderBadge:({architecture},builder)=>builder.span([],['Custom '+architecture.role]),renderSubdomain:()=>null};
const dddOutput=await Effect.runPromise(renderToString({Flags:Schema.Struct({}),init:()=>({model:createEditor({nodes:[{...dddNode,parentId:'aggregate'},dddGroup],edges:[]})}),view:(model,h:HtmlBuilder<EditorEvent>)=>({title:'Packed DDD',body:zlozView(h,model,{id:'packed-ddd',label:'Packed DDD',onEvent:event=>event,renderNodeShell:(context,builder)=>zlozDddNode(context,builder,dddOptions),renderGroupShell:(context,builder)=>zlozDddGroup(context,builder,dddOptions)})})},{flags:{},isHydratable:false}));
if(!dddOutput.html.includes('data-flow-ddd-node=') || !dddOutput.html.includes('data-flow-ddd-group=') || !dddOutput.html.includes('Custom aggregate-root') || !dddOutput.html.includes('Select Packed order')) throw new Error('Missing packed DDD renderer contract');
const causal=createEventStormingPattern({includeAggregate:true});
const causalFirst=causal.edges[0];
if(!causalFirst || resolveEventStormingRelationship(causal,causalFirst).type!=='allowed')throw new Error('Missing packed causal convention');
const audited:ZlozEventStormingRelationshipAudit=auditEventStormingRelationships(causal);
const auditComparison:ZlozRelationshipAuditComparisonDecision=compareModelEventStormingRelationships({id:'audit-model',name:'Audit model',snapshot:{graph:causal},origin:null,editions:[{id:'base',name:'Base',snapshot:{graph:causal}}]},{baselineId:'base'});
if(auditComparison.type!=='compared'||auditComparison.comparison.selected.source.kind!=='current'||auditComparison.comparison.summary.introduced!==0)throw new Error('Missing packed audit comparison types');
const typedAudit=audited.entries.find(entry=>entry.status==='typed');
if(audited.status!=='compatible'||!typedAudit||typedAudit.architecture.role!=='issues')throw new Error('Missing packed audit contract');
const auditControlContext:ZlozAuditComparisonControlsContext=resolveAuditComparisonControls({id:'controls',name:'Controls',origin:null,snapshot:{graph:{...causal,edges:[{...causalFirst,architecture:{family:'event-storming',role:'triggers'}}]}},editions:[{id:'base',name:'Base',snapshot:{graph:causal}}]},{baselineId:'base',selectedId:null,filters:{introduced:true,resolved:true,persisting:true}},{focusReason:()=> 'Protected audit focus'});
const auditControlOptions:ZlozAuditComparisonViewOptions<EditorEvent>={renderEntry:(entry,h,onRequest)=>h.li([],[zlozAuditFindingButton(h,entry,onRequest,[],['Packed audit badge'])])};
const auditControlOutput=await Effect.runPromise(renderToString({Flags:Schema.Struct({}),init:()=>({model:auditControlContext}),view:(context,h:HtmlBuilder<EditorEvent>)=>({title:'Packed audit controls',body:zlozAuditComparisonControls(h,context,():EditorEvent=>({type:'SelectionCleared'}),auditControlOptions)})},{flags:{},isHydratable:false}));
if(!auditControlOutput.html.includes('Packed audit badge')||!auditControlOutput.html.includes('Protected audit focus')||!auditControlOutput.html.includes('Audit baseline'))throw new Error('Missing packed audit controls view');
if(resolveEventStormingRelationshipRequest(createEditor(causal),causalFirst.id,{type:'RelationshipSelected',edgeId:causalFirst.id,key:null}).type!=='ready')throw new Error('Missing packed relationship request');
const causalArchitecture:EventStormingEdgeArchitecture={family:'event-storming',role:'custom',name:'approves'};
const causalEditor=updateEditor(createEditor(causal),{type:'EdgeArchitectureChanged',id:causalFirst.id,architecture:null},eventStormingRelationshipPolicy());
if(causalEditor.past.length!==1 || updateEditor(causalEditor,{type:'UndoPressed'}).graph.edges[0]?.architecture?.role!=='issues'||causalArchitecture.name!=='approves')throw new Error('Missing packed semantic Undo');
const stormNote=createArchitectureNode({id:'placed',label:'Packed event',position:{x:0,y:0},size:{width:220,height:160},ports:[],architecture:{family:'event-storming',role:'domain-event'}});
const stormOptions:ZlozEventStormingNodeOptions<EditorEvent>={bodyCache:createZlozNodeBodyCache(),renderType:({architecture},builder)=>builder.span([],['Custom '+architecture.role])};
const stormOutput=await Effect.runPromise(renderToString({Flags:Schema.Struct({}),init:()=>({model:createEditor({nodes:[stormNote],edges:[]})}),view:(model,h:HtmlBuilder<EditorEvent>)=>({title:'Packed workshop',body:zlozView(h,model,{id:'packed-workshop',label:'Packed workshop',onEvent:event=>event,renderNodeShell:(context,builder)=>zlozEventStormingNode(context,builder,stormOptions),theme:{tokens:{eventStormingEvent:'var(--host-event)'}}})})},{flags:{},isHydratable:false}));
if(!stormOutput.html.includes('data-zloz-event-storming-node=')||!stormOutput.html.includes('Custom domain-event')||!stormOutput.html.includes('--flow-event-storming-event: var(--host-event)'))throw new Error('Missing packed event-storming renderer');
// @ts-expect-error added changes must carry the new node
const invalidHistoryChange:ZlozHistoryChange<ZlozNode>={id:'x',kind:'added',before:null,after:null,semanticChanged:true,layoutChanged:true};
const edition=captureEdition({id:'first',name:'First',snapshot:{graph:{nodes:[dddNode],edges:[]}}});
const nextEdition=captureEdition({id:'next',name:'Next',snapshot:{graph:{nodes:[{...dddNode,position:{x:400,y:90}}],edges:[]}}});
const archive=parseEditions(serializeEditions(appendEdition([edition],nextEdition)));
if(archive.length!==2 || !Object.isFrozen(archive[0]?.snapshot.graph)) throw new Error('Missing packed immutable edition archive');
// @ts-expect-error restoration requires the caller's expected working revision
const invalidRestoreOptions:ZlozEditionRestoreOptions={};
const emptyWorking=createEditor({nodes:[],edges:[]});
if(resolveEditionRestore(emptyWorking,edition,{expectedRevision:0}).type!=='ready') throw new Error('Missing packed restore preview');
const restoredEdition=restoreEdition(emptyWorking,edition,{expectedRevision:0});
if(restoredEdition.type!=='restored' || restoredEdition.editor.past.length!==1 || updateEditor(restoredEdition.editor,{type:'UndoPressed'}).graph.nodes.length!==0) throw new Error('Missing packed undoable restore');
if(mergeEditions([edition],[edition,nextEdition]).type!=='merged') throw new Error('Missing packed additive edition import');
const modelDocument:ZlozModelDocument=captureModelDocument({id:'source-model',name:'Source',snapshot:edition.snapshot,editions:[edition],origin:null});
const forked=forkEdition(modelDocument,'first',{id:'fork-model',name:'Alternative'});
if(forked.type!=='forked') throw new Error('Missing packed edition fork');
const decodedFork=parseModelDocument(serializeModelDocument(forked.document));
const forkEditor=createModelEditor(decodedFork);
if(decodedFork.origin?.modelId!=='source-model' || forkEditor.past.length || forkEditor.readOnly || decodedFork.editions.length) throw new Error('Missing independent model lineage/session');
const rewind=createHistoryReview(edition,createEditor({nodes:[dddNode],edges:[]}));
if(updateHistoryReview(rewind,{type:'DeletePressed'})!==rewind || !rewind.editor.readOnly) throw new Error('Historical editing escaped');
const comparison=compareEditions(edition,nextEdition);
const navigatorContext=resolveHistoryChangeNavigator(comparison);
const navigatorEntry=navigatorContext.entries[0];
const fittedBounds=fitNodes([dddNode],{width:800,height:600},24,{minZoom:0.1,maxZoom:4});
if(!Number.isFinite(fittedBounds.zoom))throw new Error('Missing packed bounds fitter');
if(!navigatorEntry || resolveHistoryChangeFocus(comparison,navigatorEntry.request).type!=='ready')throw new Error('Missing packed focus request');
const dddReviewModel=parseModelDocument(${JSON.stringify(JSON.stringify(dddReviewWire))});
const dddReviewContext=resolvePackedDddControls(dddReviewModel,{baselineId:'ddd-before',selectedId:'ddd-after',filters:{introduced:true,resolved:true,persisting:true}});
const dddReviewOutput=await Effect.runPromise(renderToString({Flags:Schema.Struct({}),init:()=>({model:dddReviewContext}),view:(context,h:HtmlBuilder<ZlozDddAuditRequest>)=>({title:'DDD',body:zlozDddAuditControls(h,context,r=>r,{showCounts:false,renderEntry:(entry,builder,onRequest)=>builder.li([],[zlozDddAuditFindingButton(builder,entry,onRequest,[],['Packed DDD finding'])])})})},{flags:{},isHydratable:false}));
if(!dddReviewOutput.html.includes('Packed DDD finding')||!dddReviewOutput.html.includes('DDD baseline')||dddReviewOutput.html.includes('2 introduced'))throw new Error('Missing packed DDD view contract');
const workshopEditor={...createEditor(packedWorkshopPattern()),selectedNodes:['retry-question']};
const workshopControls=packedWorkshopControls(workshopEditor,'retry-question');
const workshopOutput=await Effect.runPromise(renderToString({Flags:Schema.Struct({}),init:()=>({model:workshopEditor}),view:(model,h:HtmlBuilder<PackedWorkshopRequest>)=>({title:'Workshop',body:h.div([],[zlozView(h,model,{id:'packed-workshop',label:'Workshop',onEvent:():PackedWorkshopRequest=>({...workshopControls.scope!,type:'StatusSelected',value:'open'}),renderNodeShell:(c,b)=>packedWorkshopNode(c,b,{renderStatus:(ctx,builder)=>ctx.architecture.role==='hotspot'?builder.span([],['Packed status']):null}),renderGroupShell:(c,b)=>packedWorkshopGroup(c,b)})])})},{flags:{},isHydratable:false}));
if(!workshopOutput.html.includes('Packed status')||!workshopOutput.html.includes('zloz-event-storming-group'))throw new Error('Packed workshop artwork/controls missing');
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

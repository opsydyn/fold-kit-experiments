import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import coreManifest from '../../foldkit-zloz/package.json';
import groupV3Wire from '../../foldkit-zloz/test/fixtures/group-document-v3-ported.json';
import manifest from '../package.json';
const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const options = { cwd: root, maxBuffer: 5 * 1024 * 1024 };

test('packed adapter installs in a clean npm consumer and runs in Node and Bun', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'foldkit-zloz-mermaid-consumer-'));
  // Native process fixture cleanup must run even when npm or TypeScript fails.
  // oxlint-disable-next-line linteffect/no-try-catch
  try {
    await exec('bun', ['run', '--filter', manifest.name, 'pack:check'], options);
    const adapter = path.join(
      root,
      'packages/foldkit-zloz-mermaid/dist/pack',
      `opsydyn-foldkit-zloz-mermaid-${manifest.version}.tgz`,
    );
    for (const name of ['foldkit-zloz'])
      await exec('bun', ['pm', 'pack', '--destination', directory], {
        ...options,
        cwd: path.join(root, 'packages', name),
      });
    const core = path.join(directory, `opsydyn-foldkit-zloz-${coreManifest.version}.tgz`);
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    await exec(
      'npm',
      ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', core, adapter],
      {
        ...options,
        cwd: directory,
      },
    );
    for (const name of [
      'astro',
      '@effect/ui',
      'react',
      'foldkit',
      'effect',
      'elkjs',
      'mermaid',
      'mermaid-ast',
      '@mermaid-js/parser',
    ])
      expect(existsSync(path.join(directory, 'node_modules', name))).toBe(false);

    const viewEntry = await exec(
      'node',
      [
        '--input-type=module',
        '-e',
        "import { groupMermaidReviewV3 } from '@opsydyn/foldkit-zloz-mermaid/effect-ui'; console.log(typeof groupMermaidReviewV3)",
      ],
      { ...options, cwd: directory },
    );
    expect(viewEntry.stdout.trim()).toBe('function');
    const viewTypes = await readFile(
      path.join(directory, 'node_modules/@opsydyn/foldkit-zloz-mermaid/dist/effect-ui.d.mts'),
      'utf8',
    );
    expect(viewTypes).toMatch(/from ["']@effect\/ui\/html["']/);

    const source = `import { createEditor, createModelEditorV2 } from '@opsydyn/foldkit-zloz';
import { createReviewPacketV2, parseReviewPacketV2, openReviewPacketV2, createReviewReader, updateReviewReader, resolveReviewReader, parseReviewPacket, type ZlozReviewPacketParseResult, resolveReviewPacketControls, resolveReviewPacketRequest, createReviewPacket, type ZlozReviewPacketResult, exportConnectionMermaid, type MermaidExportResultV2, exportMermaid, type MermaidExportResult } from '@opsydyn/foldkit-zloz-mermaid';
const editor = createEditor({ nodes: [{ id: 'end', label: 'Consumer', position: {x:0,y:0}, size: {width:200,height:100}, ports: [] }], edges: [] });
const result: MermaidExportResult = exportMermaid(editor.graph, { lossPolicy: 'report' });
if (result.status !== 'converted' || result.value.identity.nodes[0]?.flowId !== 'end' || !result.value.source.includes('n_65_6e_64["Consumer"]')) throw new Error('Export failed');
if (exportMermaid(editor.graph).status !== 'rejected' || editor.past.length !== 0) throw new Error('Loss/history contract failed');
const modeProjection:MermaidExportResultV2=exportConnectionMermaid({version:2,connectionMode:'loose',graph:editor.graph},{lossPolicy:'report'});
if(modeProjection.status!=='converted'||modeProjection.value.connectionMode!=='loose'||modeProjection.value.protocol!=='foldkit-zloz-mermaid/v2'||!modeProjection.diagnostics.some(d=>d.code==='connection-mode-omitted'))throw new Error('Explicit v2 projection failed');
const nativePacketModel={id:'native-packet',name:'Native packet',origin:null,snapshot:{version:2 as const,connectionMode:'loose' as const,graph:editor.graph},editions:[{id:'base',name:'Base',snapshot:{version:2 as const,connectionMode:'strict' as const,graph:editor.graph}}]};
const nativePacket=createReviewPacketV2(nativePacketModel,{baselineId:'base'},{lossPolicy:'report'});
if(nativePacket.status!=='created')throw new Error('Native packet creation failed');
const nativePacketText=JSON.stringify(nativePacket.value), nativeReopened=parseReviewPacketV2(nativePacketText);
if(nativeReopened.status!=='parsed'||nativeReopened.value.selected.snapshot.connectionMode!=='loose'||parseReviewPacket(nativePacketText).status!=='rejected')throw new Error('Native packet compatibility failed');
const nativeWorking=createModelEditorV2(nativePacketModel),nativeOpened=openReviewPacketV2(nativePacketText,'selected',nativeWorking);
if(nativeOpened.status!=='opened'||!nativeOpened.review.editor.readOnly||nativeOpened.review.editor.connectionMode!=='loose'||nativeWorking.past.length)throw new Error('Native packet read-only history failed');
const nested = exportMermaid({ nodes: [
 { id: 'outer', kind: 'group', label: 'Outer', position: {x:0,y:0}, size: {width:400,height:300}, ports: [] },
 { id: 'inner', kind: 'group', parentId: 'outer', label: 'Inner', position: {x:10,y:10}, size: {width:300,height:200}, ports: [] },
 { id: 'leaf', parentId: 'inner', label: 'Leaf', position: {x:20,y:20}, size: {width:100,height:80}, ports: [] }
], edges: [] }, { lossPolicy: 'report' });
if (nested.status !== 'converted' || nested.value.identity.nodes[1]?.kind !== 'group' || nested.value.identity.nodes[1]?.parentId !== 'outer' || !nested.value.source.includes('subgraph')) throw new Error('Nested contract failed');
const packet: ZlozReviewPacketResult = createReviewPacket({id:'review',name:'Review',origin:null,snapshot:{graph:editor.graph},editions:[{id:'base',name:'Base',snapshot:{graph:editor.graph}}]},{baselineId:'base'},{lossPolicy:'report'});
if(packet.status!=='created'||packet.value.baseline.source.id!=='base'||packet.value.format!=='foldkit-zloz-review'||packet.value.conventions.rules.length!==6||packet.value.projections.selected.direction!=='LR')throw new Error('Review packet contract failed');
const portable=JSON.parse(JSON.stringify(packet.value)); if(portable.selected.snapshot.graph.nodes[0].id!=='end')throw new Error('Packet portability failed');
const opened:ZlozReviewPacketParseResult=parseReviewPacket(JSON.stringify(packet.value));
if(opened.status!=='parsed'||!Object.isFrozen(opened.value)||opened.value.selected.snapshot.graph.nodes[0]?.id!=='end')throw new Error('Packet decoder failed');
const reader=createReviewReader('consumer/1');
const pending=updateReviewReader(reader,{scope:reader.scope,type:'ReadRequested',file:{name:'packet.json',byteLength:JSON.stringify(packet.value).length}});
const read=updateReviewReader(pending.state,{scope:reader.scope,type:'ReadSucceeded',run:1,text:JSON.stringify(packet.value)});
if(!pending.read||resolveReviewReader(read.state).snapshot?.graph.nodes[0]?.id!=='end')throw new Error('Packed reader failed');
const tooWide=parseReviewPacket('['+Array(150001).fill(0).join(',')+']');
if(tooWide.status!=='rejected'||tooWide.code!=='limit-exceeded')throw new Error('Packet size guard failed');
const forged=JSON.parse(JSON.stringify(packet.value));forged.projections.selected.source+=' changed';
if(parseReviewPacket(JSON.stringify(forged)).status!=='rejected')throw new Error('Packet consistency guard failed');

const doc={id:'preview',name:'Preview',origin:null,snapshot:{graph:editor.graph},editions:[{id:'base',name:'Base',snapshot:{graph:editor.graph}}]};
const selection={baselineId:'base',selectedId:null}, state={consentKey:null};
const preview=resolveReviewPacketControls(doc,selection,state); if(!preview.key||!preview.requiresConsent)throw new Error('Missing packet preview');
if(resolveReviewPacketRequest(doc,selection,state,{type:'DownloadClicked',key:preview.key}).type!=='blocked')throw new Error('Missing packet consent guard');
import {captureGroupDocumentV3} from '@opsydyn/foldkit-zloz';
import {createReviewPacketV3,parseReviewPacketV3,openReviewPacketV3,exportGroupMermaidV3,createGroupMermaidReviewV3,resolveGroupMermaidReviewV3,updateGroupMermaidReviewV3,type MermaidBundleV3} from '@opsydyn/foldkit-zloz-mermaid';
const nativeDocument=captureGroupDocumentV3(${JSON.stringify(groupV3Wire)});
const nativeResult=exportGroupMermaidV3(nativeDocument,{lossPolicy:'report'});
if(nativeResult.status!=='converted'||nativeResult.value.identity.version!==3||nativeResult.value.identity.nodes.find(n=>n.nodeId==='g')?.ports[0]?.id!=='out'||!nativeResult.diagnostics.some(d=>d.code==='group-port-attachment-omitted'))throw new Error('Missing native group projection');
const packetV3=createReviewPacketV3({id:'installed-v3',name:'Native',origin:null,snapshot:nativeDocument,editions:[{id:'base-v3',name:'Base',snapshot:nativeDocument}]},{baselineId:'base-v3'},{lossPolicy:'report'});
if(packetV3.status!=='created')throw new Error('Native packet not created');
const packetV3Text=JSON.stringify(packetV3.value),decodedV3=parseReviewPacketV3(packetV3Text),openedV3=openReviewPacketV3(packetV3Text,'selected','installed-review');
if(decodedV3.status!=='parsed'||parseReviewPacketV2(packetV3Text).status!=='rejected'||openedV3.status!=='opened'||!openedV3.review.editor.readOnly||openedV3.review.editor.history.past.length!==0||openedV3.review.editor.document.graph.nodes.find(n=>n.id==='g')?.ports[0]?.id!=='out')throw new Error('Installed native v3 packet capability/read-only contract missing');
const nativeBundle:MermaidBundleV3=nativeResult.value;
const nativeContext={scope:'consumer-native',sourceRevision:0,document:nativeDocument}, nativeState=createGroupMermaidReviewV3(nativeContext.scope),nativeControls=resolveGroupMermaidReviewV3(nativeState,nativeContext);
const nativeAccepted=updateGroupMermaidReviewV3(nativeState,nativeContext,{...nativeControls.identity,type:'MermaidLossAcceptanceChanged',accepted:true}).state;
const nativeDownload=updateGroupMermaidReviewV3(nativeAccepted,nativeContext,{...nativeControls.identity,type:'MermaidDownloadRequested'});
if(!nativeDownload.payload||nativeDownload.payload.text!==JSON.stringify(nativeBundle,null,2)+'\\n'||updateGroupMermaidReviewV3(nativeAccepted,{...nativeContext,canDownload:()=> 'Locked'},{...nativeControls.identity,type:'MermaidDownloadRequested'}).payload)throw new Error('Missing exact reviewed native payload');
// @ts-expect-error Legacy bundles cannot substitute for native metadata.
const oldAsNative:MermaidBundleV3=result.value;void oldAsNative;
console.log('mermaid-consumer-ok');
`;
    const consumer = path.join(directory, 'consumer.ts');
    await writeFile(consumer, source);
    const tsc = path.join(root, 'packages/foldkit-zloz-mermaid/node_modules/.bin/tsc');
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
    for (const runtime of ['node', 'bun']) {
      const result = await exec(runtime, [path.join(directory, 'compiled/consumer.js')], {
        ...options,
        cwd: directory,
      });
      expect(result.stdout.trim()).toBe('mermaid-consumer-ok');
    }
    // The optional view entry must also work from the installed tarball, without coupling the root to Foldkit.
    await exec(
      'npm',
      [
        'install',
        '--offline',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        'foldkit@0.170.0',
        'effect@4.1.0',
        '@effect/platform-browser@4.1.0',
      ],
      { ...options, cwd: directory },
    );
    const viewSource = `import {zlozGroupMermaidReviewV3} from '@opsydyn/foldkit-zloz-mermaid/foldkit';
import {Effect,Schema} from 'effect';
import {renderToString} from 'foldkit/experimental/server';
import type {HtmlBuilder} from 'foldkit/html';
import {captureGroupDocumentV3} from '@opsydyn/foldkit-zloz';
import {createGroupMermaidReviewV3,resolveGroupMermaidReviewV3,type ZlozGroupMermaidReviewRequestV3} from '@opsydyn/foldkit-zloz-mermaid';
import { zlozReviewReader, zlozReviewPacketControls, zlozReviewPacketConsent, zlozReviewPacketDownload, type ZlozReviewPacketViewOptions } from '@opsydyn/foldkit-zloz-mermaid/foldkit';
const options:ZlozReviewPacketViewOptions<unknown>={showCounts:false,renderStatus:()=>null};
if([zlozReviewReader,zlozReviewPacketControls,zlozReviewPacketConsent,zlozReviewPacketDownload].some(value=>typeof value!=='function')||options.showCounts!==false)throw new Error('Missing packed view contract');
const nativeControls=resolveGroupMermaidReviewV3(createGroupMermaidReviewV3('installed'),{scope:'installed',sourceRevision:0,document:captureGroupDocumentV3(${JSON.stringify(groupV3Wire)})});
const nativeHtml=await Effect.runPromise(renderToString({Flags:Schema.Struct({}),init:()=>({model:nativeControls}),view:(model,h:HtmlBuilder<ZlozGroupMermaidReviewRequestV3>)=>({title:'Native Mermaid',body:zlozGroupMermaidReviewV3(h,model,r=>r,{id:'installed-review',minimalMode:true})})},{flags:{},isHydratable:false}));
if(!nativeHtml.html.includes('Download Mermaid bundle')||!nativeHtml.html.includes('authored socket')||!nativeHtml.html.includes('language-mermaid'))throw new Error('Installed native source review SSR failed');
console.log('mermaid-view-consumer-ok');`;
    const viewFile = path.join(directory, 'view.mts');
    await writeFile(viewFile, viewSource);
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
          viewFile,
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
        viewFile,
      ],
      { ...options, cwd: directory },
    );
    for (const runtime of ['node', 'bun'])
      expect(
        (
          await exec(runtime, [path.join(directory, 'compiled/view.mjs')], {
            ...options,
            cwd: directory,
          })
        ).stdout.trim(),
      ).toBe('mermaid-view-consumer-ok');
    const contents = await exec('tar', ['-tzf', adapter], options);
    for (const file of ['LICENSE', 'README.md', 'CHANGELOG.md', 'THIRD-PARTY-NOTICES.md'])
      expect(contents.stdout).toContain(`package/${file}`);
    expect(contents.stdout).not.toMatch(/package\/(src|test|node_modules|dist\/pack)\//);
    const packedManifest = await readFile(
      path.join(directory, 'node_modules/@opsydyn/foldkit-zloz-mermaid/package.json'),
      'utf8',
    );
    expect(packedManifest).not.toMatch(/workspace:|catalog:/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 180_000);

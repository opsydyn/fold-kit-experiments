import {
  captureModelDocumentV3,
  planModelDocumentDowngradeV3,
  type ZlozModelDocumentV3,
  type ZlozModelDowngradeFindingV3,
} from './model-document-v3';
export type ZlozPortableCompatibilityV3 = Readonly<{
  scope: 'format-capability-only';
  version: 3;
  modelId: string;
  checkpoints: readonly Readonly<{
    path: string;
    connectionMode: 'strict' | 'loose';
    groupPorts: boolean;
    authoredGroupPortCount: number;
  }>[];
  adapters: readonly Readonly<{
    adapter:
      | 'native-controls'
      | 'model'
      | 'editions'
      | 'clipboard'
      | 'layout'
      | 'svg'
      | 'png'
      | 'mermaid'
      | 'modelling-patch'
      | 'conversion-receipt'
      | 'review-packet'
      | 'relationship-audit';
    status: 'supported' | 'requires-version';
    reason: string;
  }>[];
  downgrade: Readonly<{
    type: 'blocked' | 'reviewable';
    findings: readonly ZlozModelDowngradeFindingV3[];
  }>;
  limits: readonly string[];
}>;
/** Exact per-checkpoint capability inventory. A compatibility report never grants permission or performs a conversion. */
export function assessPortableCompatibilityV3(
  input: ZlozModelDocumentV3,
): ZlozPortableCompatibilityV3 {
  const source = captureModelDocumentV3(input),
    downgrade = planModelDocumentDowngradeV3(source);
  const checkpoints = [
    { path: '/snapshot', snapshot: source.snapshot },
    ...source.editions.map((edition, index) => ({
      path: `/editions/${index}/snapshot`,
      snapshot: edition.snapshot,
    })),
    ...(source.origin
      ? [{ path: '/origin/edition/snapshot', snapshot: source.origin.edition.snapshot }]
      : []),
  ].map(({ path, snapshot }) =>
    Object.freeze({
      path,
      connectionMode: snapshot.connectionMode,
      groupPorts: snapshot.capabilities.groupPorts,
      authoredGroupPortCount: snapshot.graph.nodes
        .filter((n) => n.kind === 'group')
        .reduce((count, n) => count + n.ports.length, 0),
    }),
  );
  const adapters: ZlozPortableCompatibilityV3['adapters'] = [
    {
      adapter: 'native-controls',
      status: 'supported',
      reason:
        'Use the distinct v3 workbench/controller and live planners. Pointer movement, resize, port-anchor editing and reconnection, keyboard alternatives, box selection and opt-in pinch use live source-bound planners; collapse and group-port inspector edits are supported.',
    },
    {
      adapter: 'model',
      status: 'supported',
      reason:
        'Native v3 canonical codecs retain every checkpoint capability, mode and camera. Initialization allocates a distinct v3 session.',
    },
    {
      adapter: 'editions',
      status: 'supported',
      reason:
        'Native v3 archives, detached read-only review, comparison, restore, additive merge and provenance-preserving fork retain checkpoint capabilities.',
    },
    {
      adapter: 'layout',
      status: 'supported',
      reason:
        'Use groupLayoutRequestV3, the optional createElkGroupLayoutV3 engine and applyGroupLayoutV3/applyGroupWorkbenchLayoutV3. Full-document freshness, authored group ports, live protections and one Undo are retained. Legacy layout entries remain version-fixed.',
    },
    {
      adapter: 'svg',
      status: 'supported',
      reason:
        'Use the distinct full-document native v3 planner/writer/review. Group ports, endpoint anchors, explicit bounds/themes and optional validated routes are supported; custom artwork needs declared adapters or explicit loss acceptance. SVG is a static projection, not a model codec.',
    },
    {
      adapter: 'png',
      status: 'supported',
      reason:
        'Use native v3 PNG planning/review and the optional /browser renderGroupPngExportV3. The exact native SVG projection and findings are retained, with explicit rasterization consent, bounded browser output and source/policy checks. Pixels do not retain editable model semantics.',
    },
    {
      adapter: 'clipboard',
      status: 'supported',
      reason:
        'Use copyGroupSelectionV3 and the distinct native paste request/planner/Apply. Explicit node/edge/scoped-port maps, full-source freshness and live policies retain one Undo. Cross-mode/capability paste requires explicit conversion; no OS clipboard IO is implied.',
    },
    {
      adapter: 'mermaid',
      status: 'supported',
      reason:
        'Use the optional Mermaid package native v3 exporter and exact-output review controls. Full documents retain mode/capability in the native bundle, while group socket artwork and exact attachment are explicit losses. Legacy exporters remain version-fixed; the CLI selects the declared native exporter by envelope version. No production import is implied.',
    },
    {
      adapter: 'modelling-patch',
      status: 'supported',
      reason:
        'Use capture/parse/dryRunModellingPatchV3 and the source-bound native review/Apply APIs. Exact consent, live protection, strict recomputed receipts and one complete-document Undo are retained.',
    },
    {
      adapter: 'conversion-receipt',
      status: 'supported',
      reason:
        'Use native v3 C4/DDD mapping, plans, exact loss consent and atomic Apply. Strict portable receipts preserve every checkpoint and are read-only evidence when reopened; they grant no live editing authority.',
    },
    {
      adapter: 'review-packet',
      status: 'supported',
      reason:
        'Use create/parse/openReviewPacketV3 in the optional Mermaid package. Native audit deltas and explicit group-port projection losses are recomputed before independent read-only reopening.',
    },
    {
      adapter: 'relationship-audit',
      status: 'supported',
      reason:
        'Use auditGroupDddRelationshipsV3/auditGroupEventStormingRelationshipsV3 and native edition comparisons. Full document validation retains capabilities and each checkpoint mode; the Effect CLI selects declared native codecs by version.',
    },
  ];
  return Object.freeze({
    scope: 'format-capability-only',
    version: 3,
    modelId: source.id,
    checkpoints: Object.freeze(checkpoints),
    adapters: Object.freeze(adapters.map((a) => Object.freeze(a))),
    downgrade: Object.freeze({ type: downgrade.type, findings: downgrade.findings }),
    limits: Object.freeze([
      'World coordinates, explicit group parents and rectangular group envelopes are intentional conventions.',
      'Rotation, lasso/freehand/eraser, dedicated multi-connect UI, production Mermaid import and server PNG remain outside this release. Atomic explicit connection sets are available headlessly.',
      'V1/v2 package editor/render/layout/export entries remain version-fixed. Never pass a bare v3 graph to them to evade capability validation.',
      'Screen-reader and physical-device human acceptance and broad performance qualification are not established by unit tests or browser emulation.',
    ]),
  });
}

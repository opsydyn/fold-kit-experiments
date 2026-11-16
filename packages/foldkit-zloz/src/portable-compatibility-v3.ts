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
        'Use the distinct v3 workbench/controller and live planners. Pointer node movement and connections, keyboard selection/nudging/connections, inspector resizing, collapse, group-port edits and reconnection are supported; this is a bounded native control set.',
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
    ...(
      [
        'clipboard',
        'png',
        'mermaid',
        'modelling-patch',
        'conversion-receipt',
        'review-packet',
        'relationship-audit',
      ] as const
    ).map((adapter) => ({
      adapter,
      status: 'requires-version' as const,
      reason:
        'This entry has no qualified native v3 adapter. Keep the full v3 document. Explicit downgrade review is required before using a v2 adapter; authored group ports block downgrade.',
    })),
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
      'Native resize/port editing and reconnection use the inspector/custom planners; direct pointer resize, port-anchor dragging, reconnection dragging, box selection and pinch are not qualified in the v3 surface.',
      'V1/v2 editor/render/layout/export/CLI command entries remain version-fixed. Never pass a bare v3 graph to them to evade capability validation.',
      'Screen-reader and physical-device human acceptance and broad performance qualification are not established by unit tests or browser emulation.',
    ]),
  });
}

import { planConnectionDocumentDowngrade } from './connection-document';
import type { ZlozConnectionMode } from './connection-mode';
import {
  captureModelDocumentV2,
  planModelDocumentV2Downgrade,
  type ZlozModelDocumentV2,
  type ZlozV2DowngradeFinding,
} from './model-document-v2';

export type ZlozPortableCompatibilityV2 = Readonly<{
  scope: 'format-capability-only';
  modelId: string;
  checkpoints: readonly Readonly<{
    path: string;
    connectionMode: ZlozConnectionMode;
    strictIncompatibleEdges: readonly string[];
  }>[];
  adapters: readonly Readonly<{
    adapter:
      | 'layout'
      | 'mermaid'
      | 'modelling-patch'
      | 'conversion-receipt'
      | 'review-packet'
      | 'relationship-audit';
    status: 'supported' | 'projection' | 'requires-version';
    reason: string;
  }>[];
  /** Review findings only: never publishes prospective v1 data or current consent. */
  downgrade: Readonly<{
    type: 'blocked' | 'reviewable';
    findings: readonly ZlozV2DowngradeFinding[];
  }>;
}>;
/** ADR 0103. Validate every checkpoint; capability does not imply engine eligibility or permission to Apply. */
export function assessPortableCompatibilityV2(
  model: ZlozModelDocumentV2,
): ZlozPortableCompatibilityV2 {
  const source = captureModelDocumentV2(model);
  const checkpoints = [
    { path: '/snapshot', snapshot: source.snapshot },
    ...source.editions.map((edition, index) => ({
      path: `/editions/${index}/snapshot`,
      snapshot: edition.snapshot,
    })),
    ...(source.origin
      ? [{ path: '/origin/edition/snapshot', snapshot: source.origin.edition.snapshot }]
      : []),
  ].map(({ path, snapshot }) => {
    const plan = planConnectionDocumentDowngrade(snapshot);
    return Object.freeze({
      path,
      connectionMode: snapshot.connectionMode,
      strictIncompatibleEdges: Object.freeze(
        plan.type === 'blocked' ? [...plan.incompatibleEdges] : [],
      ),
    });
  });
  const downgrade = planModelDocumentV2Downgrade(source);
  const adapters: ZlozPortableCompatibilityV2['adapters'] = [
    {
      adapter: 'layout',
      status: 'supported',
      reason:
        'Mode-aware layout requests preserve ordered ports and mode. Engine-specific eligibility, policies and freshness still apply.',
    },
    {
      adapter: 'mermaid',
      status: 'projection',
      reason:
        'Use exportConnectionMermaid. The v2 bundle retains mode and ordered identity; source-only semantics and other omissions require explicit loss reporting.',
    },
    {
      adapter: 'modelling-patch',
      status: 'supported',
      reason:
        'Native v2 patches pin source mode through strict decoding, dry-run and live atomic Apply. Explicit consent and live policies are still required; operations do not change mode.',
    },
    {
      adapter: 'conversion-receipt',
      status: 'supported',
      reason:
        'Native v2 C4/DDD conversion receipts retain complete mode-aware source/target documents and recompute mappings on reopening. Recorded evidence never authorizes new Apply.',
    },
    {
      adapter: 'review-packet',
      status: 'supported',
      reason:
        'Native v2 review packets retain selected checkpoint modes, audit comparisons and v2 projections. Reopening recomputes evidence and creates independent read-only reviews.',
    },
    {
      adapter: 'relationship-audit',
      status: 'supported',
      reason:
        'Explicit v2 connection audits and model comparisons validate each checkpoint in its own mode. Domain relationship rules remain independent from port kinds.',
    },
  ];
  return Object.freeze({
    scope: 'format-capability-only',
    modelId: source.id,
    checkpoints: Object.freeze(checkpoints),
    adapters: Object.freeze(adapters.map((entry) => Object.freeze(entry))),
    downgrade: Object.freeze({ type: downgrade.type, findings: downgrade.findings }),
  });
}

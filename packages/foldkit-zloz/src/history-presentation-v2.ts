import type { ZlozHistoryGhostVisibility } from './history-comparison-controls';
import { compareEditionsV2 } from './history-comparison-v2';
import type { ZlozHistoryComparisonV2, ZlozHistoryModeChangeV2 } from './history-comparison-v2';
import type { ZlozEditionV2 } from './model-document-v2';

export type ZlozHistoryPresentationOptionsV2 = Readonly<{
  /** All layers default to visible; compose saved preferences from comparison controls. */
  ghosts?: Partial<ZlozHistoryGhostVisibility>;
  /** The displayed checkpoint; ghosts show the other side without reversing semantic status. */
  displaySide?: 'baseline' | 'selected';
  /** Hides ghosts without rewriting preferences or suppressing checkpoint meaning. */
  minimalMode?: boolean;
  formatMode?: (change: ZlozHistoryModeChangeV2, defaultText: string) => string;
  formatSummary?: (comparison: ZlozHistoryComparisonV2, defaultText: string) => string;
}>;
export type ZlozHistoryPresentationContextV2 = Readonly<{
  comparison: ZlozHistoryComparisonV2;
  displaySide: 'baseline' | 'selected';
  ghosts: ZlozHistoryGhostVisibility;
  effectiveGhosts: ZlozHistoryGhostVisibility;
  summaryText: string;
  modeText: string;
}>;

/** Pure validated presentation for two explicit v2 checkpoints; no editor or lifecycle state. */
export function resolveHistoryComparisonPresentationV2(
  baseline: ZlozEditionV2,
  selected: ZlozEditionV2,
  options: ZlozHistoryPresentationOptionsV2 = {},
): ZlozHistoryPresentationContextV2 {
  const comparison = compareEditionsV2(baseline, selected);
  const mode = comparison.modeChange;
  const modeText =
    mode.kind === 'changed'
      ? `Connection mode changed from ${mode.before} to ${mode.after}.`
      : `Connection mode unchanged: ${mode.mode}.`;
  const meaningChanged =
    comparison.nodes.some((change) => change.semanticChanged) ||
    comparison.edges.some((change) => change.semanticChanged);
  const summary = [
    `${comparison.selected.name} compared with ${comparison.baseline.name}.`,
    ...(meaningChanged ? ['Graph meaning changed.'] : []),
    ...(comparison.layoutChanged ? ['Graph layout changed.'] : []),
    ...(comparison.nodes.length === 0 && comparison.edges.length === 0
      ? ['No node or edge changes.']
      : []),
  ].join(' ');
  const ghosts = Object.freeze({
    enabled: options.ghosts?.enabled ?? true,
    nodes: options.ghosts?.nodes ?? true,
    edges: options.ghosts?.edges ?? true,
    movements: options.ghosts?.movements ?? true,
  });
  return Object.freeze({
    comparison,
    displaySide: options.displaySide ?? 'selected',
    ghosts,
    effectiveGhosts: Object.freeze({ ...ghosts, enabled: ghosts.enabled && !options.minimalMode }),
    summaryText: options.formatSummary?.(comparison, summary).trim() || summary,
    modeText: options.formatMode?.(mode, modeText).trim() || modeText,
  });
}

import {
  captureEdition,
  isHistoryNavigationEvent,
  type EditorEvent,
  type ZlozEdition,
  type ZlozEditionRestorePolicy,
} from '@opsydyn/foldkit-zloz';

import { createDddOrderGraph } from './ddd-examples';
import { workbenchPolicy } from './editor-policy';
import type { Message } from './message';
import type { Model } from './model';

/** All other app actions fail closed while a historical editor is displayed. */
export function historyAllowsMessage(message: Message): boolean {
  if (message._tag === 'ObservedZlozInput' || message._tag === 'ObservedModelInput') {
    // SAFETY: the view emits EditorEvent values through this Schema.Unknown message field.
    const event = message.message as EditorEvent;
    return isHistoryNavigationEvent(event);
  }
  return new Set<string>([
    'ClickedScrubberHistory',
    'ClickedAuditExample',
    'ObservedAuditComparisonInput',
    'SelectedPlaybackEdition',
    'AdvancedEditionPlayback',
    'ClickedPlaybackEnabled',
    'ClickedPlaybackPlay',
    'ClickedPlaybackPause',
    'ClickedPlaybackRewind',
    'ClickedPlaybackPrevious',
    'ClickedPlaybackNext',
    'SelectedPlaybackInterval',
    'ChangedPlaybackReducedMotion',
    'ChangedPlaybackVisibility',
    'ChoseModelDocumentFiles',
    'SucceededModelDocumentImport',
    'FailedModelDocumentImport',
    'ClickedCancelModelImport',
    'CompletedCancelModelImport',
    'ClickedModelImportProtection',
    'ChangedForkName',
    'ClickedForkEdition',
    'SelectedWorkingModel',
    'ClickedEditionForkProtection',
    'ClickedExportModel',
    'CompletedExport',
    'FailedExport',
    'ChoseEditionArchiveFiles',
    'SucceededEditionArchiveImport',
    'FailedEditionArchiveImport',
    'ClickedCancelEditionImport',
    'CompletedCancelEditionImport',
    'ClickedPreviewEditionRestore',
    'ClickedConfirmEditionRestore',
    'ClickedCancelEditionRestore',
    'ClickedEditionRestoreProtection',
    'SelectedHistoryEdition',
    'ClickedHistoryPresent',
    'ClickedHistoryChangeFilter',
    'ClickedHistoryChange',
    'SelectedHistoryBaseline',
    'ClickedHistoryGhost',
    'ChangedHistoryGhostVisibility',
    'ClickedExportEditions',
    'CompletedExportEditions',
    'FailedExportEditions',
    'SelectedWorkbenchSection',
    'ClickedWorkbenchSidebar',
    'SelectedThemePreference',
    'ChangedSystemColorScheme',
    'LoadedThemePreference',
    'CompletedColorSchemeSave',
    'FailedColorSchemeSave',
    'ClickedMinimalMode',
    'ClickedDiagnosticsPanel',
    'ClickedDiagnosticsEnabled',
    'ClickedDiagnostic',
  ]).has(message._tag);
}
export function orderEditions(): readonly ZlozEdition[] {
  const original = createDddOrderGraph();
  const event = original.nodes.find((node) => node.id === 'order-placed')!;
  const evolved = {
    nodes: [
      ...original.nodes
        .filter((node) => node.id !== 'pricing')
        .map((node) =>
          node.id === 'order'
            ? { ...node, position: { x: 350, y: 155 }, label: 'Sales order' }
            : node.id === 'orders'
              ? { ...node, ports: node.ports.map((port) => ({ ...port, side: 'right' as const })) }
              : node.id === event.id
                ? {
                    ...node,
                    ports: [
                      ...node.ports,
                      { id: 'out', kind: 'output' as const, side: 'bottom' as const, offset: 0.5 },
                    ],
                  }
                : node,
        ),
      {
        id: 'delivery',
        label: 'Delivery',
        position: { x: 420, y: 650 },
        size: { width: 250, height: 160 },
        ports: [{ id: 'in', kind: 'input' as const, side: 'right' as const, offset: 0.5 }],
        architecture: {
          family: 'ddd' as const,
          role: 'domain-service' as const,
          description: 'Coordinates delivery after acceptance.',
        },
      },
    ],
    edges: [
      ...original.edges,
      {
        id: 'delivery-trigger',
        source: { node: event.id, port: 'out' },
        target: { node: 'delivery', port: 'in' },
        label: 'Triggers delivery',
      },
    ],
  };
  return [
    captureEdition({
      id: 'order-start',
      name: 'Ordering · original',
      snapshot: { graph: original },
    }),
    captureEdition({
      id: 'order-evolved',
      name: 'Ordering · delivery introduced',
      snapshot: { graph: evolved },
    }),
  ];
}

export const editionArchiveByteLimit = 5 * 1024 * 1024;
export function editionRestorePolicy(model: Model): ZlozEditionRestorePolicy {
  return {
    ...workbenchPolicy(model),
    canRestoreEdition: () =>
      model.protectEditionRestore ? 'Edition restore is protected in this workspace.' : null,
  };
}

/** Synthetic named checkpoints for exercising direct seeking; not a business change log. */
export function scrubberEditions(): readonly ZlozEdition[] {
  const [original, evolved] = orderEditions();
  const names = [
    'Sketch',
    'Language review',
    'Aggregate review',
    'Policy review',
    'Delivery introduced',
    'Delivery review',
    'Boundary review',
    'Final review',
  ];
  return names.map((name, index) => {
    const source = index < 4 ? original! : evolved!;
    const graph = {
      ...source.snapshot.graph,
      nodes: source.snapshot.graph.nodes.map((node) =>
        node.id === 'order'
          ? {
              ...node,
              label: index < 2 ? 'Order' : 'Sales order',
              position: { ...node.position, x: node.position.x + index * 14 },
            }
          : node,
      ),
    };
    return captureEdition({
      id: `scrubber-order-${index}`,
      name: `Ordering · ${name}`,
      snapshot: { graph },
    });
  });
}

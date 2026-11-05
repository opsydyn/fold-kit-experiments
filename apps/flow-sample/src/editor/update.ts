import {
  applyLayout,
  createEditor,
  fitViewport,
  layoutRequest,
  parseGraph,
  serializeGraph,
  updateEditor,
  type EditorEvent,
  type LayoutResult,
} from '@opsydyn/foldkit-flow';
import { supportsForceLayout } from '@opsydyn/foldkit-flow-force/eligibility';
import type { Return } from 'foldkit/update';

import { ArrangeFlow, ExportFlow, ImportFlow, LoadFlow, SaveFlow } from './command';
import { Message } from './message';
import { groupedOnionGraph, initialGraph, onionGraph, type Model } from './model';
import { presetPosition } from './port-presets';

export function update(model: Model, message: Message): Return<Model, Message> {
  const { snapToGrid, gridSpacing, snapToAlignment, selectionMode } = model.editor;
  return Message.match(message, {
    ObservedFlowInput: ({ message: input }) => {
      // SAFETY: flowView and the toolbar emit the package's typed EditorEvent contract.
      const event = input as EditorEvent;
      return { model: { ...model, editor: updateEditor(model.editor, event) } };
    },
    SelectedExample: ({ example }) => {
      const graph = {
        release: initialGraph,
        onion: onionGraph,
        'grouped-onion': groupedOnionGraph,
      }[example];
      const surface = model.editor.surface;
      const editor = createEditor(graph, {
        snapToGrid,
        gridSpacing,
        snapToAlignment,
        selectionMode,
        viewport: fitViewport(graph, surface ?? { width: 800, height: 440 }),
      });
      return {
        model: {
          ...model,
          editor: { ...editor, surface, clipboard: model.editor.clipboard },
          active: null,
          importing: null,
          notice: '',
        },
      };
    },
    SelectedPortAnchors: ({ preset }) => ({
      model: {
        ...model,
        editor: updateEditor(model.editor, {
          type: 'PortPositionsChanged',
          positions: model.editor.graph.nodes.flatMap((node) =>
            node.ports.map((port) => ({
              endpoint: { node: node.id, port: port.id },
              position: presetPosition(port, preset),
            })),
          ),
        }),
      },
    }),
    SelectedConnectionDesign: ({ connectionDesign }) => ({ model: { ...model, connectionDesign } }),
    SelectedEdgeDesign: ({ edgeDesign }) => ({ model: { ...model, edgeDesign } }),
    SelectedNodeDesign: ({ nodeDesign }) => ({ model: { ...model, nodeDesign } }),
    SelectedBackground: ({ background }) => ({ model: { ...model, background } }),
    ClickedMinimalMode: () => ({ model: { ...model, minimalMode: !model.minimalMode } }),
    ClickedDiagnosticsPanel: () => ({
      model: { ...model, diagnosticsPanelOpen: !model.diagnosticsPanelOpen },
    }),
    ClickedDiagnosticsEnabled: () => ({
      model: { ...model, diagnosticsEnabled: !model.diagnosticsEnabled },
    }),
    ClickedDiagnostic: ({ diagnostic }) => ({
      model: {
        ...model,
        diagnostics: { ...model.diagnostics, [diagnostic]: !model.diagnostics[diagnostic] },
      },
    }),
    ClickedAdd: () => {
      let sequence = model.sequence + 1;
      while (model.editor.graph.nodes.some((node) => node.id === `step-${sequence}`)) sequence++;
      const editor = updateEditor(model.editor, {
        type: 'NodeAdded',
        node: {
          id: `step-${sequence}`,
          label: `Step ${sequence}`,
          position: { x: 70, y: 230 },
          size: { width: 180, height: 90 },
          ports: [
            { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
            { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
          ],
        },
      });
      return { model: { ...model, editor, sequence } };
    },
    ClickedArrange: ({ engine }) => {
      if (engine === 'force' && !supportsForceLayout(model.editor.graph)) return { model };
      const sequence = model.sequence + 1;
      const active = layoutRequest(model.editor, `layout-${sequence}`);
      return {
        model: { ...model, active, sequence, notice: 'Arranging…' },
        commands: [
          ArrangeFlow({
            engine,
            json: serializeGraph(active.graph),
            requestId: active.requestId,
            revision: active.revision,
            direction: (model.editor.surface?.width ?? 800) < 600 ? 'DOWN' : 'RIGHT',
          }),
        ],
      };
    },
    SucceededLayout: ({ result: raw }) => {
      // SAFETY: ArrangeFlow returns a layout result from the selected engine.
      const result = raw as LayoutResult;
      if (model.active?.requestId !== result.requestId) return { model };
      const editor = applyLayout(model.editor, model.active, result);
      return {
        model: {
          ...model,
          editor:
            editor === model.editor
              ? editor
              : updateEditor(editor, {
                  type: 'ViewportChanged',
                  viewport: fitViewport(
                    editor.graph,
                    editor.surface ?? { width: 800, height: 440 },
                  ),
                }),
          active: null,
          notice:
            editor === model.editor
              ? 'Graph changed; arrange again when ready.'
              : 'Layout applied.',
        },
      };
    },
    FailedLayout: ({ requestId }) =>
      model.active?.requestId === requestId
        ? { model: { ...model, active: null, notice: 'Layout failed. Your graph is preserved.' } }
        : { model },
    ClickedExport: () => ({
      model,
      commands: [ExportFlow({ json: serializeGraph(model.editor.graph) })],
    }),
    CompletedExport: () => ({ model: { ...model, notice: 'JSON download started.' } }),
    FailedExport: () => ({ model: { ...model, notice: 'Could not start the JSON download.' } }),
    ChoseImportFiles: ({ files }) => {
      const file = files[0];
      if (!file) return { model };
      if (file.size > 5 * 1024 * 1024)
        return {
          model: { ...model, importing: null, notice: 'Choose a JSON file no larger than 5 MiB.' },
        };
      const id = model.sequence + 1;
      return {
        model: {
          ...model,
          sequence: id,
          importing: { id, revision: model.editor.revision },
          notice: 'Reading diagram…',
        },
        commands: [ImportFlow({ id, file })],
      };
    },
    FailedImport: ({ id }) =>
      model.importing?.id === id
        ? {
            model: {
              ...model,
              importing: null,
              notice: 'Could not import this JSON diagram. Your current diagram is preserved.',
            },
          }
        : { model },
    SucceededImport: ({ id, json }) => {
      if (model.importing?.id !== id) return { model };
      if (
        model.importing.revision !== model.editor.revision ||
        model.editor.gesture.type !== 'idle'
      )
        return {
          model: {
            ...model,
            importing: null,
            notice: 'The diagram changed during import. Choose the file again to replace it.',
          },
        };
      const graph = parseGraph(json);
      const surface = model.editor.surface;
      const size = surface ?? { width: 800, height: 440 };
      const editor = createEditor(graph, {
        snapToGrid,
        gridSpacing,
        snapToAlignment,
        selectionMode,
        viewport: fitViewport(graph, size, Math.min(24, size.width / 4, size.height / 4)),
      });
      return {
        model: {
          ...model,
          editor: { ...editor, surface, clipboard: model.editor.clipboard },
          active: null,
          importing: null,
          notice: 'JSON diagram imported.',
        },
      };
    },
    ClickedSave: () => ({
      model,
      commands: [SaveFlow({ json: serializeGraph(model.editor.graph) })],
    }),
    ClickedLoad: () => ({ model, commands: [LoadFlow()] }),
    SucceededSave: () => ({ model: { ...model, notice: 'Saved on this browser.' } }),
    FailedStorage: () => ({
      model: {
        ...model,
        notice: 'Saved graph unavailable or invalid. Your current graph is preserved.',
      },
    }),
    SucceededLoad: ({ json }) => ({
      model: {
        ...model,
        editor: {
          ...createEditor(parseGraph(json), {
            snapToGrid,
            gridSpacing,
            snapToAlignment,
            selectionMode,
          }),
          surface: model.editor.surface,
          clipboard: model.editor.clipboard,
        },
        active: null,
        importing: null,
        notice: 'Saved graph loaded.',
      },
    }),
  });
}

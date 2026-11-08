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
import type { Return } from 'foldkit/update';

import { ArrangeFlow, LoadFlow, SaveFlow } from './command';
import { Message } from './message';
import type { Model } from './model';

export function update(model: Model, message: Message): Return<Model, Message> {
  return Message.match(message, {
    ObservedFlowInput: ({ message: input }) => {
      // SAFETY: flowView and the toolbar emit the package's typed EditorEvent contract.
      const event = input as EditorEvent;
      return { model: { ...model, editor: updateEditor(model.editor, event) } };
    },
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
    ClickedArrange: () => {
      const sequence = model.sequence + 1;
      const active = layoutRequest(model.editor, `layout-${sequence}`);
      return {
        model: { ...model, active, sequence, notice: 'Arranging…' },
        commands: [
          ArrangeFlow({
            json: serializeGraph(active.graph),
            requestId: active.requestId,
            revision: active.revision,
          }),
        ],
      };
    },
    SucceededLayout: ({ result: raw }) => {
      // SAFETY: ArrangeFlow returns a validated result from the ELK adapter.
      const result = raw as LayoutResult;
      if (model.active?.requestId !== result.requestId) return { model };
      const editor = applyLayout(model.editor, model.active, result);
      return {
        model: {
          ...model,
          editor,
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
    ClickedFit: () => ({
      model: {
        ...model,
        editor: updateEditor(model.editor, {
          type: 'ViewportChanged',
          viewport: fitViewport(
            model.editor.graph,
            model.editor.surface ?? { width: 800, height: 440 },
          ),
        }),
      },
    }),
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
        editor: { ...createEditor(parseGraph(json)), surface: model.editor.surface },
        active: null,
        notice: 'Saved graph loaded.',
      },
    }),
  });
}

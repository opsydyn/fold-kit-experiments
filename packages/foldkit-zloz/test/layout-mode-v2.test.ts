import { expect, test } from 'bun:test';

import {
  createModelEditorV2,
  layoutRequest,
  applyLayout,
  updateEditor,
  validateLayoutRequest,
} from '../src/index';
const graph = {
  nodes: ['a', 'b'].map((id) => ({
    id,
    label: id,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 80 },
    ports: [{ id: 'p', kind: 'input' as const, side: 'left' as const, offset: 0.5 }],
  })),
  edges: [{ id: 'e', source: { node: 'a', port: 'p' }, target: { node: 'b', port: 'p' } }],
};
test('layout preserves loose mode, rejects cross-mode request reuse and retains atomic Undo', () => {
  const state = createModelEditorV2({
    id: 'm',
    name: 'M',
    snapshot: { version: 2, connectionMode: 'loose', graph },
    editions: [],
    origin: null,
  });
  const request = layoutRequest(state, 'loose');
  expect(request.connectionMode).toBe('loose');
  const result = {
    requestId: request.requestId,
    revision: request.revision,
    positions: [
      { id: 'a', x: 20, y: 30 },
      { id: 'b', x: 220, y: 30 },
    ],
    routes: [],
  };
  const next = applyLayout(state, request, result);
  expect(next.connectionMode).toBe('loose');
  expect(next.graph.edges).toEqual(graph.edges);
  expect(updateEditor(next, { type: 'UndoPressed' }).graph).toEqual(state.graph);
  expect(applyLayout(state, { ...request, connectionMode: 'strict' }, result)).toBe(state);
  expect(() => validateLayoutRequest({ ...request, connectionMode: 'strict' })).toThrow();
});

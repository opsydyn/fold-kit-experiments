import { validateGraphForConnectionMode } from './graph';
import type { EditorState, ZlozConnectionHistory, ZlozGraph } from './types';

function projection(history: ZlozConnectionHistory) {
  return {
    connectionHistory: history,
    past: history.past.map((frame) => frame.graph),
    future: history.future.map((frame) => frame.graph),
  };
}
/** Internal transaction bookkeeping. Full frames own v2 history; graph arrays remain native-control projections. */
export function appendConnectionHistory(state: EditorState, before: ZlozGraph) {
  if (!state.connectionHistory)
    return {
      past: state.historyLimit === 0 ? [] : [...state.past, before].slice(-state.historyLimit),
      future: [],
    };
  return projection({
    past:
      state.historyLimit === 0
        ? []
        : [
            ...state.connectionHistory.past,
            { graph: before, connectionMode: state.connectionMode ?? 'strict' },
          ].slice(-state.historyLimit),
    future: [],
  });
}
export function measureConnectionHistory(
  state: EditorState,
  measure: (graph: ZlozGraph) => ZlozGraph,
) {
  if (!state.connectionHistory)
    return { past: state.past.map(measure), future: state.future.map(measure) };
  return projection({
    past: state.connectionHistory.past.map((frame) => ({ ...frame, graph: measure(frame.graph) })),
    future: state.connectionHistory.future.map((frame) => ({
      ...frame,
      graph: measure(frame.graph),
    })),
  });
}
export function travelConnectionHistory(state: EditorState, direction: 'undo' | 'redo') {
  const history = state.connectionHistory;
  if (!history) return null;
  const frame = direction === 'undo' ? history.past.at(-1) : history.future[0];
  if (!frame) return null;
  validateGraphForConnectionMode(frame.graph, frame.connectionMode);
  const current = { graph: state.graph, connectionMode: state.connectionMode ?? 'strict' };
  return {
    graph: frame.graph,
    connectionMode: frame.connectionMode,
    ...projection(
      direction === 'undo'
        ? { past: history.past.slice(0, -1), future: [current, ...history.future] }
        : {
            past:
              state.historyLimit === 0 ? [] : [...history.past, current].slice(-state.historyLimit),
            future: history.future.slice(1),
          },
    ),
  };
}

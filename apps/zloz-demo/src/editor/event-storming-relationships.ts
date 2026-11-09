import {
  eventStormingRelationshipRules,
  resolveEventStormingRelationship,
  type ZlozEventStormingRelationshipOptions,
  type ZlozEdge,
} from '@opsydyn/foldkit-zloz';

import type { Model } from './model';
export function workbenchRelationshipOptions(
  model: Pick<Model, 'customStormingRelationships'>,
): ZlozEventStormingRelationshipOptions {
  return model.customStormingRelationships
    ? {
        rules: [
          ...eventStormingRelationshipRules,
          {
            architecture: { family: 'event-storming', role: 'custom', name: 'delegates' },
            sources: ['command'],
            targets: ['command'],
            label: 'Delegates',
          },
        ],
      }
    : {};
}
/** Fixture action still uses ordinary typed ConnectionCreated and all current editor policies. */
export function delegatedRelationship(model: Model): ZlozEdge | null {
  const commands = model.editor.graph.nodes.filter(
    (node) =>
      node.architecture?.family === 'event-storming' && node.architecture.role === 'command',
  );
  const source = commands[0],
    target = commands.at(-1);
  const output = source?.ports.find((port) => port.kind === 'output'),
    input = target?.ports.find((port) => port.kind === 'input');
  if (!source || !target || source.id === target.id || !output || !input) return null;
  let sequence = model.sequence;
  while (model.editor.graph.edges.some((edge) => edge.id === `delegated:${sequence}`)) sequence++;
  return {
    id: `delegated:${sequence}`,
    label: 'Delegates',
    architecture: { family: 'event-storming', role: 'custom', name: 'delegates' },
    source: { node: source.id, port: output.id },
    target: { node: target.id, port: input.id },
  };
}

export function inferredRelationship(model: Model, edge: ZlozEdge) {
  const { architecture: _architecture, ...untyped } = edge;
  const result = resolveEventStormingRelationship(
    model.editor.graph,
    untyped,
    workbenchRelationshipOptions(model),
  );
  return result.type === 'allowed' ? result.architecture : null;
}

import { expect, test } from 'bun:test';

import { createEditor, serializeGraph, parseGraph } from '@opsydyn/foldkit-flow';

import { createC4ContextGraph, createC4ContainerGraph } from '../src/editor/c4-examples';
import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { update } from '../src/editor/update';

test('system context and container detail are valid separate C4 views with directed named relationships', () => {
  const context = createC4ContextGraph();
  expect(context.nodes.map((node) => node.architecture?.role)).toEqual([
    'person',
    'software-system',
    'software-system',
    'software-system',
  ]);
  expect(context.edges.map((edge) => edge.label)).toEqual([
    'Places and tracks orders',
    'Authenticates · HTTPS / OIDC',
    'Charges orders · HTTPS',
  ]);
  const detail = createC4ContainerGraph();
  expect(detail.nodes.filter((node) => node.kind === 'group')).toHaveLength(1);
  expect(detail.nodes.filter((node) => node.architecture?.role === 'container')).toHaveLength(2);
  expect(detail.nodes.find((node) => node.id === 'orders-db')?.parentId).toBe('platform-boundary');
  for (const graph of [context, detail])
    expect(createEditor(parseGraph(serializeGraph(graph))).graph).toEqual(graph);
});

test('opening the C4 preset selects package rendering and theme changes preserve the document and history', () => {
  const initial = { ...init().model, themePreference: 'light' as const };
  const context = update(initial, Message.SelectedExample({ example: 'c4-context' })).model;
  expect(context.nodeDesign).toBe('c4');
  expect(context.editor.graph.nodes).toHaveLength(4);
  const dark = update(context, Message.SelectedThemePreference({ themePreference: 'dark' })).model;
  expect(dark.editor).toBe(context.editor);
  expect(dark.themePreference).toBe('dark');
  expect(
    update(dark, Message.SelectedExample({ example: 'c4-containers' })).model.editor.graph.nodes,
  ).toHaveLength(5);
});

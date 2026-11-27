import { captureConnectionDocument } from '@opsydyn/foldkit-zloz';
import { expect, test } from 'vitest';

import { Message, editorFor, init, update, type Model } from '../src/connections/state';

const source = { node: 'orders', port: 'in' };
const target = { node: 'billing', port: 'out' };
const step = (model: Model, message: typeof Message.Type) => update(model, message);

test('strict/loose workbench sessions retain independent graphs, intent and Undo', () => {
  let model = init();
  const strict = model.strict;
  model = step(model, Message.SelectedSession({ session: 'loose' }));
  for (const endpoint of [source, target])
    model = step(
      model,
      Message.ObservedInput({ session: 'loose', event: { type: 'PortActivated', endpoint } }),
    );
  expect(editorFor(model).graph.edges).toEqual([{ id: 'edge:1', source, target }]);
  expect(editorFor(model).past).toHaveLength(1);
  expect(captureConnectionDocument(editorFor(model)).connectionMode).toBe('loose');
  expect(model.strict).toBe(strict);
  model = step(model, Message.SelectedSession({ session: 'strict' }));
  expect(editorFor(model)).toBe(strict);
  model = step(model, Message.ObservedInput({ session: 'loose', event: { type: 'UndoPressed' } }));
  expect(model.loose.graph.edges).toHaveLength(1);
  model = step(model, Message.SelectedSession({ session: 'loose' }));
  model = step(model, Message.ObservedInput({ session: 'loose', event: { type: 'UndoPressed' } }));
  expect(editorFor(model).graph.edges).toEqual([]);
  expect(editorFor(model).future).toHaveLength(1);
});

test('protection remains live after staging and read-only prevents commits without changing modes', () => {
  let model = step(init(), Message.SelectedSession({ session: 'loose' }));
  model = step(
    model,
    Message.ObservedInput({ session: 'loose', event: { type: 'PortActivated', endpoint: source } }),
  );
  const attempt = Message.ObservedInput({
    session: 'loose',
    event: { type: 'PortActivated', endpoint: { node: 'audit', port: 'in' } },
  });
  model = step(model, attempt);
  expect(editorFor(model).notice).toBe('Audit input requires approval.');
  expect(editorFor(model).past).toEqual([]);
  model = step(model, Message.ClickedProtection());
  model = step(
    model,
    Message.ObservedInput({ session: 'loose', event: { type: 'PortActivated', endpoint: source } }),
  );
  model = step(model, Message.ClickedReadOnly());
  const before = editorFor(model);
  expect(editorFor(step(model, attempt)).graph).toBe(before.graph);
  expect(model.strict.readOnly).toBe(true);
  expect(model.loose.connectionMode).toBe('loose');
  model = step(model, Message.ClickedReadOnly());
  model = step(model, attempt);
  expect(editorFor(model).graph.edges).toHaveLength(1);
  expect(editorFor(model).past).toHaveLength(1);
});

test('session/design switches cannot interrupt a drag; presentation changes retain graph history', () => {
  let model = init();
  const strict = model.strict;
  model = step(model, Message.SelectedDesign({ design: 'custom' }));
  model = step(model, Message.SelectedScheme({ scheme: 'dark' }));
  expect(model.strict).toBe(strict);
  model = step(
    model,
    Message.ObservedInput({
      session: 'strict',
      event: {
        type: 'ConnectionDragStarted',
        endpoint: { node: 'orders', port: 'out' },
        pointer: 1,
        point: { x: 10, y: 20 },
      },
    }),
  );
  expect(step(model, Message.SelectedSession({ session: 'loose' }))).toBe(model);
  expect(step(model, Message.SelectedDesign({ design: 'native' }))).toBe(model);
});

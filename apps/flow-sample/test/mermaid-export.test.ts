import { expect, test } from 'bun:test';

import { mermaidPreview } from '../src/editor/mermaid-preview';
import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { update } from '../src/editor/update';

test('preview is opt-in and consent is scoped to the current document without affecting Undo', () => {
  const original = init().model;
  expect(original.mermaidPreviewOpen).toBe(false);
  const opened = update(original, Message.ClickedMermaidPreview()).model;
  expect(opened.mermaidPreviewOpen).toBe(true);
  expect(opened.editor).toBe(original.editor);
  expect(mermaidPreview(opened).status).toBe('rejected');
  expect(update(opened, Message.ClickedMermaidDownload()).commands).toBeUndefined();
  const consented = update(opened, Message.ClickedMermaidLossConsent()).model;
  expect(mermaidPreview(consented).status).toBe('converted');
  expect(consented.editor).toBe(original.editor);
  const download = update(consented, Message.ClickedMermaidDownload());
  expect(download.commands).toHaveLength(1);
  expect(download.model.editor).toBe(original.editor);
  const edited = update(
    consented,
    Message.ObservedFlowInput({
      message: { type: 'NodeLabelChanged', id: 'source', label: 'Changed' },
    }),
  ).model;
  expect(mermaidPreview(edited).status).toBe('rejected');
  expect(update(edited, Message.ClickedMermaidDownload()).commands).toBeUndefined();
  const closed = update(consented, Message.ClickedMermaidPreview()).model;
  expect(closed.mermaidPreviewOpen).toBe(false);
  expect(update(closed, Message.ClickedMermaidDownload()).commands).toBeUndefined();
});

test('nested C4 container export retains group identities and membership after loss consent', () => {
  const example = update(
    init().model,
    Message.SelectedExample({ example: 'c4-nested-containers' }),
  ).model;
  const opened = update(example, Message.ClickedMermaidPreview()).model;
  const consented = update(opened, Message.ClickedMermaidLossConsent()).model;
  const result = mermaidPreview(consented);
  expect(result.status).toBe('converted');
  if (result.status !== 'converted') throw new Error('Expected nested export');
  expect(
    result.value.identity.nodes.find((node) => node.flowId === 'storage-boundary'),
  ).toMatchObject({ kind: 'group', parentId: 'platform-boundary' });
  expect(result.value.identity.nodes.find((node) => node.flowId === 'orders-db')?.parentId).toBe(
    'storage-boundary',
  );
  expect(update(consented, Message.ClickedMermaidDownload()).commands).toHaveLength(1);
  expect(consented.editor).toBe(example.editor);
});

test('replacing a graph clears consent even when the new editor restarts at the same revision', () => {
  const opened = update(init().model, Message.ClickedMermaidPreview()).model;
  const consented = update(opened, Message.ClickedMermaidLossConsent()).model;
  expect(mermaidPreview(consented).status).toBe('converted');
  const replaced = update(consented, Message.SelectedExample({ example: 'c4-context' })).model;
  expect(replaced.editor.revision).toBe(consented.editor.revision);
  expect(mermaidPreview(replaced).status).toBe('rejected');
  expect(replaced.mermaidLossConsentRevision).toBeNull();
});

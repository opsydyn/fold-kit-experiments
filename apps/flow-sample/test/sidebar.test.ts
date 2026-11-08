import { expect, test } from 'bun:test';

import { mermaidPreview } from '../src/editor/mermaid-preview';
import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { update } from '../src/editor/update';

test('sidebar navigation and collapse preserve editor, history and conversion consent', () => {
  const original = init().model;
  const opened = update(original, Message.ClickedMermaidPreview()).model;
  const consented = update(opened, Message.ClickedMermaidLossConsent()).model;
  const navigation = update(
    consented,
    Message.SelectedWorkbenchSection({ section: 'navigation' }),
  ).model;
  expect(navigation.editor).toBe(original.editor);
  expect(mermaidPreview(navigation).status).toBe('converted');
  const collapsed = update(navigation, Message.ClickedWorkbenchSidebar()).model;
  expect(collapsed.sidebarCollapsed).toBe(true);
  expect(collapsed.editor).toBe(original.editor);
  const returned = update(collapsed, Message.SelectedWorkbenchSection({ section: 'export' })).model;
  expect(returned.sidebarCollapsed).toBe(false);
  expect(returned.mermaidPreviewOpen).toBe(true);
  expect(mermaidPreview(returned).status).toBe('converted');
  const closed = update(returned, Message.ClickedMermaidPreview()).model;
  expect(closed.sidebarSection).toBe('diagram');
  expect(closed.editor).toBe(original.editor);
});

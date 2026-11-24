import { expect, test } from 'bun:test';

import * as Appearance from '../src/appearance/main';
import { themePreference, toolLabelsPreference } from '../src/appearance/preferences';
import { Connection } from '../src/editor/feed-state';
import { init, Message, update } from '../src/editor/main';

test('SSR preference accepts only explicit system/light/dark cookie values', () => {
  for (const value of ['system', 'light', 'dark'] as const)
    expect(themePreference(value)).toBe(value);
  for (const value of [undefined, '', 'Dark', '<script>', 'dark; Path=/'])
    expect(themePreference(value)).toBe('system');
});

test('theme is applied immediately, keeps a failed preference for this visit and ignores stale outcomes', () => {
  const before = Appearance.init({ preference: 'system' }).model;
  const dark = Appearance.update(
    before,
    Appearance.Message.SelectedThemePreference({ preference: 'dark' }),
  );
  expect(dark.model.preference).toBe('dark');
  expect(dark.commands).toHaveLength(1);
  const failed = Appearance.update(
    dark.model,
    Appearance.Message.FailedThemeSave({ preference: 'dark' }),
  ).model;
  expect(failed.preference).toBe('dark');
  expect(failed.notice).toContain('for this visit');
  const light = Appearance.update(
    failed,
    Appearance.Message.SelectedThemePreference({ preference: 'light' }),
  ).model;
  expect(
    Appearance.update(light, Appearance.Message.FailedThemeSave({ preference: 'dark' })).model,
  ).toBe(light);
  expect(
    Appearance.update(light, Appearance.Message.CompletedThemeSave({ preference: 'dark' })).model,
  ).toBe(light);
});

test('access denial still allows local emphasis without allowing a graph edit', () => {
  const before = {
    ...init({
      teamId: 'team',
      diagramId: 'diagram',
      actorId: 'actor',
      name: 'Diagram',
      role: 'viewer',
    }).model,
    connection: Connection.Denied(),
  };
  const next = update(before, Message.SelectedCanvasEmphasis({ emphasis: 'ddd' }));
  expect(next.model.emphasis).toBe('ddd');
  expect(next.model.session).toBe(before.session);
  expect(update(next.model, Message.ClickedAdd()).model).toBe(next.model);
});

test('canvas emphasis changes no shared state, geometry, version, commands or Undo', () => {
  const before = init({
    teamId: 'team',
    diagramId: 'diagram',
    actorId: 'actor',
    name: 'Diagram',
    role: 'owner',
  }).model;
  const result = update(before, Message.SelectedCanvasEmphasis({ emphasis: 'ddd' }));
  expect(result.model.emphasis).toBe('ddd');
  expect(result.model.editor).toBe(before.editor);
  expect(result.model.session).toBe(before.session);
  expect(result.model.ownEdits).toBe(before.ownEdits);
  expect(result.model.serial).toBe(before.serial);
  expect(result.commands).toBeUndefined();
});

test('tool labels restore independently of theme and retain the current choice after a failed save', () => {
  const initial = Appearance.init({ preference: 'dark', toolLabels: 'labelled' }).model;
  const compact = Appearance.update(
    initial,
    Appearance.Message.SelectedToolLabels({ value: 'icons' }),
  );
  expect(compact.commands).toHaveLength(1);
  expect(compact.model.preference).toBe('dark');
  const stale = Appearance.update(
    compact.model,
    Appearance.Message.SettledToolLabels({ value: 'labelled', saved: false }),
  );
  expect(stale.model).toBe(compact.model);
  const failed = Appearance.update(
    stale.model,
    Appearance.Message.SettledToolLabels({ value: 'icons', saved: false }),
  );
  expect(failed.model.toolLabels).toBe('icons');
  expect(failed.model.labelsNotice).toContain('for this visit');
  const light = Appearance.update(
    failed.model,
    Appearance.Message.SelectedThemePreference({ preference: 'light' }),
  );
  expect(light.model.toolLabels).toBe('icons');
  expect(light.model.labelsNotice).toBe(failed.model.labelsNotice);
});

test('only supported tool label cookies restore on a subsequent request', () => {
  expect(toolLabelsPreference('labelled')).toBe('labelled');
  for (const value of [undefined, 'icons', 'LABELLED', 'labelled; other=value']) {
    expect(toolLabelsPreference(value)).toBe('icons');
  }
});

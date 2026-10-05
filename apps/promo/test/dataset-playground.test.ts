import { expect, test } from 'bun:test';

import { Effect } from 'effect';

import { OpenPlayground } from '../src/examples/datasets/launcher/command';
import { Message } from '../src/examples/datasets/launcher/message';
import { init } from '../src/examples/datasets/launcher/model';
import { update } from '../src/examples/datasets/launcher/update';
import { datasetProject } from '../src/lib/dataset-project';

test('dataset starter automatically installs and starts a reachable Vite server in StackBlitz', () => {
  const files = datasetProject({}, []);
  const manifest = JSON.parse(files['package.json']);
  expect(manifest.stackblitz).toEqual({ installDependencies: true, startCommand: 'npm start' });
  expect(manifest.scripts.start).toBe('vite --host 0.0.0.0');
  expect(manifest.dependencies['@opsydyn/foldkit-viz']).toBe('file:./vendor/foldkit-viz');
});

test('playground click emits one command and ignores duplicate clicks while preparing', () => {
  const initial = init({ templateUrl: '/downloads/dataset-template.json' }).model;
  const pending = update(initial, Message.ClickedPlayground());
  expect(pending.model.status._tag).toBe('Pending');
  expect(pending.commands).toHaveLength(1);
  const duplicate = update(pending.model, Message.ClickedPlayground());
  expect(duplicate.model).toBe(pending.model);
  expect(duplicate.commands).toBeUndefined();
});

test('preparation failure preserves the template and allows retry', () => {
  const initial = init({ templateUrl: '/downloads/dataset-template.json' }).model;
  const pending = update(initial, Message.ClickedPlayground()).model;
  const failed = update(pending, Message.FailedPlayground({ error: 'Network unavailable' })).model;
  expect(failed.status).toEqual({ _tag: 'Failed', error: 'Network unavailable' });
  expect(failed.templateUrl).toBe(initial.templateUrl);
  const retried = update(failed, Message.ClickedPlayground());
  expect(retried.model.status._tag).toBe('Pending');
  expect(retried.commands).toHaveLength(1);
});

test('malformed template and network failure return actionable messages', async () => {
  for (const templateUrl of ['data:application/json,%7B%22file%22%3A42%7D', 'invalid://template']) {
    const result = await Effect.runPromise(OpenPlayground({ templateUrl }).effect);
    expect(result).toEqual(
      Message.FailedPlayground({
        error: 'Could not open StackBlitz. Please try again or download the project.',
      }),
    );
  }
});

/** `foldkit-dash dev`: serves the site, rebuilds on change, and tells open pages to reload. */
import { expect, test } from 'bun:test';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

import { eventsPath, startDev } from '../src/dev';
import { bars, fence, project, rows } from './support';

test('dev serves pages with a reloader, rebuilds on a change and says reload', async () => {
  const root = project({
    'pages/index.md': `# Units\n\n${fence(bars('units.json'))}`,
    'data/units.json': JSON.stringify(rows),
  });
  const logs: Array<string> = [];
  const dev = await startDev(
    { root, fresh: false, timeout: 60_000 },
    { host: '127.0.0.1', port: 0 },
    (built) => logs.push(built._tag),
  );
  const page = await (await fetch(dev.url)).text();
  expect(page).toContain('<h1>Units</h1>');
  expect(page).toContain(`new EventSource("${eventsPath}")`);
  expect((await fetch(`${dev.url}missing`)).status).toBe(404);

  const events = await fetch(`${dev.url}${eventsPath.slice(1)}`);
  const reader = events.body?.getReader();
  const decoder = new TextDecoder();
  const heard = async (): Promise<string> => {
    let text = '';
    while (!text.includes('data: reload')) {
      const chunk = await reader?.read();
      if (chunk === undefined || chunk.done) break;
      text += decoder.decode(chunk.value);
    }
    return text;
  };
  const reload = heard();
  appendFileSync(join(root, 'pages/index.md'), '\nAdded later.\n');
  expect(await reload).toContain('data: reload');
  expect(await (await fetch(dev.url)).text()).toContain('Added later.');
  expect(logs).toEqual(['Success', 'Success']);
  await reader?.cancel();
  dev.stop();
});

/** Qualification-only browser oracle, using the repo's existing Playwright installation. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const root = resolve(fileURLToPath(new URL('./node_modules/mermaid/dist/', import.meta.url)));
const corpus = JSON.parse(
  await readFile(new URL('./fixtures/corpus.json', import.meta.url), 'utf8'),
);
const evidence = JSON.parse(
  await readFile(new URL('./evidence-node.json', import.meta.url), 'utf8'),
);
const inputs = corpus.map(({ id, source }) => ({ id, source, expected: id !== 'invalid-syntax' }));
inputs.push(
  ...evidence.cases
    .filter((item) => item.generated)
    .map(({ id, generated }) => ({ id: `generated:${id}`, source: generated, expected: true })),
);
inputs.push({ id: 'generated:empty', source: 'flowchart LR\n', expected: true });
const server = createServer(async (request, response) => {
  if (request.url === '/') {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><title>Mermaid syntax oracle</title>');
    return;
  }
  const path = resolve(root, `.${request.url}`);
  if (!path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  await readFile(path).then(
    (body) => {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(body);
    },
    () => response.writeHead(404).end(),
  );
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
const browser = await chromium.launch();
const run = async () => {
  const page = await browser.newPage();
  const errors = [],
    externalRequests = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:')) externalRequests.push(request.url());
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const cases = await page.evaluate(async (inputs) => {
    const { default: mermaid } = await import('/mermaid.esm.min.mjs');
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    const cases = [];
    for (const { id, source, expected } of inputs) {
      const result = await Promise.resolve()
        .then(() => mermaid.parse(source))
        .then(
          (result) => ({ valid: Boolean(result), diagramType: result.diagramType }),
          (error) => ({ valid: false, error: String(error).slice(0, 700) }),
        );
      cases.push({ id, expected, ...result });
    }
    return cases;
  }, inputs);
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  for (const item of cases) assert.equal(item.valid, item.expected, item.id);
  console.log(
    JSON.stringify(
      {
        mermaid: '12.3.0',
        chromium: browser.version(),
        operation: 'public parse only; no rendering or callbacks',
        errors,
        externalRequests,
        cases,
      },
      null,
      2,
    ),
  );
};
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

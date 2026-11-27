import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

const verifier = fileURLToPath(new URL('../../../../tools/astro-compat.ts', import.meta.url));

test('a packed Astro 7 consumer resolves the shared renderer and builds the fixture', async () => {
  const process = Bun.spawn(['bun', verifier, '7'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [code, output, error] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  expect(code, output + error).toBe(0);
  expect(output).toContain('packed imports, SSR and deferred hydration markup passed');
}, 120_000);

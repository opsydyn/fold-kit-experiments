# Foldkit DevTools MCP: notes from the agent-driven room

Notes from connecting an agent to the XR room sample through the Foldkit DevTools MCP
server on 2026-10-19. They cover what works, three problems with steps to reproduce,
and the workarounds we use. Nothing has been reported upstream yet; this note is for
review first.

**Versions:** `foldkit` 0.167.0, `@foldkit/vite-plugin` 0.27.0 (through
`@opsydyn/astro-foldkit`), `@foldkit/devtools-mcp` 0.24.1, `astro` 7.4.0, Effect 4.0.0,
Playwright's Chromium (headless), macOS 26, Node 24.15.

## What works

With `export const devTools = { Message, excludeFromHistory: ['MadeGesture'] }` in
`packages/effect-three-samples/src/room/main.ts`, the MCP server can read the room's
Model and dispatch Messages to it:

- `foldkit_get_message_schema` lists every room Message, `PlacedPlant { at, kind }`
  among them.
- `foldkit_dispatch_messages` with a `ClickedClear` and six `PlacedPlant`s was
  accepted (`ResponseDispatchedBatch`, seven indices), and the six plants were drawn.
- `foldkit_dispatch_message` with `kind: 'oak'` was refused before `update`:
  `Invalid Message: Expected "fern" | "cactus" | "tulip" at ["kind"]`.
- `foldkit_count_messages_by_tag` showed the dispatched Messages in history, and no
  `MadeGesture`.

## Setup for the reproductions

1. `bun install` at the repository root (it installs `@foldkit/devtools-mcp`).
2. `bun dev:three-promo` (Astro on `http://localhost:4323`). Astro 7 runs the dev
   server in the background; `astro dev stop` in `apps/three-promo` stops it.
3. Start the MCP server scoped to the promo app, so it joins that relay (see finding 3):

   ```sh
   FOLDKIT_PROJECT_ROOT="$PWD/apps/three-promo" node_modules/.bin/foldkit-devtools-mcp
   ```

   It logs `connected to ws://localhost:4323/__foldkit/devtools-mcp`. Any MCP client
   works: Claude Code with this repository's `.mcp.json` plus that environment
   variable, or the script in the appendix, which speaks JSON-RPC over stdio.

## Finding 1: closed pages stay listed as runtimes

**Steps**

1. Open `http://localhost:4323/examples/room/` in a browser.
2. Call `foldkit_list_runtimes`: one runtime, for example `mvewsqo1-…`.
3. Close the tab (or the whole browser) and wait a few seconds.
4. Call `foldkit_list_runtimes` again.

**Expected:** the closed page's runtime is gone.

**Actual:** it is still listed. Every page opened since the dev server started stays
listed; after a dozen page loads the relay listed thirteen runtimes, one of them live.
This happens whether the tab or the browser is closed.

**Evidence:** the dev server's log (`astro dev logs` in `apps/three-promo`) shows
`[foldkit:devTools] runtime connected: …` for each page. It never shows
`runtime disconnected` (the browser's `EventDisconnected`) or
`runtime pruned (socket close)` (the relay's `handleViteClientClosed`). Both handlers are
in `@foldkit/vite-plugin/dist/index.js`. The relay's MCP client count never falls either:
after the only MCP client disconnects, it logs `MCP client disconnected (1 remaining)`.

**Root cause:** not found. One guess is ruled out: Effect 4's `HashSet` and `HashMap`
still find an object key after its fields change (a probe that set `readyState` from 1
to 3 still found and removed it). The next thing to check is whether Vite's
`client.socket` `close` event fires under Astro 7's dev server, and whether the
browser sends `EventDisconnected` on `pagehide`.

## Finding 2: tools without `runtime_id` can target a closed page

**Steps:** with finding 1's leftover runtimes, open the room in a new tab and call
`foldkit_get_model` without `runtime_id`.

**Expected:** the call goes to the live page.

**Actual:** it sometimes works, and sometimes fails after ten seconds with
`Error: Operation timed out after '10s'`. In two consecutive runs, one reached the live
page and the other timed out.

**Why:** with no `runtime_id`, `resolveRuntimeId` (`@foldkit/devtools-mcp/dist/tools.js`)
takes `Array.last` of the list. The relay builds that list from `HashMap.values`
(`replyListRuntimes`), so its order is hash order, not connection order. "Last" is
therefore an arbitrary runtime, and with finding 1 that is often a closed page. The
connection ids are base-36 timestamps, which is why ordering by id picks the newest.

**Workaround:** pass `runtime_id` on every call. Pick the live runtime from
`foldkit_list_runtimes` by URL; when several share a URL, take the greatest
`connectionId`.

## Finding 3: the MCP server joins the newest relay under the project root

**Steps**

1. Run `bun dev:three-promo`, then start a second Foldkit dev server anywhere under the
   repository, for example `bun dev` (`apps/web`).
2. Start `node_modules/.bin/foldkit-devtools-mcp` from the repository root (as
   `.mcp.json` does) without `FOLDKIT_PROJECT_ROOT`.
3. Open the room on port 4323 and call `foldkit_list_runtimes`.

**Expected:** a way to reach the promo app's runtimes.

**Actual:** the server logs `connected to ws://127.0.0.1:<apps/web port>/…` and lists no
runtimes. The room's page is on a relay the server never joined.

**Why:** each dev server writes a record to `$TMPDIR/foldkit-devtools-relays/`. In
`@foldkit/devtools-mcp/dist/relayRegistry.js`, `discoverRelay` keeps the records whose
`root` is inside the project root and takes the newest (`startedAt`). It does this once,
at startup. With `.mcp.json` at the root of a monorepo, every app's dev server
qualifies.

**How we hit it:** we didn't start a second server ourselves. The astro-foldkit page
smoke test (`packages/astro-foldkit/test/integration/astro-page-smoke.test.ts`) started
`apps/web`'s dev server with `bun run dev`. Astro 7 runs `astro dev` in the background
when it detects an agent (Claude Code here), so the test's `SIGTERM` to `bun run dev`
didn't stop it. Each `bun run test` an agent ran left one running, with parent PID 1
and its relay registered. Fixed: the test now runs `astro dev --ignore-lock`, which
stays in the foreground. It also no longer passes the app script's `--force`, which in
Astro 7 replaces a dev server already running for the app.

**Workaround:** `FOLDKIT_PROJECT_ROOT=<path to the app>` scopes discovery to one app.
`FOLDKIT_DEVTOOLS_MCP_PORT` (with `FOLDKIT_DEVTOOLS_MCP_HOST`) names a relay directly.

## Possible upstream changes (not filed)

- Prune runtimes whose browser socket has closed, or expire them without a heartbeat.
- Return runtimes in connection order, and default to the most recent live one.
- When several relays match, prefer one with runtimes, or let tools name a relay. At
  least log which relays were found and which was chosen.

## Appendix: reproduction script

The commands below write the script to `/tmp/devtools-mcp-repro.mjs` and run it from
the repository root, against the dev server on port 4323. It borrows the Playwright
installed for `packages/effect-three-foldkit`'s e2e tests. Its argument picks how page
A closes: `page` closes the tab, `browser` closes the whole browser.

```sh
cat > /tmp/devtools-mcp-repro.mjs <<'EOF'
import { spawn } from 'node:child_process';
const { chromium } = await import(
  `${process.cwd()}/packages/effect-three-foldkit/node_modules/playwright/index.mjs`,
);

const url = 'http://localhost:4323/examples/room/';
const mcp = spawn('node_modules/.bin/foldkit-devtools-mcp', [], {
  env: { ...process.env, FOLDKIT_PROJECT_ROOT: `${process.cwd()}/apps/three-promo` },
  stdio: ['pipe', 'pipe', 'inherit'],
});
let buffer = '';
let id = 0;
const waiting = new Map();
mcp.stdout.on('data', (chunk) => {
  buffer += chunk;
  for (let i; (i = buffer.indexOf('\n')) >= 0; ) {
    const line = buffer.slice(0, i);
    buffer = buffer.slice(i + 1);
    if (line.trim()) {
      const message = JSON.parse(line);
      waiting.get(message.id)?.(message);
    }
  }
});
const rpc = (method, params) =>
  new Promise((resolve) => {
    waiting.set(++id, resolve);
    mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
const call = async (name, args = {}) =>
  (await rpc('tools/call', { name, arguments: args })).result.content.map((c) => c.text).join('');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const runtimes = async () => {
  const text = await call('foldkit_list_runtimes');
  return text.startsWith('Error') ? text : JSON.parse(text).runtimes.map((r) => r.connectionId);
};

await rpc('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'repro', version: '0' },
});
while (typeof (await runtimes()) === 'string') await sleep(250); // the relay connects late

const closing = process.argv[2] ?? 'page'; // 'page' or 'browser'
let browser = await chromium.launch();
const first = await browser.newPage();
await first.goto(url);
await sleep(3000);
console.log('page A open:', await runtimes());
if (closing === 'page') await first.close();
else {
  await browser.close();
  browser = await chromium.launch();
}
await sleep(3000);
console.log('page A closed:', await runtimes()); // finding 1: A is still listed
const second = await browser.newPage();
await second.goto(url);
await sleep(3000);
const started = Date.now();
const model = await call('foldkit_get_model'); // finding 2: may time out after 10 s
console.log('get_model, no runtime_id:', model.slice(0, 40), `(${Date.now() - started} ms)`);
await browser.close();
mcp.kill();
EOF
node /tmp/devtools-mcp-repro.mjs page
```

Run it two or three times. The runtime list grows by one each run, and `get_model`
returns either a Model or a ten-second timeout, depending on which runtime is last in
the list.

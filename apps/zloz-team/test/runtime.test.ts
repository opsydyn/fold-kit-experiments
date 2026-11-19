import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { openSync, closeSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseGraph,
  parseOperationRequest,
  type ZlozOperationRequest,
  type ZlozGraph,
} from '@opsydyn/foldkit-zloz';
import { AssessmentReplySchema } from '@opsydyn/foldkit-zloz-alchemy/assessment';
import {
  createDiagramCheckpoint,
  parseDiagramCheckpoint,
} from '@opsydyn/foldkit-zloz-alchemy/checkpoint';
import { applyDiagramDelta, DiagramFeedSchema } from '@opsydyn/foldkit-zloz-alchemy/delta';
import { isDiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';
import type { DiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';
import { ClefReference } from '@opsydyn/zloz-server/src/clef-contract';
import { Actor, Fixture } from '@opsydyn/zloz-server/test/fixture-contract';
import { Schema } from 'effect';
import { chromium, errors as playwrightErrors, type BrowserContext, type Page } from 'playwright';
import type { WebSocketRoute } from 'playwright';
import { expect as browserExpect } from 'playwright/test';

import assessmentFixture from '../../../packages/foldkit-zloz-alchemy/test/fixtures/assessment-v1.json';
import decisionWire from '../../../packages/foldkit-zloz-alchemy/test/fixtures/relationship-decision-v1.json';
import operationFixture from '../../../packages/foldkit-zloz/test/fixtures/operations-v1.json';
import orderWire from '../../../packages/foldkit-zloz/test/fixtures/order-aggregate-v1.json';
import { deltaEntries, liveFrames } from '../src/editor/protocol';
import { stopLocalStack } from '../tools/stop-local-stack';
import { makeCouplingStressFixture, qualifyAssessmentUpdates } from './coupling-load';
import couplingUiFixture from './fixtures/coupling-projection-v1.json';
import { qualifyFiveEditors } from './load';

// SAFETY: Bun's global constructor supports WebSocketOptions (bun-types/globals.d.ts).
// Adding DOM types for Playwright hides that overload; retain it at this native boundary.
const NativeWebSocket = WebSocket as typeof WebSocket & {
  new (url: string | URL, options: Bun.WebSocketOptions): WebSocket;
};

describe('Astro + private Alchemy Worker + D1 + Domain Durable Object', () => {
  const unusedPort = () => {
    const reservation = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response() });
    const port = reservation.port;
    reservation.stop(true);
    if (!port) throw new Error('No local test port');
    return port;
  };
  const port = unusedPort();
  const fixturePort = unusedPort();
  const backendPort = unusedPort();
  const operationsPort = unusedPort();
  const operatorToken = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const backendOrigin = `http://localhost:${backendPort}`;
  const origin = `http://localhost:${port}`;
  const key = crypto.randomUUID();
  const log = join(tmpdir(), `zloz-team-runtime-${crypto.randomUUID()}.log`);
  const stage = `test-${crypto.randomUUID()}`;
  const startStack = (qualificationProbe = true) => {
    const fd = openSync(log, 'a', 0o600);
    const process = Bun.spawn(
      [globalThis.process.execPath, 'tools/dev.ts', '--config', 'test/alchemy.run.ts'],
      {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        detached: true,
        stdin: 'ignore',
        stdout: fd,
        stderr: fd,
        env: {
          ...globalThis.process.env,
          ZLOZ_PORT: String(port),
          ZLOZ_ORIGIN: origin,
          ZLOZ_LOCAL_STAGE: stage,
          ZLOZ_FIXTURE_PORT: String(fixturePort),
          ZLOZ_FIXTURE_KEY: key,
          ZLOZ_BACKEND_PORT: String(backendPort),
          ZLOZ_OPERATIONS_PORT: String(operationsPort),
          ZLOZ_OPERATOR_TOKEN: operatorToken,
          ZLOZ_QUALIFICATION_PROBE: String(qualificationProbe),
          ZLOZ_DECISION_AUTHORING: String(globalThis.process.env.ZLOZ_RUN_OPY_CONTRACT === '1'),
          GOOGLE_CLIENT_ID: '',
          GOOGLE_CLIENT_SECRET: '',
        },
      },
    );
    closeSync(fd);
    return process;
  };
  let child = startStack();
  const fixtureCall = (path: string, body?: Readonly<Record<string, string | boolean>>) =>
    fetch(`http://localhost:${fixturePort}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  const fixture = async () => {
    const response = await fixtureCall('/seed');
    expect(response.status).toBe(200);
    return Schema.decodeUnknownSync(Fixture)(await response.json());
  };
  const newUser = async (name: string, verified = true, google = true) => {
    const response = await fixtureCall('/new-user', { name, verified, google });
    expect(response.status).toBe(200);
    return Schema.decodeUnknownSync(Actor)(await response.json());
  };
  const formPost = (path: string, cookie: string, fields: Readonly<Record<string, string>>) =>
    fetch(`${origin}${path}`, {
      method: 'POST',
      redirect: 'manual',
      headers: { cookie, origin, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields),
    });
  const rpc = async (
    tag: string,
    payload: { key: string } | { target: string; commandId: string; input: { title: string } },
    cookie = '',
    extraHeaders: Readonly<Record<string, string>> = {},
  ) => {
    const response = await fetch(`${origin}/api/zloz/domain`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, cookie, ...extraHeaders },
      body: `${JSON.stringify({ _tag: 'Request', id: '1', tag, payload, headers: [] })}\n`,
    });
    return { response, body: await response.text() };
  };
  const rename = (organizationId: string, cookie: string, title: string) =>
    rpc(
      'RenameProbe',
      {
        target: organizationId,
        commandId: crypto.randomUUID(),
        input: { title },
      },
      cookie,
    );
  const watch = (organizationId: string, cookie: string) => {
    const url = new URL('/api/zloz/domain', origin.replace('http:', 'ws:'));
    url.searchParams.set(
      'read',
      JSON.stringify({ id: '1', tag: 'DiagramProbe.watch', payload: { key: organizationId } }),
    );
    const socket = new NativeWebSocket(url, { headers: { cookie, origin } });
    const messages: string[] = [];
    const first = new Promise<string>((resolve, reject) => {
      socket.addEventListener('message', (event) => {
        const message = String(event.data);
        messages.push(message);
        resolve(message);
      });
      socket.addEventListener('error', () => reject(new Error('Live read failed')));
    });
    const closed = new Promise<number>((resolve) =>
      socket.addEventListener('close', () => resolve(performance.now())),
    );
    return { socket, messages, first, closed };
  };

  const ready = async () => {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Local stack exited; inspect ${log}`);
      const ready = await fetch(`${origin}/api/zloz/session`).catch(() => null);
      const fixtureReady = await fetch(`http://localhost:${fixturePort}`, {
        headers: { authorization: 'wrong' },
      }).catch(() => null);
      const operationsReady = await fetch(`http://localhost:${operationsPort}`, {
        headers: { authorization: 'wrong' },
      }).catch(() => null);
      if (ready?.status === 200 && fixtureReady?.status === 403 && operationsReady?.status === 403)
        return;
      await Bun.sleep(200);
    }
    throw new Error(`Local stack did not become ready; inspect ${log}`);
  };
  beforeAll(ready, 70_000);
  afterAll(async () => {
    await stopLocalStack(child);
  }, 30_000);

  test('real app creates, opens, streams, edits and exports a private diagram with fresh role checks', async () => {
    const data = await fixture();
    const blankId = crypto.randomUUID();
    const blankPath = `${origin}/api/zloz/diagrams/${data.organizationId}/${blankId}`;
    const blank = await fetch(blankPath, {
      method: 'POST',
      headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
      body: JSON.stringify({
        operationId: blankId,
        name: 'Immediately open blank diagram',
        graph: { version: 1, graph: { nodes: [], edges: [] } },
      }),
    });
    expect(blank.status).toBe(200);
    const firstOpen = await fetch(blankPath, { headers: { cookie: data.owner.cookie } });
    expect(firstOpen.status).toBe(200);
    expect(await firstOpen.json()).toMatchObject({
      frame: { document: { graph: { nodes: [], edges: [] } } },
    });
    const id = crypto.randomUUID();
    const path = `/api/zloz/diagrams/${data.organizationId}/${id}`;
    const call = <Body extends object>(suffix: string, cookie: string, body?: Body) =>
      fetch(`${origin}${path}${suffix}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { cookie, origin, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const creation = {
      operationId: id,
      name: 'Shared system',
      graph: { version: 1, graph: operationFixture.graph },
    };
    expect((await call('', data.viewer.cookie, creation)).status).toBe(403);
    expect((await call('', data.owner.cookie, creation)).status).toBe(200);
    expect((await call('', data.owner.cookie, creation)).status).toBe(200);
    expect(
      (await call('', data.owner.cookie, { ...creation, name: 'Changed binding' })).status,
    ).toBe(409);
    expect((await call('', data.outsider.cookie)).status).toBe(403);
    const opened = await call('', data.editor.cookie);
    expect(opened.status).toBe(200);
    expect(await opened.json()).toMatchObject({
      name: 'Shared system',
      role: 'editor',
      frame: { document: { version: 0, undo: [] } },
    });
    const url = new URL('/api/zloz/live', origin.replace('http:', 'ws:'));
    url.searchParams.set(
      'read',
      JSON.stringify({
        id: '1',
        tag: 'ZlozDiagramLiveV1.watch',
        payload: { key: JSON.stringify([data.organizationId, id]) },
      }),
    );
    const socket = new NativeWebSocket(url, { headers: { cookie: data.viewer.cookie, origin } });
    const messages: string[] = [];
    socket.addEventListener('message', (event) => messages.push(String(event.data)));
    const waitFor = async (predicate: () => boolean) => {
      const deadline = Date.now() + 10_000;
      while (!predicate() && Date.now() < deadline) await Bun.sleep(50);
      expect(predicate()).toBe(true);
    };
    await waitFor(() => messages.length > 0);
    await Bun.write(join(tmpdir(), 'zloz-m3-live-frame.json'), messages[0]!);
    const move = parseOperationRequest(operationFixture.move);
    const first = await call('/operations', data.owner.cookie, move);
    expect(first.status).toBe(200);
    const receipt = await first.json();
    expect(receipt).toMatchObject({ receipt: { status: 'accepted', documentVersion: 1 } });
    expect(await (await call('/operations', data.owner.cookie, move)).json()).toEqual(receipt);
    expect(
      (
        await call('/operations', data.owner.cookie, {
          ...move,
          operation: {
            type: 'MoveNodes',
            nodes: [{ id: 'a', expected: 0, position: { x: 999, y: 999 } }],
          },
        })
      ).status,
    ).toBe(409);
    expect((await call('/operations', data.viewer.cookie, move)).status).toBe(403);
    await waitFor(() => messages.some((message) => message.includes('requestHash')));
    expect(messages.join('')).not.toContain('inverse');
    const exported = await call('/export', data.viewer.cookie);
    expect(exported.status).toBe(200);
    expect(await exported.json()).toMatchObject({
      version: 1,
      graph: {
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: 'a', position: { x: 70, y: 90 } }),
        ]),
      },
    });
    expect(
      (
        await call('/presence', data.viewer.cookie, {
          connectionId: 'viewer-tab',
          selection: ['a'],
          cursor: { x: 12, y: 15 },
        })
      ).status,
    ).toBe(200);
    await fixtureCall('/revoke', {
      userId: data.editor.userId,
      organizationId: data.organizationId,
    });
    expect((await call('', data.editor.cookie)).status).toBe(403);
    expect((await call('/export', data.editor.cookie)).status).toBe(403);
    expect(
      (
        await call('/presence', data.editor.cookie, {
          connectionId: 'removed',
          selection: [],
          cursor: null,
        })
      ).status,
    ).toBe(403);
    await fixtureCall('/revoke', {
      userId: data.viewer.userId,
      organizationId: data.organizationId,
    });
    const oldCount = messages.length;
    expect(
      (await call('/operations', data.owner.cookie, parseOperationRequest(operationFixture.rename)))
        .status,
    ).toBe(200);
    await Bun.sleep(200);
    expect(messages.slice(oldCount).join('')).not.toContain('Teammate name');
    socket.close();
  }, 30_000);

  test('app enforces graph/body limits and the live endpoint exposes no native mutation RPC', async () => {
    const data = await fixture();
    const id = crypto.randomUUID();
    const path = `/api/zloz/diagrams/${data.organizationId}/${id}`;
    const call = <Body extends object>(body: Body, suffix = '') =>
      fetch(`${origin}${path}${suffix}`, {
        method: 'POST',
        headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    const nodes = Array.from({ length: 250 }, (_, index) => ({
      ...operationFixture.graph.nodes[0],
      id: `node:${index}:${'図'.repeat(60)}`,
    }));
    expect(
      (
        await call({
          operationId: id,
          name: String.fromCharCode(34).repeat(120),
          graph: { version: 1, graph: { nodes, edges: [] } },
        })
      ).status,
    ).toBe(200);
    const selection = await call(
      { connectionId: 'all-nodes', selection: nodes.map((node) => node.id), cursor: null },
      '/presence',
    );
    expect(selection.status).toBe(200);
    expect(await selection.json()).toMatchObject({
      peers: [expect.objectContaining({ selection: nodes.map((node) => node.id) })],
    });
    const request = {
      version: 1,
      operationId: 'one-too-many',
      operation: { type: 'AddNode', expectedVersion: 0, node: { ...nodes[0], id: 'overflow' } },
    };
    expect(await (await call(request, '/operations')).json()).toMatchObject({
      receipt: { status: 'rejected', code: 'Protected', documentVersion: 0 },
    });
    const bypass = await fetch(`${origin}/api/zloz/live`, {
      method: 'POST',
      headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
      body:
        JSON.stringify({
          _tag: 'Request',
          id: '1',
          tag: 'SubmitOperation',
          payload: {
            target: JSON.stringify([data.organizationId, id]),
            commandId: 'forged',
            input: {
              request: {
                version: 1,
                operationId: 'forged-native-write',
                operation: {
                  type: 'RenameNode',
                  id: nodes[0]!.id,
                  expected: 0,
                  label: 'Untrusted RPC',
                },
              },
            },
          },
          headers: [],
        }) + '\n',
    });
    expect(await bypass.text()).not.toContain('"status":"accepted"');
    const afterBypass = await fetch(`${origin}${path}/export`, {
      headers: { cookie: data.owner.cookie },
    });
    expect(parseGraph(await afterBypass.text()).nodes[0]?.label).toBe('Alpha');
    expect(
      (
        await fetch(`${origin}${path}/operations`, {
          method: 'POST',
          headers: { cookie: data.owner.cookie, origin },
          body: 'x'.repeat(1_048_577),
        })
      ).status,
    ).toBe(413);
    const byteId = crypto.randomUUID();
    const bytePath = `/api/zloz/diagrams/${data.organizationId}/${byteId}`;
    const createBytes = await fetch(`${origin}${bytePath}`, {
      method: 'POST',
      headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
      body: JSON.stringify({
        operationId: byteId,
        name: 'Byte limit',
        graph: {
          version: 1,
          graph: { nodes: [{ ...nodes[0], data: { padding: 'x'.repeat(900_000) } }], edges: [] },
        },
      }),
    });
    expect(createBytes.status).toBe(200);
    const overBytes = await fetch(`${origin}${bytePath}/operations`, {
      method: 'POST',
      headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
      body: JSON.stringify({
        ...request,
        operation: {
          ...request.operation,
          node: { ...nodes[0], id: 'large-second-node', data: { padding: 'x'.repeat(200_000) } },
        },
      }),
    });
    expect(await overBytes.json()).toMatchObject({
      receipt: { status: 'rejected', code: 'Protected', documentVersion: 0 },
    });
  }, 30_000);

  test('volatile presence expires without becoming graph content', async () => {
    const data = await fixture();
    const id = crypto.randomUUID();
    const path = `/api/zloz/diagrams/${data.organizationId}/${id}`;
    const call = <Body extends object>(suffix: string, body: Body) =>
      fetch(`${origin}${path}${suffix}`, {
        method: 'POST',
        headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect(
      (
        await call('', {
          operationId: id,
          name: 'Presence expiry',
          graph: { version: 1, graph: { nodes: [], edges: [] } },
        })
      ).status,
    ).toBe(200);
    expect(
      await (
        await call('/presence', {
          connectionId: 'departed-tab',
          selection: [],
          cursor: { x: 2, y: 3 },
        })
      ).json(),
    ).toMatchObject({ peers: [expect.objectContaining({ connectionId: 'departed-tab' })] });
    await Bun.sleep(15_100);
    expect(
      await (
        await call('/presence', { connectionId: 'remaining-tab', selection: [], cursor: null })
      ).json(),
    ).toMatchObject({ peers: [expect.objectContaining({ connectionId: 'remaining-tab' })] });
    const exported = await fetch(`${origin}${path}/export`, {
      headers: { cookie: data.owner.cookie },
    });
    expect(parseGraph(await exported.text())).toEqual({ nodes: [], edges: [] });
  }, 25_000);

  test('workspace themes and C4/DDD emphasis are personal, persistent and never author graph changes', async () => {
    const data = await fixture();
    const id = crypto.randomUUID();
    const path = `/api/zloz/diagrams/${data.organizationId}/${id}`;
    const seed = parseGraph(JSON.stringify({ version: 1, graph: operationFixture.graph }));
    const graph: ZlozGraph = {
      nodes: [
        {
          ...seed.nodes[0]!,
          label: 'Product team',
          size: { width: 220, height: 112 },
          position: { x: 60, y: 90 },
          architecture: { family: 'c4', role: 'person' },
        },
        {
          ...seed.nodes[1]!,
          label: 'Order platform',
          size: { width: 220, height: 112 },
          position: { x: 470, y: 90 },
          architecture: { family: 'c4', role: 'software-system' },
        },
        {
          ...seed.nodes[0]!,
          id: 'ordering-context',
          label: 'Ordering context',
          size: { width: 220, height: 112 },
          position: { x: 60, y: 300 },
          architecture: { family: 'ddd', role: 'bounded-context', subdomain: 'core' },
        },
        {
          ...seed.nodes[1]!,
          id: 'billing-service',
          label: 'Billing service',
          size: { width: 220, height: 112 },
          position: { x: 470, y: 300 },
          architecture: { family: 'ddd', role: 'domain-service' },
        },
      ],
      edges: [
        { ...seed.edges[0]!, label: 'Plans and manages' },
        {
          ...seed.edges[0]!,
          id: 'billing-link',
          source: { node: 'ordering-context', port: 'out' },
          target: { node: 'billing-service', port: 'in' },
          label: 'Requests billing',
        },
      ],
    };
    const created = await fetch(`${origin}${path}`, {
      method: 'POST',
      headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
      body: JSON.stringify({
        operationId: id,
        name: 'Team architecture workspace',
        graph: { version: 1, graph },
      }),
    });
    expect(created.status).toBe(200);
    const browser = await chromium.launch();
    await using _browser = { [Symbol.asyncDispose]: () => browser.close() };
    const a = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: 'dark',
    });
    const b = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: 'light',
    });
    for (const [context, cookie] of [
      [a, data.owner.cookie],
      [b, data.editor.cookie],
    ] as const) {
      const equals = cookie.indexOf('=');
      await context.addCookies([
        {
          name: cookie.slice(0, equals),
          value: cookie.slice(equals + 1),
          url: origin,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
    }
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    let operations = 0;
    const errors: string[] = [];
    for (const page of [pageA, pageB]) {
      page.on('request', (request) => {
        if (request.method() === 'POST' && request.url().endsWith('/operations')) operations++;
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${origin}/app/${data.organizationId}/diagrams/${id}`);
      await page.getByRole('button', { name: 'System theme', exact: true }).waitFor();
      await page.getByText('Saved', { exact: true }).waitFor();
    }
    const paper = (page: Page) =>
      page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor);
    const surface = pageA.locator('[data-flow-surface]');
    const version = await pageA
      .locator('[data-confirmed-version]')
      .getAttribute('data-confirmed-version');
    expect(await paper(pageA)).toBe('rgb(11, 17, 16)');
    expect(await paper(pageB)).toBe('rgb(244, 245, 241)');
    expect(await pageA.title()).toBe('Team architecture workspace');
    await pageA.getByRole('button', { name: 'Dark theme', exact: true }).click();
    await pageA.getByRole('button', { name: 'Dark theme', exact: true }).waitFor();
    await browserExpect
      .poll(() =>
        a
          .cookies()
          .then((cookies) => cookies.find((cookie) => cookie.name === 'zloz-team-theme')?.value),
      )
      .toBe('dark');
    const initialHtml = await (await a.request.get(pageA.url())).text();
    expect(initialHtml).toContain('data-team-theme="dark"');
    expect(await paper(pageB)).toBe('rgb(244, 245, 241)');
    await pageA.screenshot({
      path: join(tmpdir(), 'zloz-c4-style-first-look.png'),
      fullPage: true,
    });
    const c4 = await surface.evaluate((element) => getComputedStyle(element).backgroundImage);
    await pageA.getByLabel('Canvas emphasis', { exact: true }).selectOption('ddd');
    await pageA.locator('[data-canvas-emphasis="ddd"]').waitFor();
    const ddd = await surface.evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(c4).toContain('radial-gradient');
    expect(ddd).not.toBe(c4);
    expect(await pageB.getByLabel('Canvas emphasis', { exact: true }).inputValue()).toBe('c4');
    const before = await surface.boundingBox();
    await pageA.getByRole('button', { name: 'Select Product team', exact: true }).click();
    await pageA.getByRole('textbox', { name: 'Node label', exact: true }).waitFor();
    expect(await surface.boundingBox()).toEqual(before);
    await pageA.getByRole('button', { name: 'System theme', exact: true }).click();
    await pageA.emulateMedia({ colorScheme: 'light' });
    await browserExpect.poll(() => paper(pageA)).toBe('rgb(244, 245, 241)');
    await pageA.emulateMedia({ colorScheme: 'dark' });
    await browserExpect.poll(() => paper(pageA)).toBe('rgb(11, 17, 16)');
    const screenshots = join(tmpdir(), 'zloz-c4-style-browser');
    await mkdir(screenshots, { recursive: true });
    for (const preference of ['dark', 'light']) {
      await pageA
        .getByRole('button', {
          name: `${preference === 'dark' ? 'Dark' : 'Light'} theme`,
          exact: true,
        })
        .click();
      await browserExpect
        .poll(() => paper(pageA))
        .toBe(preference === 'dark' ? 'rgb(11, 17, 16)' : 'rgb(244, 245, 241)');
      const contrast = await pageA.evaluate(() => {
        const rgb = (colour: string) => (colour.match(/[0-9.]+/g) ?? []).slice(0, 3).map(Number);
        const luminance = (colour: string) =>
          rgb(colour).reduce((sum, channel, index) => {
            const c = channel / 255;
            const linear = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            return sum + linear * ([0.2126, 0.7152, 0.0722][index] ?? 0);
          }, 0);
        const ratio = (a: string, b: string) =>
          (Math.max(luminance(a), luminance(b)) + 0.05) /
          (Math.min(luminance(a), luminance(b)) + 0.05);
        const body = getComputedStyle(document.body);
        const note = getComputedStyle(document.querySelector('.mode-note')!);
        const rail = getComputedStyle(document.querySelector('.tool-rail')!);
        const input = getComputedStyle(document.querySelector('.editor-inspector input')!);
        return {
          text: ratio(body.color, body.backgroundColor),
          muted: ratio(note.color, rail.backgroundColor),
          inputBoundary: ratio(input.borderTopColor, input.backgroundColor),
        };
      });
      expect(contrast.text).toBeGreaterThanOrEqual(4.5);
      expect(contrast.muted).toBeGreaterThanOrEqual(4.5);
      expect(contrast.inputBoundary).toBeGreaterThanOrEqual(3);
      for (const emphasis of ['c4', 'ddd']) {
        await pageA.getByLabel('Canvas emphasis', { exact: true }).selectOption(emphasis);
        await pageA.locator(`[data-canvas-emphasis="${emphasis}"]`).waitFor();
        await pageA.screenshot({
          path: join(screenshots, `${preference}-${emphasis}.png`),
          fullPage: true,
        });
      }
    }
    await pageA.getByLabel('Canvas emphasis', { exact: true }).selectOption('neutral');
    await pageA.locator('[data-canvas-emphasis="neutral"]').waitFor();
    expect(await surface.evaluate((element) => getComputedStyle(element).backgroundImage)).not.toBe(
      ddd,
    );
    for (const width of [360, 768, 1440]) {
      await pageA.setViewportSize({ width, height: 1000 });
      expect(await pageA.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await pageA.setViewportSize({ width: 360, height: 1000 });
    await pageA.screenshot({ path: join(screenshots, 'mobile-light-neutral.png'), fullPage: true });
    expect(
      await pageA.locator('[data-confirmed-version]').getAttribute('data-confirmed-version'),
    ).toBe(version);
    expect(
      await pageB.locator('[data-confirmed-version]').getAttribute('data-confirmed-version'),
    ).toBe(version);
    expect(parseGraph(await (await a.request.get(`${origin}${path}/export`)).text())).toEqual(
      graph,
    );
    expect(operations).toBe(0);
    expect(errors).toEqual([]);
  }, 60_000);

  test('a Teams viewer inspects the confirmed Order aggregate and follows peer changes without authoring', async () => {
    const data = await fixture();
    const id = crypto.randomUUID();
    const path = `/api/zloz/diagrams/${data.organizationId}/${id}`;
    const ownerPost = (
      suffix: string,
      body: ZlozOperationRequest | { operationId: string; name: string; graph: typeof orderWire },
    ) =>
      fetch(origin + path + suffix, {
        method: 'POST',
        headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect(
      (await ownerPost('', { operationId: id, name: 'Order model', graph: orderWire })).status,
    ).toBe(200);
    const browser = await chromium.launch();
    await using _browser = { [Symbol.asyncDispose]: () => browser.close() };
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const cookie = data.viewer.cookie;
    const equals = cookie.indexOf('=');
    await context.addCookies([
      { name: cookie.slice(0, equals), value: cookie.slice(equals + 1), url: origin },
    ]);
    const page = await context.newPage();
    const writes: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes(path) && !req.url().endsWith('/presence'))
        writes.push(req.url());
    });
    await page.goto(`${origin}/app/${data.organizationId}/diagrams/${id}`);
    await page.getByText('Saved', { exact: true }).waitFor();
    await page.getByLabel('Inspector view').selectOption('aggregate');
    const panel = page.getByRole('region', { name: 'Aggregate view' });
    await browserExpect(panel).toContainText('Select an aggregate');
    const selectOrder = page.getByRole('button', { name: 'Select Order', exact: true });
    await selectOrder.focus();
    await selectOrder.press('Enter');
    await browserExpect(panel.getByRole('heading', { name: 'Order', exact: true })).toBeVisible();
    await browserExpect(panel.getByText('PlaceOrder', { exact: true })).toBeVisible();
    await browserExpect(panel).toContainText('OrderPlaced');
    await browserExpect(panel).toContainText('Activates Request payment (inferred)');
    await browserExpect(panel.locator('button, input, select, textarea')).toHaveCount(0);
    expect(
      (
        await ownerPost('/operations', {
          version: 1,
          operationId: crypto.randomUUID(),
          operation: { type: 'RenameNode', id: 'placed', expected: 0, label: 'OrderAccepted' },
        })
      ).status,
    ).toBe(200);
    await browserExpect(panel).toContainText('OrderAccepted');
    await browserExpect(panel).not.toContainText('OrderPlaced');
    await page.getByRole('button', { name: 'Select PlaceOrder', exact: true }).click();
    await browserExpect(panel).toContainText('Select an aggregate');
    expect(writes).toEqual([]);
  }, 60_000);

  test('two Chromium sessions reconcile shared edits, safe Undo, disconnect and unknown replies', async () => {
    const data = await fixture();
    const browser = await chromium.launch();
    const a = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const b = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const addSession = async (context: typeof a, cookie: string) => {
      const index = cookie.indexOf('=');
      await context.addCookies([
        {
          name: cookie.slice(0, index),
          value: cookie.slice(index + 1),
          url: origin,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
    };
    const poll = async (predicate: () => Promise<boolean>) => {
      const deadline = Date.now() + 12_000;
      while (!(await predicate()) && Date.now() < deadline) await Bun.sleep(50);
      expect(await predicate()).toBe(true);
    };
    try {
      await addSession(a, data.owner.cookie);
      await addSession(b, data.editor.cookie);
      const pageA = await a.newPage();
      const pageB = await b.newPage();
      const errors: string[] = [];
      pageA.on('pageerror', (error) => errors.push(error.message));
      pageB.on('pageerror', (error) => errors.push(error.message));
      await pageA.goto(`${origin}/app/${data.organizationId}/diagrams/new`);
      await pageA.getByLabel('Diagram name', { exact: true }).fill('Browser shared system');
      await pageA.getByLabel('Import graph file (optional)', { exact: true }).setInputFiles({
        name: 'system.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ version: 1, graph: operationFixture.graph })),
      });
      await Promise.all([
        pageA.waitForURL(/diagrams\/[a-f0-9-]+$/),
        pageA.getByRole('button', { name: 'Create diagram', exact: true }).click(),
      ]);
      await pageB.goto(pageA.url());
      const saved = (page: typeof pageA) =>
        poll(async () => (await page.locator('[data-save-status]').textContent()) === 'Saved');
      const apiPath = `/api/zloz/diagrams/${data.organizationId}/${new URL(pageA.url()).pathname.split('/').at(-1)}`;
      const exportedGraph = async () =>
        parseGraph(await (await b.request.get(`${origin}${apiPath}/export`)).text());
      const allNodesVisible = async (count: number) => {
        const groups = operationFixture.graph.nodes.filter((node) => node.kind === 'group').length;
        await poll(async () => (await exportedGraph()).nodes.length === count + groups);
        const snapshot = Schema.decodeUnknownSync(
          Schema.Struct({ frame: Schema.Unknown.pipe(Schema.refine(isDiagramFrame)) }),
        )(await (await b.request.get(`${origin}${apiPath}`)).json());
        // New nodes can be outside the measured viewport. Preserve the complete
        // canonical count and use the real navigation control before counting DOM nodes.
        for (const page of [pageA, pageB]) {
          await poll(
            async () =>
              Number(
                await page
                  .locator('[data-confirmed-version]')
                  .getAttribute('data-confirmed-version'),
              ) >= snapshot.frame.document.version,
          );
          await page.getByRole('button', { name: 'Fit view', exact: true }).click();
          await poll(async () => (await page.locator('[data-flow-node]').count()) === count);
        }
      };
      await saved(pageA);
      await saved(pageB);
      expect(errors).toEqual([]);
      const alpha = (page: typeof pageA) => page.locator('[data-flow-node="a"]');
      expect(
        await alpha(pageA)
          .locator('[data-flow-resize]')
          .evaluate((handle) => {
            const style = getComputedStyle(handle);
            return {
              width: style.width,
              height: style.height,
              right: style.right,
              bottom: style.bottom,
              cursor: style.cursor,
              touchAction: style.touchAction,
            };
          }),
      ).toEqual({
        width: '24px',
        height: '24px',
        right: '-8px',
        bottom: '-8px',
        cursor: 'ew-resize',
        touchAction: 'none',
      });
      expect(
        await alpha(pageA)
          .locator('[data-flow-port="out"]')
          .evaluate((port) => {
            const style = getComputedStyle(port);
            return {
              width: style.width,
              height: style.height,
              background: style.backgroundColor,
              border: style.borderTopWidth,
              radius: style.borderRadius,
              cursor: style.cursor,
              pointerEvents: style.pointerEvents,
              position: style.position,
              right: style.right,
              bottom: style.bottom,
              translation: [
                new DOMMatrixReadOnly(style.transform).m41,
                new DOMMatrixReadOnly(style.transform).m42,
              ],
            };
          }),
      ).toEqual({
        width: '24px',
        height: '24px',
        background: 'rgb(40, 94, 153)',
        border: '2px',
        radius: '50%',
        cursor: 'crosshair',
        pointerEvents: 'auto',
        position: 'absolute',
        right: '-24px',
        bottom: '16px',
        translation: [-12, -12],
      });
      const nodeStyle = (page: typeof pageA) =>
        alpha(page).evaluate((node) => {
          const shell = getComputedStyle(node.firstElementChild!);
          const title = getComputedStyle(node.querySelector('[data-flow-handle]')!);
          return {
            height: shell.height,
            padding: shell.padding,
            border: shell.border,
            background: shell.backgroundColor,
            titlePadding: title.padding,
            titleBackground: title.backgroundColor,
            titleTouchAction: title.touchAction,
          };
        });
      expect(await nodeStyle(pageA)).toEqual({
        height: `${operationFixture.graph.nodes[0]!.size.height}px`,
        padding: '12px',
        border: '2px solid rgb(35, 107, 88)',
        background: 'rgb(255, 255, 255)',
        titlePadding: '0px',
        titleBackground: 'rgba(0, 0, 0, 0)',
        titleTouchAction: 'none',
      });
      expect(
        await pageA
          .locator('[data-flow-connections] button')
          .first()
          .evaluate((button) => {
            const style = getComputedStyle(button);
            return {
              padding: style.padding,
              wrap: style.overflowWrap,
              whitespace: style.whiteSpace,
            };
          }),
      ).toEqual({ padding: '6px 9px', wrap: 'anywhere', whitespace: 'normal' });
      const connectionButton = pageA.locator('[data-flow-connections] button').first();
      await connectionButton.click();
      await poll(async () => (await connectionButton.getAttribute('aria-pressed')) === 'true');
      const beforeSelection = await exportedGraph();
      const beforeSelectionVersion = await pageA
        .locator('[data-confirmed-version]')
        .getAttribute('data-confirmed-version');
      const selectionWrites: string[] = [];
      const observedSelectionWrite = (request: import('playwright').Request) => {
        if (
          request.method() === 'POST' &&
          new URL(request.url()).pathname === `${apiPath}/operations`
        )
          selectionWrites.push(request.method());
      };
      pageA.on('request', observedSelectionWrite);
      const title = alpha(pageA).locator('[data-flow-handle]');
      const titleBox = await title.boundingBox();
      if (!titleBox) throw new Error('Expected the native node title');
      const pressPoint = {
        x: titleBox.x + titleBox.width / 2,
        y: titleBox.y + titleBox.height / 2,
      };
      await pageA.mouse.move(pressPoint.x, pressPoint.y);
      await pageA.mouse.down();
      await pageA.mouse.move(pressPoint.x + 1, pressPoint.y + 2);
      await pageA.mouse.up();
      await poll(async () => (await title.getAttribute('aria-pressed')) === 'true');
      await saved(pageA);
      expect(await exportedGraph()).toEqual(beforeSelection);
      expect(
        await pageA.locator('[data-confirmed-version]').getAttribute('data-confirmed-version'),
      ).toBe(beforeSelectionVersion);
      expect(selectionWrites).toEqual([]);
      expect(
        await pageA.getByRole('button', { name: 'Undo my last edit', exact: true }).isEnabled(),
      ).toBe(false);
      await pageA.mouse.move(pressPoint.x, pressPoint.y);
      await pageA.mouse.down();
      await pageA.mouse.move(pressPoint.x + 40, pressPoint.y + 10, { steps: 5 });
      const previewX = await alpha(pageA).getAttribute('data-flow-x');
      const previewY = await alpha(pageA).getAttribute('data-flow-y');
      expect(previewX).not.toBeNull();
      expect(previewY).not.toBeNull();
      let finalX = previewX;
      let finalY = previewY;
      expect(await exportedGraph()).toEqual(beforeSelection);
      let releaseMove: (() => Promise<void>) | undefined;
      await pageA.route(`${origin}${apiPath}/operations`, (route) => {
        if (route.request().method() === 'POST' && !releaseMove) {
          releaseMove = () => route.continue();
          return;
        }
        return route.continue();
      });
      await pageA.mouse.up();
      try {
        await poll(async () => Boolean(releaseMove));
        await pageA.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
        // Preparation has completed and the POST is held: the local drag must
        // remain visible without claiming canonical acceptance or Saved.
        expect(await alpha(pageA).getAttribute('data-flow-x')).toBe(previewX);
        expect(await alpha(pageA).getAttribute('data-flow-y')).toBe(previewY);
        expect(await pageA.locator('[data-save-status]').textContent()).toBe('Saving…');
        expect(await exportedGraph()).toEqual(beforeSelection);
        const second = await title.boundingBox();
        if (!second) throw new Error('Expected the moving node title');
        await pageA.mouse.move(second.x + second.width / 2, second.y + second.height / 2);
        await pageA.mouse.down();
        await pageA.mouse.move(
          second.x + second.width / 2 + 20,
          second.y + second.height / 2 + 10,
          { steps: 5 },
        );
        await pageA.mouse.up();
        await pageA.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
        finalX = await alpha(pageA).getAttribute('data-flow-x');
        finalY = await alpha(pageA).getAttribute('data-flow-y');
        expect(finalX).not.toBe(previewX);
        expect(selectionWrites).toHaveLength(1);
        expect(await exportedGraph()).toEqual(beforeSelection);
      } finally {
        if (releaseMove) await releaseMove();
        await pageA.unroute(`${origin}${apiPath}/operations`);
      }
      await saved(pageA);
      await poll(async () => selectionWrites.length === 2);
      expect(await alpha(pageA).getAttribute('data-flow-x')).toBe(finalX);
      expect(await alpha(pageA).getAttribute('data-flow-y')).toBe(finalY);
      await poll(async () => (await alpha(pageB).getAttribute('data-flow-x')) === finalX);
      expect(await exportedGraph()).not.toEqual(beforeSelection);
      const firstMoveGraph = {
        ...beforeSelection,
        nodes: beforeSelection.nodes.map((node) =>
          node.id === 'a'
            ? { ...node, position: { x: Number(previewX), y: Number(previewY) } }
            : node,
        ),
      };
      const [pointerUndo] = await Promise.all([
        pageA.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === `${apiPath}/operations` &&
            response.request().method() === 'POST',
        ),
        pageA.getByRole('button', { name: 'Undo my last edit', exact: true }).click(),
      ]);
      expect(pointerUndo.status()).toBe(200);
      await saved(pageA);
      // Undo the latest queued gesture; the prior confirmed move remains.
      await poll(
        async () => JSON.stringify(await exportedGraph()) === JSON.stringify(firstMoveGraph),
      );
      expect(await exportedGraph()).toEqual(firstMoveGraph);
      const afterPointerUndo = Schema.decodeUnknownSync(
        Schema.Struct({ frame: Schema.Unknown.pipe(Schema.refine(isDiagramFrame)) }),
      )(await (await b.request.get(`${origin}${apiPath}`)).json());
      for (const page of [pageA, pageB])
        await poll(
          async () =>
            Number(
              await page.locator('[data-confirmed-version]').getAttribute('data-confirmed-version'),
            ) >= afterPointerUndo.frame.document.version,
        );
      pageA.off('request', observedSelectionWrite);
      const originalX = await alpha(pageA).getAttribute('data-flow-x');
      await pageA.getByRole('button', { name: 'Select Alpha', exact: true }).click();
      await poll(async () => (await connectionButton.getAttribute('aria-pressed')) === 'false');
      await poll(async () => (await nodeStyle(pageA)).border === '2px solid rgb(36, 105, 79)');
      // Deliver a snapshot failure after the edit's live acknowledgement. An
      // HTTP transport failure must renew the feed, rather than leave the UI
      // Reconnecting until another edit or the authorization lease ends.
      let abortSnapshot: (() => Promise<void>) | undefined;
      await pageA.route(`${origin}${apiPath}`, (route) => {
        if (route.request().method() === 'GET' && !abortSnapshot) {
          abortSnapshot = () => route.abort('failed');
          return;
        }
        return route.continue();
      });
      await pageA.keyboard.press('ArrowRight');
      await poll(async () => (await alpha(pageB).getAttribute('data-flow-x')) !== originalX);
      await saved(pageA);
      await poll(async () => Boolean(abortSnapshot));
      if (!abortSnapshot) throw new Error('Expected the post-edit snapshot request');
      await abortSnapshot();
      await pageA.unroute(`${origin}${apiPath}`);
      await poll(
        async () => (await pageA.locator('[data-save-status]').textContent()) === 'Reconnecting…',
      );
      await saved(pageA);
      await pageB.getByRole('button', { name: 'Select Alpha', exact: true }).click();
      await pageB.getByLabel('Node label', { exact: true }).fill('Peer label');
      await pageB.getByRole('button', { name: 'Rename node', exact: true }).click();
      await poll(
        async () =>
          (await pageA.getByRole('button', { name: 'Select Peer label', exact: true }).count()) ===
          1,
      );
      await poll(
        async () =>
          (await pageA
            .getByRole('button', { name: 'Calls — Peer label → Beta', exact: true })
            .count()) === 1,
      );
      await saved(pageB);
      await pageA.getByRole('button', { name: 'Undo my last edit', exact: true }).click();
      await poll(async () => (await alpha(pageB).getAttribute('data-flow-x')) === originalX);
      expect(
        await pageB.getByRole('button', { name: 'Select Peer label', exact: true }).count(),
      ).toBe(1);
      await saved(pageA);
      await pageA.getByRole('button', { name: 'Select Peer label', exact: true }).click();
      const moveStartX = await alpha(pageA).getAttribute('data-flow-x');
      await pageA.keyboard.press('ArrowRight');
      await poll(async () => (await alpha(pageB).getAttribute('data-flow-x')) !== moveStartX);
      await saved(pageA);
      await pageB.getByRole('button', { name: 'Select Peer label', exact: true }).click();
      const beforePeerX = await alpha(pageB).getAttribute('data-flow-x');
      await pageB.keyboard.press('ArrowRight');
      await poll(async () => (await alpha(pageB).getAttribute('data-flow-x')) !== beforePeerX);
      await saved(pageB);
      const peerX = await alpha(pageB).getAttribute('data-flow-x');
      await pageA.getByRole('button', { name: 'Undo my last edit', exact: true }).click();
      await poll(async () =>
        /refused|conflicted/.test((await pageA.getByRole('alert').textContent()) ?? ''),
      );
      expect(await alpha(pageA).getAttribute('data-flow-x')).toBe(peerX);
      await saved(pageA);
      // An uncommitted request remains uncertain through a reconnect; retry recovers
      // the original ID, rather than creating a second node.
      await pageA.route('**/operations', (route) => route.abort('failed'));
      await pageA.getByRole('button', { name: 'Add node', exact: true }).click();
      await poll(
        async () =>
          (await pageA.locator('[data-save-status]').textContent()) === 'Save outcome unknown',
      );
      expect(await pageB.locator('[data-flow-node]').count()).toBe(3);
      await pageA.unroute('**/operations');
      await pageA.getByRole('button', { name: 'Retry saved request', exact: true }).click();
      await allNodesVisible(4);
      await saved(pageA);
      // Commit while losing both reply and feed. No frame coverage means no Saved.
      await pageA.route('**/operations', async (route) => {
        await route.fetch();
        await route.abort('failed');
      });
      await a.setOffline(true);
      await pageA.getByRole('button', { name: 'Add node', exact: true }).click();
      await poll(
        async () =>
          (await pageA.locator('[data-save-status]').textContent()) === 'Save outcome unknown',
      );
      await pageA.unroute('**/operations');
      await a.setOffline(false);
      // Restoring the feed may confirm the committed request before a real
      // pointer click becomes actionable. Require either that click or an
      // observed Saved state with the retry control actually withdrawn. The
      // preceding uncommitted request still requires its real retry click.
      if ((await pageA.locator('[data-save-status]').textContent()) !== 'Saved') {
        const retry = pageA.getByRole('button', { name: 'Retry saved request', exact: true });
        try {
          await retry.click();
        } catch (error) {
          if (!(error instanceof playwrightErrors.TimeoutError)) throw error;
          expect(await retry.count()).toBe(0);
          await saved(pageA);
          console.info('Native committed-request recovery confirmed before retry activation');
        }
      }
      await allNodesVisible(5);
      await saved(pageA);
      // Lose only the HTTP reply after a real commit: feed coverage still confirms it.
      await pageA.route('**/operations', async (route) => {
        await route.fetch();
        await route.abort('failed');
      });
      await pageA.getByRole('button', { name: 'Add node', exact: true }).click();
      await allNodesVisible(6);
      await saved(pageA);
      await pageA.unroute('**/operations');
      await poll(
        async () =>
          (await pageA.getByLabel('Teammates in this diagram').textContent())?.includes('editor') ??
          false,
      );
      const added = pageA
        .locator('[data-flow-node]')
        .filter({ has: pageA.getByRole('button', { name: 'Select New node', exact: true }) });
      await added
        .nth(0)
        .getByRole('button', { name: 'Connect from New node: out', exact: true })
        .click();
      await added
        .nth(1)
        .getByRole('button', { name: 'Connect to New node: in', exact: true })
        .click();
      await poll(async () => (await exportedGraph()).edges.length === 3);
      await saved(pageA);
      await added.nth(0).getByRole('button', { name: 'Select New node', exact: true }).click();
      const resizedId = await added.nth(0).getAttribute('data-flow-node');
      await added.nth(0).locator('[data-flow-resize]').first().focus();
      await pageA.keyboard.press('ArrowRight');
      await poll(
        async () =>
          (await exportedGraph()).nodes.find((node) => node.id === resizedId)!.size.width > 160,
      );
      await saved(pageA);
      await pageA.getByRole('button', { name: 'Select Boundary', exact: true }).click();
      await pageA.getByRole('button', { name: 'Delete selection', exact: true }).click();
      await poll(async () => (await pageB.locator('[data-flow-group="g"]').count()) === 0);
      const deletedGroup = await exportedGraph();
      expect(deletedGroup.nodes.some((node) => node.id === 'c')).toBe(false);
      expect(deletedGroup.edges.some((edge) => edge.id === 'cb')).toBe(false);
      await saved(pageA);
      await pageA.getByRole('button', { name: 'Undo my last edit', exact: true }).click();
      await poll(async () => (await pageB.locator('[data-flow-group="g"]').count()) === 1);
      await saved(pageA);
      await pageA.getByRole('button', { name: 'Select Peer label', exact: true }).click();
      await pageA.getByRole('button', { name: 'Remove out port', exact: true }).click();
      await poll(async () => !(await exportedGraph()).edges.some((edge) => edge.id === 'ab'));
      expect((await exportedGraph()).nodes.find((node) => node.id === 'a')!.ports).toEqual([]);
      await saved(pageA);
      await pageA.getByRole('button', { name: 'Undo my last edit', exact: true }).click();
      await poll(async () => (await exportedGraph()).edges.some((edge) => edge.id === 'ab'));
      await saved(pageA);
      const restoredConnection = pageA.getByRole('button', {
        name: 'Calls — Peer label → Beta',
        exact: true,
      });
      await restoredConnection.click();
      await poll(async () => (await restoredConnection.getAttribute('aria-pressed')) === 'true');
      await pageA.screenshot({
        path: join(tmpdir(), 'zloz-m3-shared-desktop.png'),
        fullPage: true,
      });
      await pageB.setViewportSize({ width: 390, height: 844 });
      expect(
        await pageB.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await pageB.screenshot({ path: join(tmpdir(), 'zloz-m3-shared-mobile.png'), fullPage: true });
      expect(errors).toEqual([]);
    } finally {
      await a.close();
      await b.close();
      await browser.close();
    }
  }, 90_000);

  test.skipIf(process.env.ZLOZ_RUN_OPY_CONTRACT !== '1')(
    'OPY relationship decision contract binds exact acceptance to authenticated evidence',
    async () => {
      const data = await fixture();
      const {
        historicalFrame,
        shareRequest,
        acceptRequest,
        expectedProposed,
        acceptedEvent,
        graphScenarios,
      } = decisionWire;
      type BoardWrite =
        | {
            operationId: string;
            name: string;
            graph: { version: 1; graph: typeof historicalFrame.document.graph };
          }
        | typeof shareRequest
        | typeof acceptRequest
        | typeof graphScenarios.drag.request
        | typeof graphScenarios.changedEvidence.request
        | typeof graphScenarios.removedRelationship.request
        | {
            operationId: string;
            expectedVersion: number;
            checkpoint: Awaited<ReturnType<typeof parseDiagramCheckpoint>>;
          };
      const open = async () => {
        const id = crypto.randomUUID();
        const path = `${origin}/api/zloz/diagrams/${data.organizationId}/${id}`;
        const call = (suffix: string, cookie: string, body?: BoardWrite) =>
          fetch(path + suffix, {
            method: body === undefined ? 'GET' : 'POST',
            headers: { origin, cookie, 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
          });
        expect(
          (
            await call('', data.owner.cookie, {
              operationId: id,
              name: 'Relationship decision v1',
              graph: { version: 1, graph: historicalFrame.document.graph },
            })
          ).status,
        ).toBe(200);
        const read = async (cookie: string) => {
          const response = await call('', cookie);
          expect(response.status).toBe(200);
          return response.json();
        };
        const exportGraph = async () => {
          const response = await call('/export', data.viewer.cookie);
          expect(response.status).toBe(200);
          return response.text();
        };
        expect(await read(data.editor.cookie)).toMatchObject({
          frame: { document: { version: 0, graph: historicalFrame.document.graph } },
        });
        return { id, call, read, exportGraph };
      };

      const board = await open();
      const baseline = await board.exportGraph();
      expect<unknown>(parseGraph(baseline)).toEqual(historicalFrame.document.graph);
      const checkpointResponse = await board.call('/checkpoint', data.owner.cookie);
      expect(checkpointResponse.status).toBe(200);
      const checkpoint = await parseDiagramCheckpoint(await checkpointResponse.text());
      const spoofed = { ...shareRequest, actorId: data.owner.userId };
      expect((await board.call('/decisions', data.editor.cookie, spoofed)).status).toBe(400);
      const shared = await board.call('/decisions', data.editor.cookie, shareRequest);
      expect(shared.status).toBe(200);
      const proposed = { ...expectedProposed, requestedBy: data.editor.userId };
      expect(await shared.json()).toEqual({ status: 'recorded', record: proposed });
      expect(await board.read(data.owner.cookie)).toMatchObject({
        frame: { relationshipDecisions: [proposed] },
      });
      expect(await board.exportGraph()).toBe(baseline);
      expect((await board.call('/decisions', data.viewer.cookie, acceptRequest)).status).toBe(403);
      expect((await board.call('/decisions', data.outsider.cookie, acceptRequest)).status).toBe(
        403,
      );
      expect(
        (await board.call('/operations', data.editor.cookie, graphScenarios.drag.request)).status,
      ).toBe(200);

      const movedGraph = await board.exportGraph();
      const accepted = {
        ...acceptedEvent.outcome.record,
        requestedBy: data.editor.userId,
        acceptedBy: data.owner.userId,
      };
      const accepting = await board.call('/decisions', data.owner.cookie, acceptRequest);
      expect(accepting.status).toBe(200);
      expect(await accepting.json()).toEqual({
        status: graphScenarios.drag.expectedAcceptance,
        record: accepted,
      });
      const retried = await board.call('/decisions', data.owner.cookie, acceptRequest);
      expect(retried.status).toBe(200);
      expect(await retried.json()).toEqual({ status: 'recorded', record: accepted });
      const differentRevision = {
        ...acceptRequest,
        command: { ...acceptRequest.command, revision: acceptRequest.command.revision + 1 },
      };
      const rebound = await board.call('/decisions', data.owner.cookie, differentRevision);
      expect(rebound.status).toBe(200);
      expect(await rebound.json()).toEqual({ status: 'rejected', code: 'OperationIdMismatch' });
      expect(await board.read(data.viewer.cookie)).toMatchObject({
        frame: { relationshipDecisions: [accepted] },
      });
      expect(await board.exportGraph()).toBe(movedGraph);

      const socketUrl = new URL('/api/zloz/live', origin.replace('http:', 'ws:'));
      socketUrl.searchParams.set(
        'read',
        JSON.stringify({
          id: '1',
          tag: 'ZlozDiagramDeltaV1.events',
          payload: { key: JSON.stringify([data.organizationId, board.id]), after: 0 },
        }),
      );
      const socket = new NativeWebSocket(socketUrl, {
        headers: { cookie: data.viewer.cookie, origin },
      });
      const messages: string[] = [];
      socket.addEventListener('message', (event) => messages.push(String(event.data)));
      try {
        const entries = () => messages.flatMap(deltaEntries);
        await browserExpect
          .poll(() => entries().some((entry) => entry.kind === 'caught-up'))
          .toBe(true);
        expect(
          entries().flatMap((entry) => (entry.kind === 'delta' ? [entry.delta.payload.kind] : [])),
        ).toEqual(['reset', 'noop', 'graph', 'noop']);
        expect(messages.join('')).not.toContain(accepted.content.statement);
      } finally {
        socket.close();
      }

      const restored = await board.call('/restore', data.owner.cookie, {
        operationId: 'opy-restore',
        expectedVersion: 1,
        checkpoint,
      });
      expect(restored.status).toBe(200);
      expect(await restored.json()).toMatchObject({ status: 'restored', documentVersion: 2 });
      expect(await board.read(data.viewer.cookie)).toMatchObject({
        frame: { relationshipDecisions: [accepted], relationshipDecisionRecoveryVersion: 2 },
      });
      expect(await board.exportGraph()).toBe(baseline);

      const race = await open();
      expect((await race.call('/decisions', data.editor.cookie, shareRequest)).status).toBe(200);
      const concurrentReviews = await Promise.all([
        race.call('/decisions', data.owner.cookie, acceptRequest),
        race.call('/decisions', data.editor.cookie, acceptRequest),
      ]);
      const outcomes = await Promise.all(concurrentReviews.map((response) => response.json()));
      expect(outcomes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: 'recorded',
            record: expect.objectContaining({ status: 'accepted' }),
          }),
          { status: 'rejected', code: 'ProposalNotOpen' },
        ]),
      );

      for (const scenario of [graphScenarios.changedEvidence, graphScenarios.removedRelationship]) {
        const concurrent = await open();
        expect((await concurrent.call('/decisions', data.editor.cookie, shareRequest)).status).toBe(
          200,
        );
        expect(
          (await concurrent.call('/operations', data.editor.cookie, scenario.request)).status,
        ).toBe(200);
        const response = await concurrent.call('/decisions', data.owner.cookie, acceptRequest);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          status: 'rejected',
          code: scenario.expectedAcceptance,
        });
        expect(await concurrent.read(data.editor.cookie)).toMatchObject({
          frame: { relationshipDecisions: [proposed] },
        });
      }
    },
    30_000,
  );

  test.skipIf(process.env.ZLOZ_RUN_OPY_CONTRACT !== '1')(
    'OPY relationship decision UI shares with a second editor and reconnects without editing the graph',
    async () => {
      const data = await fixture();
      const id = crypto.randomUUID();
      const path = `/api/zloz/diagrams/${data.organizationId}/${id}`;
      const room = `${origin}/app/${data.organizationId}/diagrams/${id}`;
      const create = await fetch(origin + path, {
        method: 'POST',
        headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
        body: JSON.stringify({
          operationId: id,
          name: 'OPY shared review',
          graph: { version: 1, graph: decisionWire.historicalFrame.document.graph },
        }),
      });
      expect(create.status).toBe(200);
      const exported = async () => {
        const response = await fetch(origin + path + '/export', {
          headers: { cookie: data.owner.cookie },
        });
        expect(response.status).toBe(200);
        return response.text();
      };
      const original = await exported();
      const browser = await chromium.launch();
      await using _browser = { [Symbol.asyncDispose]: () => browser.close() };
      let clefCalls = 0;
      const open = async (cookie: string, colorScheme: 'light' | 'dark') => {
        const context = await browser.newContext({
          colorScheme,
          viewport: { width: 1440, height: 1000 },
        });
        const equals = cookie.indexOf('=');
        await context.addCookies([
          { name: cookie.slice(0, equals), value: cookie.slice(equals + 1), url: origin },
        ]);
        const page = await context.newPage();
        // Keep sessions, proposal writes and live frames native. Substitute only the
        // staging capability and model result in this isolated browser qualification.
        await page.route(origin + path, async (route) => {
          if (route.request().method() !== 'GET') return route.continue();
          const response = await route.fetch();
          const body = await response.json();
          await route.fulfill({ response, json: { ...body, clefShadow: true } });
        });
        await page.route(origin + path + '/clef-review', async (route) => {
          expect(route.request().method()).toBe('POST');
          const current = Schema.decodeUnknownSync(ClefReference, { onExcessProperty: 'error' })(
            route.request().postDataJSON(),
          );
          const confirmed = await fetch(origin + path, { headers: { cookie } });
          const body = Schema.decodeUnknownSync(
            Schema.Struct({
              frame: Schema.Unknown.pipe(Schema.refine(isDiagramFrame)),
            }),
          )(await confirmed.json());
          expect(body.frame.relationshipDecisions?.[0]).toMatchObject({
            ...current,
            status: 'proposed',
          });
          clefCalls++;
          await route.fulfill({ json: { ...current, needsEvidenceProbability: 0.87 } });
        });
        await page.goto(room);
        await browserExpect(page.locator('[data-save-status]')).toHaveText('Saved');
        return page;
      };
      const [editor, owner] = await Promise.all([
        open(data.editor.cookie, 'dark'),
        open(data.owner.cookie, 'light'),
      ]);
      const openOpy = async (page: Page) => {
        const launcher = page.getByRole('button', { name: 'Ask OPY', exact: true });
        await browserExpect(launcher).toBeVisible();
        await launcher.click();
        const panel = page.getByRole('region', { name: 'OPY relationship decisions' });
        await browserExpect(panel).toBeFocused();
        return panel;
      };
      await editor.getByRole('button', { name: 'Calls — Alpha → Beta', exact: true }).click();
      const draft = await openOpy(editor);
      await draft
        .getByLabel('Decision', { exact: true })
        .fill('Keep the order before calling Beta.');
      await draft
        .getByLabel('Rationale', { exact: true })
        .fill('An accepted order should survive a Beta outage.');
      await draft.getByRole('button', { name: 'Share proposal', exact: true }).click();
      const review = await openOpy(owner);
      await browserExpect(review.getByText('Keep the order before calling Beta.')).toBeVisible();
      expect(clefCalls).toBe(0);
      await review.getByRole('button', { name: 'Run Clef review', exact: true }).click();
      const advisory = 'Clef estimates a 87% chance that more evidence is needed.';
      await browserExpect(review.getByText(advisory, { exact: true })).toBeVisible();
      await browserExpect(draft.getByText(advisory, { exact: true })).toHaveCount(0);
      for (const panel of [review, draft])
        await browserExpect(
          panel.getByText('Proposal awaiting review', { exact: true }),
        ).toBeVisible();
      expect(clefCalls).toBe(1);
      await review.getByRole('button', { name: 'Accept decision', exact: true }).click();
      for (const page of [owner, editor]) {
        const panel = page.getByRole('region', { name: 'OPY relationship decisions' });
        await browserExpect(panel.getByText('Accepted · implementation unverified')).toBeVisible();
        await browserExpect(panel.getByText(advisory, { exact: true })).toHaveCount(0);
        await page.reload();
        await browserExpect(page.locator('[data-save-status]')).toHaveText('Saved');
        await browserExpect(
          (await openOpy(page)).getByText('Accepted · implementation unverified'),
        ).toBeVisible();
      }
      await editor.bringToFront();
      await editor.getByRole('button', { name: 'Close OPY', exact: true }).press('Enter');
      const launcher = editor.getByRole('button', { name: 'Ask OPY', exact: true });
      await browserExpect(launcher).toBeFocused();
      await launcher.press('Enter');
      await editor.setViewportSize({ width: 390, height: 844 });
      await browserExpect(
        editor.getByRole('region', { name: 'OPY relationship decisions' }),
      ).toBeVisible();
      expect(await exported()).toBe(original);
    },
    45_000,
  );

  test('public delta history replays beyond receipt coverage with exact canonical parity and current authorization', async () => {
    const data = await fixture();
    const id = crypto.randomUUID();
    const path = `/api/zloz/diagrams/${data.organizationId}/${id}`;
    const call = <Body extends object>(body?: Body, suffix = '') =>
      fetch(origin + path + suffix, {
        method: body ? 'POST' : 'GET',
        headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    expect(
      (
        await call({
          operationId: id,
          name: 'Delta replay',
          graph: { version: 1, graph: operationFixture.graph },
        })
      ).status,
    ).toBe(200);
    const opened = Schema.decodeUnknownSync(
      Schema.Struct({
        frame: Schema.Unknown.pipe(Schema.refine(isDiagramFrame)),
        feed: DiagramFeedSchema,
      }),
    )(await (await call()).json());
    for (let i = 0; i < 130; i++) {
      const response = await call(
        {
          version: 1,
          operationId: `delta-${i}`,
          operation: { type: 'RenameNode', id: 'a', expected: i, label: `Delta ${i}` },
        },
        '/operations',
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        receipt: { status: 'accepted', documentVersion: i + 1 },
      });
    }
    const socketFor = (cookie: string, diagramId: string, after: number) => {
      const url = new URL('/api/zloz/live', origin.replace('http:', 'ws:'));
      url.searchParams.set(
        'read',
        JSON.stringify({
          id: '1',
          tag: 'ZlozDiagramDeltaV1.events',
          payload: { key: JSON.stringify([data.organizationId, diagramId]), after },
        }),
      );
      return new NativeWebSocket(url, { headers: { cookie, origin } });
    };
    const socket = socketFor(data.viewer.cookie, id, opened.feed.cursor);
    const messages: string[] = [];
    socket.addEventListener('message', (event) => messages.push(String(event.data)));
    try {
      const deadline = Date.now() + 10_000;
      const entries = () =>
        messages.flatMap((text) => {
          try {
            return deltaEntries(text);
          } catch {
            return [];
          }
        });
      while (!entries().some((entry) => entry.kind === 'caught-up') && Date.now() < deadline)
        await Bun.sleep(20);
      const all = entries();
      expect(all.filter((entry) => entry.kind === 'delta')).toHaveLength(130);
      let frame: DiagramFrame = opened.frame;
      let cursor = opened.feed.cursor;
      for (const entry of all) {
        if (entry.kind === 'caught-up') {
          expect(entry.cursor).toBe(cursor);
          continue;
        }
        expect(entry.cursor).toBe(++cursor);
        const result = applyDiagramDelta(frame, entry.delta);
        expect(result._tag).toBe('Applied');
        if (result._tag === 'Resync') throw new Error(result.reason);
        frame = result.frame;
      }
      const canonical = Schema.decodeUnknownSync(
        Schema.Struct({ frame: Schema.Unknown.pipe(Schema.refine(isDiagramFrame)) }),
      )(await (await call()).json()).frame;
      expect(frame.document).toEqual(canonical.document);
      expect(frame.coverage).toEqual(canonical.coverage);
      expect(frame.sourceVersion).toBe(canonical.sourceVersion);
      expect(frame.coverage).toHaveLength(128);
      expect(messages.join('')).not.toContain('binding');
      expect(messages.join('')).not.toContain('inverse');
      expect(messages.join('')).not.toContain('"document"');
      expect(
        (
          await fixtureCall('/revoke', {
            userId: data.viewer.userId,
            organizationId: data.organizationId,
          })
        ).status,
      ).toBe(204);
      await call(
        {
          version: 1,
          operationId: 'after-revoke',
          operation: { type: 'RenameNode', id: 'a', expected: 130, label: 'Must stay private' },
        },
        '/operations',
      );
      const denialDeadline = Date.now() + 5000;
      while (!messages.join('').includes('DiagramAccessDenied') && Date.now() < denialDeadline)
        await Bun.sleep(20);
      expect(messages.join('')).toContain('DiagramAccessDenied');
      expect(messages.join('')).not.toContain('Must stay private');
    } finally {
      socket.close();
    }
    const denied = socketFor(data.outsider.cookie, crypto.randomUUID(), 0);
    const leaked: string[] = [];
    denied.addEventListener('message', (event) => leaked.push(String(event.data)));
    const refused = await new Promise<boolean>((resolve) => {
      denied.addEventListener('error', () => resolve(true));
      denied.addEventListener('open', () => resolve(false));
      setTimeout(() => resolve(false), 3000);
    });
    denied.close();
    expect(refused).toBe(true);
    expect(leaked).toEqual([]);
  }, 60_000);

  const hasPublicRead = (text: string) => {
    if (liveFrames(text).length > 0) return true;
    try {
      return deltaEntries(text).length > 0;
    } catch {
      return false;
    }
  };
  test('lease renewal retains the authorized feed until its replacement catches up', async () => {
    const data = await fixture();
    const diagramId = crypto.randomUUID();
    const path = '/api/zloz/diagrams/' + data.organizationId + '/' + diagramId;
    expect(
      (
        await fetch(origin + path, {
          method: 'POST',
          headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
          body: JSON.stringify({
            operationId: diagramId,
            name: 'Overlapping renewal',
            graph: { version: 1, graph: operationFixture.graph },
          }),
        })
      ).status,
    ).toBe(200);
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const separator = data.owner.cookie.indexOf('=');
    await context.addCookies([
      {
        name: data.owner.cookie.slice(0, separator),
        value: data.owner.cookie.slice(separator + 1),
        url: origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let routes = 0;
      let candidate: WebSocketRoute | undefined;
      let forwardCandidate = false;
      const held: (string | Buffer)[] = [];
      const closed = new Set<number>();
      await page.routeWebSocket(/\/api\/zloz\/live(?:\?|$)/, (route) => {
        const id = ++routes;
        const server = route.connectToServer();
        // Preserve the actual close code/reason and server lease in both directions.
        route.onClose((code, reason) => {
          if (closed.has(id)) return;
          closed.add(id);
          return server.close({ code, reason });
        });
        server.onClose((code, reason) => {
          if (closed.has(id)) return;
          closed.add(id);
          return route.close({ code, reason });
        });
        if (id === 2) {
          candidate = route;
          server.onMessage((message) => {
            if (forwardCandidate) route.send(message);
            else held.push(message);
          });
        }
      });
      const poll = async (predicate: () => Promise<boolean>, milliseconds = 12_000) => {
        const deadline = Date.now() + milliseconds;
        while (!(await predicate()) && Date.now() < deadline) await Bun.sleep(25);
        expect(await predicate()).toBe(true);
      };
      await page.goto(origin + '/app/' + data.organizationId + '/diagrams/' + diagramId);
      await poll(async () => (await page.locator('[data-save-status]').textContent()) === 'Saved');
      await poll(
        async () => routes === 2 && held.some((value) => hasPublicRead(String(value))),
        22_000,
      );
      expect(closed.has(1)).toBe(false);
      const rename = async (label: string) => {
        const body = await (await context.request.get(origin + path)).json();
        const frame: unknown = body.frame;
        expect(isDiagramFrame(frame)).toBe(true);
        if (!isDiagramFrame(frame)) throw new Error('Missing canonical renewal frame');
        const clock = frame.document.nodes.find((node) => node.id === 'a')!.label;
        const response = await context.request.post(origin + path + '/operations', {
          headers: { origin },
          data: {
            version: 1,
            operationId: crypto.randomUUID(),
            operation: { type: 'RenameNode', id: 'a', expected: clock, label },
          },
        });
        expect(response.status()).toBe(200);
        expect((await response.json()).receipt.status).toBe('accepted');
        await poll(
          async () =>
            (await page.getByRole('button', { name: 'Select ' + label, exact: true }).count()) ===
            1,
        );
      };
      await rename('Renewal first');
      await rename('Renewal second');
      expect(closed.has(1)).toBe(false);
      if (!candidate) throw new Error('Missing renewal candidate');
      const first = held.findIndex((value) => hasPublicRead(String(value)));
      candidate.send(held.splice(first, 1)[0]!);
      await Bun.sleep(50);
      expect(closed.has(1)).toBe(false);
      expect(
        await page.getByRole('button', { name: 'Select Renewal second', exact: true }).count(),
      ).toBe(1);
      forwardCandidate = true;
      for (const message of held.splice(0)) candidate.send(message);
      await poll(async () => closed.has(1));
      expect(closed.has(2)).toBe(false);
      await poll(async () => (await page.locator('[data-save-status]').textContent()) === 'Saved');
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await browser.close();
    }
  }, 60_000);

  test('owner checkpoint recovery is previewed, atomic, target-bound and retryable on the real app', async () => {
    const data = await fixture();
    const id = crypto.randomUUID();
    const path = `/api/zloz/diagrams/${data.organizationId}/${id}`;
    const call = <Body extends object>(suffix: string, cookie: string, body?: Body) =>
      fetch(`${origin}${path}${suffix}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { cookie, origin, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    expect(
      (
        await call('', data.owner.cookie, {
          operationId: id,
          name: 'Recovery proof',
          graph: { version: 1, graph: operationFixture.graph },
        })
      ).status,
    ).toBe(200);
    const checkpoint = await parseDiagramCheckpoint(
      await (await call('/checkpoint', data.owner.cookie)).text(),
    );
    for (const actor of [data.editor, data.viewer, data.outsider])
      expect((await call('/checkpoint', actor.cookie)).status).toBe(403);
    const move = parseOperationRequest(operationFixture.move);
    expect((await call('/operations', data.owner.cookie, move)).status).toBe(200);
    const restore = { operationId: 'restore-native', expectedVersion: 1, checkpoint };
    expect((await call('/restore', data.editor.cookie, restore)).status).toBe(403);
    expect((await call('/restore', data.viewer.cookie, restore)).status).toBe(403);
    expect((await call('/restore', data.outsider.cookie, restore)).status).toBe(403);
    expect(
      (
        await call('/restore', data.owner.cookie, {
          ...restore,
          checkpoint: { ...checkpoint, digest: '0'.repeat(64) },
        })
      ).status,
    ).toBe(400);
    expect(
      await (
        await call('/restore', data.owner.cookie, {
          ...restore,
          operationId: 'stale-restore',
          expectedVersion: 0,
        })
      ).json(),
    ).toMatchObject({ status: 'conflict', documentVersion: 1 });
    const restored = await (await call('/restore', data.owner.cookie, restore)).json();
    expect(restored).toMatchObject({ status: 'restored', documentVersion: 2 });
    expect(await (await call('/restore', data.owner.cookie, restore)).json()).toEqual(restored);
    expect(
      (await call('/restore', data.owner.cookie, { ...restore, expectedVersion: 2 })).status,
    ).toBe(409);
    expect(parseGraph(await (await call('/export', data.owner.cookie)).text())).toEqual(
      parseGraph(JSON.stringify({ version: 1, graph: operationFixture.graph })),
    );
    const foreign = await createDiagramCheckpoint(
      { teamId: data.organizationId, diagramId: 'another-diagram' },
      0,
      checkpoint.graph,
    );
    expect(
      (
        await call('/restore', data.owner.cookie, {
          ...restore,
          operationId: 'foreign-checkpoint',
          expectedVersion: 2,
          checkpoint: foreign,
        })
      ).status,
    ).toBe(400);
    const alternatives = await Promise.all(
      ['A', 'B'].map((label) =>
        createDiagramCheckpoint(checkpoint.target, 2, {
          ...checkpoint.graph,
          nodes: checkpoint.graph.nodes.map((node) =>
            node.id === 'a' ? { ...node, label } : node,
          ),
        }),
      ),
    );
    const race = await Promise.all(
      alternatives.map(async (saved, index) =>
        Schema.decodeUnknownSync(
          Schema.Struct({ status: Schema.String, documentVersion: Schema.Number }),
        )(
          await (
            await call('/restore', data.owner.cookie, {
              operationId: `recovery-race-${index}`,
              expectedVersion: 2,
              checkpoint: saved,
            })
          ).json(),
        ),
      ),
    );
    expect(race.map((reply) => reply.status).sort()).toEqual(['conflict', 'restored']);
    expect(race.map((reply) => reply.documentVersion)).toEqual([3, 3]);
    const browser = await chromium.launch();
    const context = await browser.newContext();
    try {
      const at = data.owner.cookie.indexOf('=');
      await context.addCookies([
        {
          name: data.owner.cookie.slice(0, at),
          value: data.owner.cookie.slice(at + 1),
          url: origin,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      const page = await context.newPage();
      await page.goto(`${origin}/app/${data.organizationId}/diagrams/${id}/recovery`);
      await page.getByLabel('Checkpoint file', { exact: true }).setInputFiles({
        name: 'checkpoint.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(checkpoint)),
      });
      await page.getByRole('button', { name: 'Preview recovery', exact: true }).click();
      expect(
        await page.getByRole('heading', { name: 'Review recovery', exact: true }).count(),
      ).toBe(1);
      await page.screenshot({
        path: join(tmpdir(), 'zloz-m4-recovery-preview.png'),
        fullPage: true,
      });
      await page
        .getByRole('button', { name: 'Apply checkpoint as a new version', exact: true })
        .focus();
      await page.keyboard.press('Enter');
      expect(await page.getByRole('status').textContent()).toContain('Recovered as version 4');
      expect(parseGraph(await (await call('/export', data.owner.cookie)).text())).toEqual(
        checkpoint.graph,
      );
    } finally {
      await context.close();
      await browser.close();
    }
  }, 40_000);

  test('an existing editor clears Undo after owner recovery and reconnect catch-up beyond receipt coverage', async () => {
    const data = await fixture();
    const id = crypto.randomUUID();
    const path = `/api/zloz/diagrams/${data.organizationId}/${id}`;
    const call = <Body extends object>(suffix: string, body?: Body) =>
      fetch(`${origin}${path}${suffix}`, {
        method: body ? 'POST' : 'GET',
        headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    expect(
      (
        await call('', {
          operationId: id,
          name: 'Undo reset qualification',
          graph: { version: 1, graph: operationFixture.graph },
        })
      ).status,
    ).toBe(200);
    const checkpoint = await parseDiagramCheckpoint(await (await call('/checkpoint')).text());
    const browser = await chromium.launch();
    const context = await browser.newContext();
    try {
      const at = data.editor.cookie.indexOf('=');
      await context.addCookies([
        {
          name: data.editor.cookie.slice(0, at),
          value: data.editor.cookie.slice(at + 1),
          url: origin,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      const page = await context.newPage();
      type Observation = string | number | boolean | null;
      const poll = async (
        read: () => Promise<Observation>,
        expected: Observation,
        timeout = 10_000,
      ) => {
        const deadline = Date.now() + timeout;
        let value = await read();
        while (value !== expected && Date.now() < deadline) {
          await Bun.sleep(25);
          value = await read();
        }
        expect(value).toEqual(expected);
      };
      const saved = () => poll(() => page.locator('[data-save-status]').textContent(), 'Saved');
      const undo = page.getByRole('button', { name: 'Undo my last edit', exact: true });
      const rename = async (label: string) => {
        await page.getByRole('button', { name: /^Select (Alpha|Editor after recovery)$/ }).focus();
        await page.keyboard.press('Space');
        await page.getByLabel('Node label', { exact: true }).fill(label);
        await page.getByRole('button', { name: 'Rename node', exact: true }).click();
        await saved();
        await poll(() => page.locator('[data-flow-handle="a"] .node-name').textContent(), label);
      };
      const current = async () =>
        Schema.decodeUnknownSync(
          Schema.Struct({
            frame: Schema.Struct({
              document: Schema.Struct({ version: Schema.Number }),
              sourceVersion: Schema.Number,
              undoResetVersion: Schema.Number,
            }),
          }),
        )(await (await call('')).json()).frame;
      await page.goto(`${origin}/app/${data.organizationId}/diagrams/${id}`);
      await saved();
      await rename('Editor before recovery');
      expect(await undo.isEnabled()).toBe(true);
      let version = (await current()).document.version;
      expect(
        await (
          await call('/restore', {
            operationId: 'undo-stale-restore',
            expectedVersion: 0,
            checkpoint,
          })
        ).json(),
      ).toMatchObject({ status: 'conflict' });
      const unchanged = await parseDiagramCheckpoint(await (await call('/checkpoint')).text());
      const noChange = await (
        await call('/restore', {
          operationId: 'undo-unchanged-restore',
          expectedVersion: version,
          checkpoint: unchanged,
        })
      ).json();
      expect(noChange).toMatchObject({ status: 'unchanged' });
      const decision = Schema.decodeUnknownSync(Schema.Struct({ sourceVersion: Schema.Number }))(
        noChange,
      );
      await poll(async () => (await current()).sourceVersion, decision.sourceVersion);
      expect((await current()).undoResetVersion).toBe(0);
      await poll(
        async () =>
          Number(
            await page.locator('[data-confirmed-version]').getAttribute('data-confirmed-version'),
          ),
        version,
      );
      expect(await undo.isEnabled()).toBe(true);
      const restored = Schema.decodeUnknownSync(Schema.Struct({ documentVersion: Schema.Number }))(
        await (
          await call('/restore', {
            operationId: 'undo-reset',
            expectedVersion: version,
            checkpoint,
          })
        ).json(),
      );
      await poll(() => page.locator('[data-flow-handle="a"] .node-name').textContent(), 'Alpha');
      await poll(() => undo.isDisabled(), true);
      expect(await page.getByRole('alert').count()).toBe(0);
      await rename('Editor after recovery');
      expect(await undo.isEnabled()).toBe(true);
      await undo.click();
      await saved();
      await poll(() => page.locator('[data-flow-handle="a"] .node-name').textContent(), 'Alpha');
      await rename('Editor before disconnect');
      expect(await undo.isEnabled()).toBe(true);
      await context.setOffline(true);
      await Bun.sleep(26_000);
      version = (await current()).document.version;
      const reset = Schema.decodeUnknownSync(Schema.Struct({ documentVersion: Schema.Number }))(
        await (
          await call('/restore', {
            operationId: 'undo-offline-reset',
            expectedVersion: version,
            checkpoint,
          })
        ).json(),
      );
      let clock = reset.documentVersion;
      for (let index = 0; index < 130; index++) {
        const reply = await (
          await call('/operations', {
            version: 1,
            operationId: `undo-catchup-${index}`,
            operation: { type: 'RenameNode', id: 'a', expected: clock, label: `Catch-up ${index}` },
          })
        ).json();
        const receipt = Schema.decodeUnknownSync(
          Schema.Struct({
            receipt: Schema.Struct({
              status: Schema.Literal('accepted'),
              documentVersion: Schema.Number,
            }),
          }),
        )(reply).receipt;
        clock = receipt.documentVersion;
      }
      await poll(async () => (await current()).document.version, clock);
      const opened = await (await call('')).json();
      const published = Schema.decodeUnknownSync(
        Schema.Struct({
          frame: Schema.Struct({
            undoResetVersion: Schema.Number,
            coverage: Schema.Array(Schema.Struct({ operationId: Schema.String })),
            document: Schema.Struct({ undo: Schema.Array(Schema.Unknown) }),
          }),
        }),
      )(opened).frame;
      expect(published.undoResetVersion).toBe(reset.documentVersion);
      expect(published.undoResetVersion).toBeGreaterThan(restored.documentVersion);
      expect(published.document.undo).toEqual([]);
      expect(published.coverage).toHaveLength(128);
      expect(
        published.coverage.every((entry) => entry.operationId.startsWith('undo-catchup-')),
      ).toBe(true);
      await context.setOffline(false);
      await poll(
        () => page.locator('[data-flow-handle="a"] .node-name').textContent(),
        'Catch-up 129',
      );
      await saved();
      expect(await undo.isDisabled()).toBe(true);
      expect(await page.getByRole('alert').count()).toBe(0);
    } finally {
      await context.close();
      await browser.close();
    }
  }, 120_000);

  test.skipIf(process.env.ZLOZ_RUN_LOAD !== '1')(
    'five-editor declared load and checkpoint catch-up qualification',
    async () => {
      const data = await fixture();
      const actors = [data.owner, data.editor];
      for (let index = 0; index < 3; index++) {
        const actor = await newUser(`load-${index}`);
        const invited = await formPost(`/app/${data.organizationId}`, data.owner.cookie, {
          action: 'invite',
          email: actor.email,
          role: 'editor',
        });
        expect(invited.status).toBe(303);
        const team = await (
          await fetch(`${origin}/api/zloz/teams/${data.organizationId}`, {
            headers: { cookie: data.owner.cookie },
          })
        ).json();
        const invitations = Schema.decodeUnknownSync(
          Schema.Struct({
            invitations: Schema.Array(Schema.Struct({ id: Schema.String, email: Schema.String })),
          }),
        )(team).invitations;
        const invitation = invitations.find((item) => item.email === actor.email);
        if (!invitation) throw new Error('Missing load invitation');
        expect(
          (await formPost(`/join/${invitation.id}`, actor.cookie, { action: 'accept' })).status,
        ).toBe(303);
        actors.push(actor);
      }
      const nodes = Array.from({ length: 250 }, (_, index) => ({
        id: `n${index}`,
        label: `Node ${index}`,
        position: { x: (index % 10) * 180, y: Math.floor(index / 10) * 120 },
        size: { width: 150, height: 80 },
        ports: [
          { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
          { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
        ],
      }));
      const edges = Array.from({ length: 500 }, (_, index) => ({
        id: `e${index}`,
        source: { node: `n${index % 250}`, port: 'out' },
        target: { node: `n${((index % 250) + (index < 250 ? 1 : 10)) % 250}`, port: 'in' },
      }));
      const graph = parseGraph(JSON.stringify({ version: 1, graph: { nodes, edges } }));
      const id = crypto.randomUUID();
      const path = `/api/zloz/diagrams/${data.organizationId}/${id}`;
      expect(
        (
          await fetch(`${origin}${path}`, {
            method: 'POST',
            headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
            body: JSON.stringify({
              operationId: id,
              name: 'Five-editor qualification',
              graph: { version: 1, graph },
            }),
          })
        ).status,
      ).toBe(200);
      // M4 extends payload/panel coverage without editing the frozen C11 scheduling/admission helper.
      const couplingLoad = process.env.ZLOZ_COUPLING_LOAD === '1';
      const assessmentLoad = process.env.ZLOZ_LOAD_KIND === 'assessment';
      const panelOpen = assessmentLoad || process.env.ZLOZ_COUPLING_PANEL === 'open';
      const preflightOnly = process.env.ZLOZ_C11_PREFLIGHT === '1';
      if (couplingLoad || assessmentLoad) {
        const stress = makeCouplingStressFixture(id);
        expect(stress.graph).toEqual(graph);
        for (const record of stress.records) {
          const response = await fetch(`${origin}${path}/assessments`, {
            method: 'POST',
            headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
            body: JSON.stringify({
              version: 1,
              operationId: record.operationId,
              expectedRevision: 0,
              assessment: record.assessment,
            }),
          });
          expect(response.status).toBe(200);
          expect(
            Schema.decodeUnknownSync(AssessmentReplySchema)(await response.json()).decision.status,
          ).toBe('accepted');
        }
      }
      const assessmentWire = actors.map(() => ({ frames: 0, bytes: 0 }));
      const browser = await chromium.launch();
      const contexts: BrowserContext[] = [];
      try {
        const pages: Page[] = [];
        for (const [peer, actor] of actors.entries()) {
          // Preserve the original C11 canvas width: the map inspector is 160px wider.
          // The diagnostic deliberately retains 1280px to reproduce offscreen target culling.
          const context = await browser.newContext({
            viewport: { width: panelOpen && !preflightOnly ? 1440 : 1280, height: 900 },
          });
          contexts.push(context);
          const at = actor.cookie.indexOf('=');
          await context.addCookies([
            {
              name: actor.cookie.slice(0, at),
              value: actor.cookie.slice(at + 1),
              url: origin,
              httpOnly: true,
              sameSite: 'Lax',
            },
          ]);
          const page = await context.newPage();
          pages.push(page);
          if (assessmentLoad)
            page.on('websocket', (socket) =>
              socket.on('framereceived', (event) => {
                assessmentWire[peer]!.frames++;
                assessmentWire[peer]!.bytes += Buffer.byteLength(event.payload);
              }),
            );
          await page.goto(`${origin}/app/${data.organizationId}/diagrams/${id}`);
          await page.waitForFunction(
            () =>
              document
                .querySelector('[data-confirmed-version]')
                ?.getAttribute('data-confirmed-version') === '0',
            undefined,
            { timeout: 15_000 },
          );
        }
        if (panelOpen) {
          for (const page of pages) {
            await page.getByLabel('Inspector view', { exact: true }).selectOption('coupling');
            await browserExpect(page.locator('[data-coupling-row]')).toHaveCount(12);
            if (couplingLoad || assessmentLoad)
              await browserExpect(page.locator('.chart-orbit-mark')).toHaveCount(12);
          }
        }
        const preflight = await Promise.all(
          pages.map((page) =>
            page.evaluate(() => ({
              viewport: { width: window.innerWidth, height: window.innerHeight },
              gridColumns: getComputedStyle(document.querySelector('[data-inspector-mode]')!)
                .gridTemplateColumns,
              targets: Array.from({ length: 5 }, (_, index) => ({
                id: `n${index}`,
                rendered: document.querySelectorAll(`[data-flow-handle="n${index}"]`).length,
              })),
              mapRows: document.querySelectorAll('[data-coupling-row]').length,
              marks: document.querySelectorAll('.chart-orbit-mark').length,
            })),
          ),
        );
        if (process.env.ZLOZ_LOAD_REPORT)
          await writeFile(
            `${process.env.ZLOZ_LOAD_REPORT}.preflight.json`,
            JSON.stringify(preflight, null, 2),
          );
        for (const peer of preflight)
          for (const target of peer.targets) expect(target.rendered).toBe(1);
        if (preflightOnly) return;
        if (assessmentLoad) {
          const body: { frame?: unknown } = await (
            await fetch(`${origin}${path}`, { headers: { cookie: data.owner.cookie } })
          ).json();
          if (!isDiagramFrame(body.frame)) throw new Error('Missing stress frame');
          await qualifyAssessmentUpdates({
            pages,
            contexts,
            origin,
            path,
            frame: body.frame,
            wire: assessmentWire,
            output: process.env.ZLOZ_LOAD_REPORT ?? join(tmpdir(), 'zloz-assessment-load.json'),
          });
        } else {
          await qualifyFiveEditors({
            pages,
            contexts,
            origin,
            path,
            graph,
            output: process.env.ZLOZ_LOAD_REPORT ?? join(tmpdir(), 'zloz-m4-load.json'),
          });
        }
      } finally {
        for (const context of contexts) await context.close();
        await browser.close();
      }
    },
    process.env.ZLOZ_COUPLING_LOAD === '1' || process.env.ZLOZ_LOAD_KIND === 'assessment'
      ? 360_000
      : 240_000,
  );

  test('viewport rendering preserves offscreen peer edits and keyboard Fit restores every item', async () => {
    const data = await fixture();
    const id = crypto.randomUUID();
    const path = `/api/zloz/diagrams/${data.organizationId}/${id}`;
    const graph: ReturnType<typeof parseGraph> = {
      nodes: ['near', 'far', 'last'].map((nodeId, index) => ({
        id: nodeId,
        label: nodeId,
        position: { x: index === 0 ? 0 : 1500 + index * 500, y: index === 0 ? 0 : 1000 },
        size: { width: 150, height: 80 },
        ports: [
          { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
          { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
        ],
      })),
      edges: [
        { id: 'first', source: { node: 'near', port: 'out' }, target: { node: 'far', port: 'in' } },
        {
          id: 'second',
          source: { node: 'far', port: 'out' },
          target: { node: 'last', port: 'in' },
        },
      ],
    };
    expect(
      (
        await fetch(`${origin}${path}`, {
          method: 'POST',
          headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
          body: JSON.stringify({
            operationId: id,
            name: 'Viewport round-trip',
            graph: { version: 1, graph },
          }),
        })
      ).status,
    ).toBe(200);
    const browser = await chromium.launch();
    await using _browser = {
      async [Symbol.asyncDispose]() {
        await browser.close();
      },
    };
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const index = data.owner.cookie.indexOf('=');
    await context.addCookies([
      {
        name: data.owner.cookie.slice(0, index),
        value: data.owner.cookie.slice(index + 1),
        url: origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const page = await context.newPage();
    const poll = async (predicate: () => Promise<boolean>) => {
      const deadline = Date.now() + 12_000;
      while (!(await predicate()) && Date.now() < deadline) await Bun.sleep(50);
      expect(await predicate()).toBe(true);
    };
    await page.goto(`${origin}/app/${data.organizationId}/diagrams/${id}`);
    await poll(async () => (await page.locator('[data-save-status]').textContent()) === 'Saved');
    await poll(async () => (await page.locator('[data-flow-node]').count()) === 1);
    expect(await page.locator('[data-flow-connections] button').count()).toBe(2);
    const rename = await fetch(`${origin}${path}/operations`, {
      method: 'POST',
      headers: { cookie: data.editor.cookie, origin, 'content-type': 'application/json' },
      body: JSON.stringify({
        version: 1,
        operationId: 'offscreen-peer-edit',
        operation: { type: 'RenameNode', id: 'far', expected: 0, label: 'Updated far' },
      }),
    });
    expect(rename.status).toBe(200);
    expect(await rename.json()).toMatchObject({
      receipt: { status: 'accepted', documentVersion: 1 },
    });
    await poll(
      async () =>
        (await page.getByRole('button', { name: 'near → Updated far', exact: true }).count()) === 1,
    );
    expect(await page.locator('[data-flow-node="far"]').count()).toBe(0);
    await page.getByRole('button', { name: 'Fit view', exact: true }).focus();
    await page.keyboard.press('Enter');
    await poll(async () => (await page.locator('[data-flow-node]').count()) === 3);
    expect(await page.locator('[data-flow-handle="far"]').textContent()).toBe('Updated far');
    expect(
      parseGraph(
        await (
          await fetch(`${origin}${path}/export`, {
            headers: { cookie: data.owner.cookie },
          })
        ).text(),
      ),
    ).toEqual({
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === 'far' ? { ...node, label: 'Updated far' } : node,
      ),
    });
    expect(
      await (await fetch(`${origin}${path}`, { headers: { cookie: data.owner.cookie } })).json(),
    ).toMatchObject({
      frame: { document: { version: 1 } },
    });
  }, 45_000);

  test('native Domain serializes operations, binds retries, isolates targets and conditionally reverses only the actor field', async () => {
    expect(
      (
        await fetch(`${origin}/api/zloz/operator/bootstrap`, {
          method: 'POST',
          headers: { origin },
        })
      ).status,
    ).toBe(404);
    const data = await fixture();
    const target = { teamId: data.organizationId, diagramId: crypto.randomUUID() };
    const call = (
      path: string,
      cookie: string,
      fields: Readonly<{
        operationId?: string;
        graph?: typeof operationFixture.graph;
        request?: ZlozOperationRequest;
        actorId?: string;
      }>,
      resource = target,
    ) =>
      fetch(`http://localhost:${operationsPort}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ target: resource, ...fields }),
      });
    expect(
      (
        await call('/initialize', data.owner.cookie, {
          operationId: 'init',
          graph: operationFixture.graph,
        })
      ).status,
    ).toBe(200);
    const move = parseOperationRequest(operationFixture.move);
    const duplicates = await Promise.all([
      call('/execute', data.owner.cookie, { request: move }),
      call('/execute', data.owner.cookie, { request: move }),
    ]);
    expect(duplicates.map((response) => response.status)).toEqual([200, 200]);
    expect(await duplicates[0]?.json()).toEqual(await duplicates[1]?.json());
    const rename = parseOperationRequest(operationFixture.rename);
    expect((await call('/execute', data.editor.cookie, { request: rename })).status).toBe(200);
    const undo = await call('/execute', data.owner.cookie, {
      request: parseOperationRequest(operationFixture.undoMove),
    });
    expect(undo.status).toBe(200);
    const result = Schema.decodeUnknownSync(
      Schema.Struct({
        _tag: Schema.Literal('Success'),
        success: Schema.Struct({
          version: Schema.Number,
          graph: Schema.Struct({
            nodes: Schema.Array(
              Schema.Struct({
                id: Schema.String,
                label: Schema.String,
                position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
              }),
            ),
          }),
        }),
      }),
    )(await (await call('/read', data.viewer.cookie, {})).json());
    expect(result.success.version).toBe(3);
    expect(result.success.graph.nodes[0]).toMatchObject({
      id: 'a',
      label: 'Teammate name',
      position: { x: 10, y: 20 },
    });
    const raceRename: ZlozOperationRequest = {
      version: 1,
      operationId: 'racing-native-id',
      operation: { type: 'RenameNode', id: 'b', expected: 0, label: 'Race winner' },
    };
    const raceMove: ZlozOperationRequest = {
      version: 1,
      operationId: 'racing-native-id',
      operation: {
        type: 'MoveNodes',
        nodes: [{ id: 'b', expected: 0, position: { x: 640, y: 20 } }],
      },
    };
    const race = await Promise.all([
      call('/execute', data.owner.cookie, { request: raceRename }),
      call('/execute', data.owner.cookie, { request: raceMove }),
    ]);
    expect(race.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(
      (
        await call('/execute', data.owner.cookie, {
          request: { ...move, operation: rename.operation },
        })
      ).status,
    ).toBe(409);
    expect(
      (await call('/execute', data.viewer.cookie, { request: move, actorId: data.owner.userId }))
        .status,
    ).toBe(403);
    expect((await call('/read', data.outsider.cookie, {})).status).toBe(403);
    expect(
      (await call('/read', data.owner.cookie, {}, { ...target, teamId: data.otherOrganizationId }))
        .status,
    ).toBe(403);
    expect(
      (
        await fixtureCall('/revoke', {
          organizationId: data.organizationId,
          userId: data.editor.userId,
        })
      ).status,
    ).toBe(204);
    expect((await call('/execute', data.editor.cookie, { request: rename })).status).toBe(403);
  });

  test('operator bootstrap previews, applies atomically, repeats safely and rejects conflicting ownership', async () => {
    const data = await fixture();
    const slug = `pilot-${crypto.randomUUID()}`;
    const command = { name: 'Pilot team', slug, ownerEmail: data.owner.email, apply: false };
    const bootstrap = (body: typeof command, token = operatorToken) =>
      fetch(`${backendOrigin}/internal/bootstrap`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, origin, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect((await bootstrap(command, 'wrong')).status).toBe(403);
    const preview = await bootstrap(command);
    expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({ status: 'ready' });
    const teamsBefore = await fetch(`${origin}/api/auth/organization/list`, {
      headers: { cookie: data.owner.cookie },
    });
    expect(await teamsBefore.json()).toHaveLength(1);
    const created = await bootstrap({ ...command, apply: true });
    expect(created.status).toBe(200);
    const result = Schema.decodeUnknownSync(
      Schema.Struct({ status: Schema.String, team: Schema.Struct({ id: Schema.String }) }),
    )(await created.json());
    expect(result.status).toBe('created');
    const repeat = await bootstrap({ ...command, apply: true });
    expect(await repeat.json()).toMatchObject({ status: 'existing', team: { id: result.team.id } });
    expect(
      (await bootstrap({ ...command, ownerEmail: data.outsider.email, apply: true })).status,
    ).toBe(409);
    const unverified = await newUser('unverified', false);
    expect(
      (
        await bootstrap({
          ...command,
          slug: `${slug}-unverified`,
          ownerEmail: unverified.email,
          apply: true,
        })
      ).status,
    ).toBe(422);
    const wrongProvider = await newUser('wrong-provider', true, false);
    expect(
      (
        await bootstrap({
          ...command,
          slug: `${slug}-provider`,
          ownerEmail: wrongProvider.email,
          apply: true,
        })
      ).status,
    ).toBe(422);
    const publicAttempt = await fetch(`${origin}/internal/bootstrap`, {
      method: 'POST',
      headers: { authorization: `Bearer ${operatorToken}`, origin },
      body: JSON.stringify(command),
    });
    expect(publicAttempt.status).toBe(404);
  });

  test('owner invitation UI joins the intended user and exposes only their team directory', async () => {
    const data = await fixture();
    const recipient = await newUser('recipient');
    const path = `/app/${data.organizationId}`;
    const ownerPage = await fetch(`${origin}${path}`, { headers: { cookie: data.owner.cookie } });
    expect(ownerPage.status).toBe(200);
    expect(await ownerPage.text()).toContain('Invite a teammate');
    expect(
      (await fetch(`${origin}${path}`, { headers: { cookie: data.outsider.cookie } })).status,
    ).toBe(404);
    const invited = await formPost(path, data.owner.cookie, {
      action: 'invite',
      email: recipient.email,
      role: 'viewer',
    });
    expect(invited.status).toBe(303);
    const listing = await fetch(
      `${origin}/api/auth/organization/list-invitations?organizationId=${data.organizationId}`,
      { headers: { cookie: data.owner.cookie } },
    );
    const invitations = Schema.decodeUnknownSync(
      Schema.Array(Schema.Struct({ id: Schema.String, email: Schema.String, role: Schema.String })),
    )(await listing.json());
    expect(invitations).toHaveLength(1);
    const invitation = invitations[0];
    if (!invitation) throw new Error('Expected invitation');
    expect(invitation.role).toBe('viewer');
    const joinPath = `/join/${invitation.id}`;
    const anonymous = await fetch(`${origin}${joinPath}`, { redirect: 'manual' });
    expect(anonymous.status).toBe(303);
    expect(anonymous.headers.get('location')).toBe(
      `/login?returnTo=${encodeURIComponent(joinPath)}`,
    );
    const wrongUser = await fetch(`${origin}${joinPath}`, {
      headers: { cookie: data.outsider.cookie },
    });
    expect(wrongUser.status).toBe(403);
    expect(await wrongUser.text()).not.toContain(recipient.email);
    const recipientPage = await fetch(`${origin}${joinPath}`, {
      headers: { cookie: recipient.cookie },
    });
    expect(recipientPage.status).toBe(200);
    expect(await recipientPage.text()).toContain('Join Fixture team');
    const accepted = await formPost(joinPath, recipient.cookie, {
      action: 'accept',
      role: 'owner',
    });
    expect(accepted.status).toBe(303);
    expect(accepted.headers.get('location')).toBe(path);
    const joined = await fetch(`${origin}${path}`, { headers: { cookie: recipient.cookie } });
    const body = await joined.text();
    expect(body).toContain('viewer');
    expect(body).not.toContain('Invite a teammate');
    expect(body).toContain('No diagrams yet');
    const repeat = await formPost(joinPath, recipient.cookie, { action: 'accept' });
    expect(repeat.status).toBe(303);
    expect(repeat.headers.get('location')).toBe(path);
    const denied = await formPost(path, recipient.cookie, {
      action: 'invite',
      email: data.outsider.email,
      role: 'owner',
    });
    expect(denied.status).toBe(403);
  });

  test('owner forms enforce current roles, last-owner protection, terminal invitations and directory isolation', async () => {
    const data = await fixture();
    const path = `/app/${data.organizationId}`;
    const teamState = async () =>
      Schema.decodeUnknownSync(
        Schema.Struct({
          members: Schema.Array(
            Schema.Struct({ id: Schema.String, userId: Schema.String, role: Schema.String }),
          ),
          invitations: Schema.Array(Schema.Struct({ id: Schema.String, email: Schema.String })),
        }),
      )(
        await (
          await fetch(`${origin}/api/zloz/teams/${data.organizationId}`, {
            headers: { cookie: data.owner.cookie },
          })
        ).json(),
      );
    const ownerMember = (await teamState()).members.find(
      (member) => member.userId === data.owner.userId,
    );
    if (!ownerMember) throw new Error('Missing owner');
    for (const action of ['role', 'remove']) {
      const rejected = await formPost(path, data.owner.cookie, {
        action,
        memberId: ownerMember.id,
        role: 'viewer',
      });
      expect(rejected.status).toBe(409);
      expect(await rejected.text()).toContain('Add another owner');
    }
    expect(
      (
        await formPost(path, data.owner.cookie, {
          action: 'role',
          memberId: data.editor.memberId,
          role: 'owner',
        })
      ).status,
    ).toBe(303);
    expect(
      (
        await formPost(path, data.editor.cookie, {
          action: 'role',
          memberId: data.viewer.memberId,
          role: 'editor',
        })
      ).status,
    ).toBe(303);
    expect(
      (await rename(data.organizationId, data.viewer.cookie, 'Promoted editor')).body,
    ).toContain('Success');
    expect(
      (
        await formPost(path, data.owner.cookie, {
          action: 'remove',
          memberId: data.editor.memberId,
        })
      ).status,
    ).toBe(303);
    expect(
      (
        await formPost(path, data.editor.cookie, {
          action: 'invite',
          email: data.outsider.email,
          role: 'owner',
        })
      ).status,
    ).toBe(404);
    for (const mode of ['cancel', 'expire', 'used']) {
      const recipient = await newUser(`terminal-${mode}`);
      expect(
        (
          await formPost(path, data.owner.cookie, {
            action: 'invite',
            email: recipient.email,
            role: 'viewer',
          })
        ).status,
      ).toBe(303);
      const invitation = (await teamState()).invitations.find(
        (item) => item.email === recipient.email,
      );
      if (!invitation) throw new Error('Missing invitation');
      const join = `/join/${invitation.id}`;
      if (mode === 'cancel')
        expect(
          (
            await formPost(path, data.owner.cookie, {
              action: 'cancel',
              invitationId: invitation.id,
            })
          ).status,
        ).toBe(303);
      else if (mode === 'expire')
        expect(
          (
            await fixtureCall('/expire-invitation', {
              userId: invitation.id,
              organizationId: data.organizationId,
            })
          ).status,
        ).toBe(204);
      else {
        expect((await formPost(join, recipient.cookie, { action: 'accept' })).status).toBe(303);
        const member = (await teamState()).members.find((item) => item.userId === recipient.userId);
        if (!member) throw new Error('Missing accepted member');
        expect(
          (await formPost(path, data.owner.cookie, { action: 'remove', memberId: member.id }))
            .status,
        ).toBe(303);
      }
      const page = await fetch(`${origin}${join}`, { headers: { cookie: recipient.cookie } });
      expect(await page.text()).toContain(
        mode === 'cancel'
          ? 'cancelled this invitation'
          : mode === 'expire'
            ? 'has expired'
            : 'already been used',
      );
      expect((await formPost(join, recipient.cookie, { action: 'accept' })).status).toBe(409);
      expect(
        (await fetch(`${origin}${path}`, { headers: { cookie: recipient.cookie } })).status,
      ).toBe(404);
    }
    expect(
      (
        await fixtureCall('/directory', {
          organizationId: data.organizationId,
          userId: 'Visible diagram',
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await fixtureCall('/directory', {
          organizationId: data.otherOrganizationId,
          userId: 'Other tenant secret',
        })
      ).status,
    ).toBe(204);
    const directory = await (
      await fetch(`${origin}${path}`, { headers: { cookie: data.viewer.cookie } })
    ).text();
    expect(directory).toContain('Visible diagram');
    expect(directory).not.toContain('Other tenant secret');
    expect(
      (
        await formPost(path, data.owner.cookie, {
          action: 'invite',
          email: 'x'.repeat(9000),
          role: 'owner',
        })
      ).status,
    ).toBe(413);
    const wrongOrigin = await fetch(`${origin}${path}`, {
      method: 'POST',
      headers: { origin: 'https://attacker.invalid', cookie: data.owner.cookie },
    });
    expect(wrongOrigin.status).toBe(403);
  });

  test('operator CLI defaults to preview and continuation accepts only local team paths', async () => {
    const data = await fixture();
    const slug = `cli-${crypto.randomUUID()}`;
    const args = [
      'tools/bootstrap.ts',
      '--backend-url',
      backendOrigin,
      '--owner-email',
      data.owner.email,
      '--name',
      'CLI team',
      '--slug',
      slug,
    ];
    const run = async (extra: string[] = []) => {
      const task = Bun.spawn([process.execPath, ...args, ...extra], {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        env: { ...process.env, ZLOZ_OPERATOR_TOKEN: operatorToken },
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const [stdout, stderr, code] = await Promise.all([
        new Response(task.stdout).text(),
        new Response(task.stderr).text(),
        task.exited,
      ]);
      expect(stdout + stderr).not.toContain(operatorToken);
      return { code, stdout, stderr };
    };
    expect(await run()).toMatchObject({ code: 0 });
    expect((await run()).stdout).toContain('"status":"ready"');
    expect((await run(['--apply'])).stdout).toContain('"status":"created"');
    expect((await run(['--apply'])).stdout).toContain('"status":"existing"');
    expect((await run(['--backend-url', 'https://attacker.invalid'])).code).toBe(2);
    for (const returnTo of [
      '/join/abc123',
      '//attacker.invalid',
      'https://attacker.invalid',
      '/app/../logout',
      '/join/%2f%2fexample',
    ]) {
      const page = await (
        await fetch(`${origin}/login?returnTo=${encodeURIComponent(returnTo)}`)
      ).text();
      const expected = returnTo === '/join/abc123' ? returnTo : '/app';
      expect(page).toContain(`name="returnTo" value="${expected}"`);
    }
    const signedOut = await formPost('/logout', data.owner.cookie, { returnTo: '/join/abc123' });
    expect(signedOut.status).toBe(303);
    expect(signedOut.headers.get('location')).toBe('/login?returnTo=%2Fjoin%2Fabc123');
    expect(signedOut.headers.getSetCookie().join(';')).toContain('Max-Age=0');
  });

  test('Chromium keyboard invitation journey works on desktop and the owner form fits mobile', async () => {
    const data = await fixture();
    const recipient = await newUser('browser-recipient');
    const browser = await chromium.launch();
    const owner = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const target = await browser.newContext();
    owner.setDefaultTimeout(5_000);
    target.setDefaultTimeout(5_000);
    const addSession = async (context: typeof owner, cookie: string) => {
      const separator = cookie.indexOf('=');
      await context.addCookies([
        {
          name: cookie.slice(0, separator),
          value: cookie.slice(separator + 1),
          url: origin,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
    };
    try {
      await addSession(owner, data.owner.cookie);
      await addSession(target, recipient.cookie);
      const page = await owner.newPage();
      await page.goto(`${origin}/app/${data.organizationId}`);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab'); // Create/import is now a keyboard-reachable link.
      expect(
        await page
          .getByLabel('Email address', { exact: true })
          .evaluate((element) => element === document.activeElement),
      ).toBe(true);
      await page.keyboard.type(recipient.email);
      await page.keyboard.press('Tab');
      expect(await page.locator('select[name=role]').first().inputValue()).toBe('editor');
      await page.keyboard.press('Tab');
      await Promise.all([page.waitForURL('**?notice=invite'), page.keyboard.press('Enter')]);
      expect(await page.getByRole('status').textContent()).toContain('Invitation ready');
      const link = await page
        .getByRole('textbox', { name: `Invitation link for ${recipient.email}`, exact: true })
        .inputValue();
      await page.screenshot({ path: join(tmpdir(), 'zloz-m1-owner-desktop.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.locator('button, input, select').evaluateAll((elements) =>
          elements.every((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.left >= 0 && bounds.right <= window.innerWidth;
          }),
        ),
      ).toBe(true);
      await page.screenshot({ path: join(tmpdir(), 'zloz-m1-owner-mobile.png'), fullPage: true });
      const joined = await target.newPage();
      await joined.goto(link);
      await joined.keyboard.press('Tab');
      await joined.keyboard.press('Tab');
      expect(
        await joined
          .getByRole('button', { name: 'Accept invitation' })
          .evaluate((element) => element === document.activeElement),
      ).toBe(true);
      await Promise.all([
        joined.waitForURL(`**/app/${data.organizationId}`),
        joined.keyboard.press('Enter'),
      ]);
      expect(await joined.locator('main').textContent()).toContain('Your role: editor');
      expect(await joined.getByRole('heading', { name: 'Invite a teammate' }).count()).toBe(0);
      await joined.screenshot({ path: join(tmpdir(), 'zloz-m1-recipient.png'), fullPage: true });
    } finally {
      await browser.close();
    }
  }, 30_000);

  test('signed-in readers can inspect the recorded Clef demo without client JavaScript', async () => {
    const demoPath = '/app/clef-demo';
    const anonymous = await fetch(origin + demoPath, { redirect: 'manual' });
    expect(anonymous.status).toBe(303);
    expect(anonymous.headers.get('location')).toBe('/login?returnTo=%2Fapp%2Fclef-demo');
    expect(await anonymous.text()).not.toContain('98.86%');

    const data = await fixture();
    const browser = await chromium.launch();
    await using _browser = { [Symbol.asyncDispose]: () => browser.close() };
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const equals = data.viewer.cookie.indexOf('=');
    await context.addCookies([
      {
        name: data.viewer.cookie.slice(0, equals),
        value: data.viewer.cookie.slice(equals + 1),
        url: origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const page = await context.newPage();
    await page.goto(origin + '/app');
    const link = page.getByRole('link', { name: 'Clef evidence demo' });
    await browserExpect(link).toBeVisible();
    const [response] = await Promise.all([page.waitForResponse(origin + demoPath), link.click()]);
    expect(response.headers()['cache-control']).toBe('private, no-store');
    await browserExpect(page.getByRole('heading', { name: 'Clef evidence demo' })).toBeVisible();
    for (const [name, score] of [
      ['Measured evidence', '1.07%'],
      ['Missing measurements', '98.86%'],
      ['Conflicting reports', '98.83%'],
    ]) {
      const example = page.getByRole('article', { name });
      await browserExpect(example.getByText(score, { exact: true })).toBeVisible();
    }
    const measured = page.getByRole('article', { name: 'Measured evidence' });
    const evidence = measured.getByText(/Load run Q-41 tested 10,000 events\/minute/);
    await browserExpect(evidence).toBeHidden();
    await measured.getByText('Evidence and model response', { exact: true }).press('Enter');
    await browserExpect(evidence).toBeVisible();
  }, 25_000);

  test('private SSR redirects anonymous requests and renders a real signed session', async () => {
    const anonymous = await fetch(`${origin}/app`, { redirect: 'manual' });
    expect(anonymous.status).toBe(303);
    expect(anonymous.headers.get('location')).toBe('/login');
    expect(anonymous.headers.get('cache-control')).toBe('private, no-store');
    const data = await fixture();
    const signed = await fetch(`${origin}/app`, { headers: { cookie: data.owner.cookie } });
    expect(signed.status).toBe(200);
    const privatePage = await signed.text();
    expect(privatePage).toContain('Hello, owner.');
    expect(privatePage).toContain('Fixture team');
    expect(privatePage).not.toContain('Other team');
    const teams = await fetch(`${origin}/api/auth/organization/list`, {
      headers: { cookie: data.owner.cookie },
    });
    const names = Schema.decodeUnknownSync(Schema.Array(Schema.Struct({ name: Schema.String })))(
      await teams.json(),
    );
    expect(names).toEqual([{ name: 'Fixture team' }]);
    const login = await fetch(`${origin}/login`);
    const page = await login.text();
    expect(page).toContain('Google sign-in isn’t configured');
    expect(page).toMatch(/<button[^>]*\sdisabled[\s>]/);
  });

  test('raw HTTP rejects forged identities, other tenants and viewer writes', async () => {
    const data = await fixture();
    const forged = await rpc('DiagramProbe.get', { key: data.organizationId }, '', {
      'x-user-id': data.owner.userId,
      'x-role': 'owner',
    });
    expect(forged.body).toContain('AccessDenied');
    const other = await rpc(
      'DiagramProbe.get',
      { key: data.otherOrganizationId },
      data.owner.cookie,
    );
    expect(other.body).toContain('AccessDenied');
    expect((await rename(data.organizationId, data.viewer.cookie, 'Forbidden')).body).toContain(
      'AccessDenied',
    );
    const accepted = await rename(data.organizationId, data.editor.cookie, 'Durable title');
    expect(accepted.body).toContain('Success');
    const current = await rpc('DiagramProbe.get', { key: data.organizationId }, data.viewer.cookie);
    expect(current.body).toContain('Durable title');
    expect(current.response.headers.get('cache-control')).toBe('private, no-store');
    const commandId = crypto.randomUUID();
    expect(
      (
        await rpc(
          'RenameProbe',
          { target: data.organizationId, commandId, input: { title: 'Owner change' } },
          data.owner.cookie,
        )
      ).body,
    ).toContain('Success');
    expect(
      (
        await rpc(
          'RenameProbe',
          { target: data.organizationId, commandId, input: { title: 'Viewer replay' } },
          data.viewer.cookie,
        )
      ).body,
    ).toContain('AccessDenied');
    const deniedWatch = watch(data.otherOrganizationId, data.owner.cookie);
    expect(await deniedWatch.first).toContain('AccessDenied');
    await deniedWatch.closed;
    const wrongOrigin = await fetch(`${origin}/api/zloz/domain`, {
      method: 'POST',
      headers: { origin: 'https://attacker.invalid' },
    });
    expect(wrongOrigin.status).toBe(403);
  });

  test('an open watch receives no new state after membership removal', async () => {
    const data = await fixture();
    const live = watch(data.organizationId, data.editor.cookie);
    expect(await live.first).toContain('Untitled');
    expect((await rename(data.organizationId, data.owner.cookie, 'Before removal')).body).toContain(
      'Success',
    );
    await Bun.sleep(150);
    expect(live.messages.join('\n')).toContain('Before removal');
    expect(
      (
        await fixtureCall('/revoke', {
          userId: data.editor.userId,
          organizationId: data.organizationId,
        })
      ).status,
    ).toBe(204);
    expect((await rename(data.organizationId, data.owner.cookie, 'After removal')).body).toContain(
      'Success',
    );
    await live.closed;
    expect(live.messages.join('\n')).toContain('AccessDenied');
    expect(live.messages.join('\n')).not.toContain('After removal');
  }, 30_000);

  test('an open watch rechecks an expired ISO timestamp before delivering another state', async () => {
    const data = await fixture();
    const live = watch(data.organizationId, data.editor.cookie);
    expect(await live.first).toContain('Untitled');
    expect(
      (
        await fixtureCall('/expire', {
          userId: data.editor.userId,
          organizationId: data.organizationId,
        })
      ).status,
    ).toBe(204);
    expect(
      (await rename(data.organizationId, data.owner.cookie, 'After natural expiry')).body,
    ).toContain('Success');
    await live.closed;
    expect(live.messages.join('\n')).not.toContain('After natural expiry');
    expect(live.messages.join('\n')).toContain('AccessDenied');
  }, 30_000);

  test('idle watches close after expiry, removal, downgrade and logout; reconnect uses current access', async () => {
    const observations: Array<{
      mode: string;
      data: Fixture;
      live: ReturnType<typeof watch>;
      revokedAt: number;
    }> = [];
    // Alchemy's local multi-Worker D1 emulator uses separate SQLite connections.
    // Seed fixtures sequentially; this is a live-revocation test, not C11 load proof.
    for (const mode of ['expire', 'revoke', 'downgrade', 'logout']) {
      const data = await fixture();
      const live = watch(data.organizationId, data.editor.cookie);
      expect(await live.first).toContain('Untitled');
      if (mode === 'logout') {
        const response = await fetch(`${origin}/logout`, {
          method: 'POST',
          redirect: 'manual',
          headers: { cookie: data.editor.cookie, origin },
        });
        expect(response.status).toBe(303);
        const cookies = response.headers.getSetCookie();
        expect(cookies.length).toBeGreaterThan(0);
        expect(cookies.join(';')).toContain('HttpOnly');
        expect(cookies.join(';')).not.toContain('Domain=');
      } else {
        expect(
          (
            await fixtureCall(`/${mode}`, {
              userId: data.editor.userId,
              organizationId: data.organizationId,
            })
          ).status,
        ).toBe(204);
      }
      const revokedAt = performance.now();
      expect(
        (await rename(data.organizationId, data.editor.cookie, 'After revocation')).body,
      ).toContain('AccessDenied');
      observations.push({ mode, data, live, revokedAt });
    }
    await Promise.all(
      observations.map(async ({ live, revokedAt }) => {
        expect((await live.closed) - revokedAt).toBeLessThan(30_000);
      }),
    );
    for (const { mode, data } of observations) {
      const again = watch(data.organizationId, data.editor.cookie);
      const first = await again.first;
      if (mode === 'downgrade') {
        expect(first).toContain('Untitled');
        again.socket.close();
      } else expect(first).toContain('AccessDenied');
      await again.closed;
    }
  }, 35_000);
  test('shared assessment authoring broadcasts real inputs, preserves drafts and enforces team write roles', async () => {
    const data = await fixture();
    const id = crypto.randomUUID();
    const path = `/api/zloz/diagrams/${data.organizationId}/${id}`;
    const call = <Body extends object>(
      cookie: string,
      suffix: string,
      body?: Body,
      requestOrigin = origin,
    ) =>
      fetch(`${origin}${path}${suffix}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { cookie, origin: requestOrigin, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    expect(
      (
        await call(data.owner.cookie, '', {
          operationId: id,
          name: 'Assessment authoring',
          graph: { version: 1, graph: operationFixture.graph },
        })
      ).status,
    ).toBe(200);
    const browser = await chromium.launch();
    await using _browser = { [Symbol.asyncDispose]: () => browser.close() };
    const contexts = await Promise.all([
      browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' }),
      browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' }),
      browser.newContext({ viewport: { width: 390, height: 844 } }),
    ]);
    const pages: Page[] = [];
    const errors: string[] = [];
    for (const [index, actor] of [data.owner, data.editor, data.viewer].entries()) {
      const context = contexts[index];
      if (!context) throw new Error('Missing browser context');
      const equals = actor.cookie.indexOf('=');
      await context.addCookies([
        {
          name: actor.cookie.slice(0, equals),
          value: actor.cookie.slice(equals + 1),
          url: origin,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${origin}/app/${data.organizationId}/diagrams/${id}`);
      await page.getByLabel('Assess relationship', { exact: true }).selectOption('ab');
      pages.push(page);
    }
    const [owner, editor, viewer] = pages;
    if (!owner || !editor || !viewer) throw new Error('Missing collaboration page');
    const panel = (page: Page) =>
      page.getByRole('region', { name: 'Balanced Coupling assessment', exact: true });
    await editor.getByLabel('Expected-change horizon', { exact: true }).fill('My unsaved horizon');
    await owner.getByLabel('Abstraction scope', { exact: true }).fill('Bounded contexts');
    await owner.getByLabel('Abstraction scope', { exact: true }).press('Tab');
    await browserExpect(owner.getByLabel('Expected-change horizon', { exact: true })).toBeFocused();
    await owner.getByLabel('Expected-change horizon', { exact: true }).fill('Next six months');
    await owner.getByLabel('Integration type judgment', { exact: true }).selectOption('model');
    await owner.getByLabel('Integration type basis', { exact: true }).selectOption('observed');
    await owner
      .getByLabel('Integration type rationale', { exact: true })
      .fill('Shared order schema');
    for (const field of ['Strength', 'Distance', 'Volatility'])
      await owner
        .getByLabel(`${field} unknown reason`, { exact: true })
        .fill('Team discovery pending');
    await owner.getByRole('button', { name: 'Save shared assessment', exact: true }).click();
    await browserExpect(panel(owner).locator('[data-assessment-revision]')).toHaveAttribute(
      'data-assessment-revision',
      '1',
    );
    await browserExpect(panel(editor).locator('[data-assessment-revision]')).toHaveAttribute(
      'data-assessment-revision',
      '1',
    );
    await browserExpect(editor.getByLabel('Expected-change horizon', { exact: true })).toHaveValue(
      'My unsaved horizon',
    );
    await browserExpect(panel(editor).getByRole('alert')).toContainText('newer revision');
    await browserExpect(
      editor.getByRole('button', { name: 'Save shared assessment', exact: true }),
    ).toBeDisabled();
    await editor
      .getByRole('button', { name: 'Load shared assessment (discard draft)', exact: true })
      .click();
    await browserExpect(
      editor.getByLabel('Integration type judgment', { exact: true }),
    ).toHaveValue('model');
    await browserExpect(editor.getByLabel('Integration type basis', { exact: true })).toHaveValue(
      'observed',
    );
    for (const [field, value] of [
      ['Strength', 'high'],
      ['Distance', 'high'],
      ['Volatility', 'low'],
    ] as const) {
      await editor.getByLabel(`${field} judgment`, { exact: true }).selectOption(value);
      await editor
        .getByLabel(`${field} rationale`, { exact: true })
        .fill(`${field} reviewed by team`);
    }
    await editor.getByRole('button', { name: 'Save shared assessment', exact: true }).click();
    await browserExpect(panel(owner).locator('[data-assessment-revision]')).toHaveAttribute(
      'data-assessment-revision',
      '2',
    );
    await viewer
      .getByRole('button', { name: 'Load shared assessment (discard draft)', exact: true })
      .click();
    await browserExpect(
      viewer.getByLabel('Integration type judgment', { exact: true }),
    ).toHaveValue('model');
    await browserExpect(viewer.getByLabel('Abstraction scope', { exact: true })).toBeDisabled();
    await browserExpect(
      viewer.getByRole('button', { name: 'Save shared assessment', exact: true }),
    ).toBeDisabled();
    const snapshot = Schema.decodeUnknownSync(
      Schema.Struct({ frame: Schema.Unknown.pipe(Schema.refine(isDiagramFrame)) }),
    )(await (await call(data.owner.cookie, '')).json());
    expect(snapshot.frame.document.version).toBe(0);
    expect(snapshot.frame.document.undo).toEqual([]);
    expect(snapshot.frame.assessments).toMatchObject([
      {
        revision: 2,
        authoredBy: data.editor.userId,
        assessment: {
          inputs: {
            integrationType: { value: 'model', basis: 'observed' },
            volatility: { value: 'low' },
          },
        },
      },
    ]);
    const request = {
      version: 1,
      operationId: 'native-assessment-race',
      expectedRevision: 2,
      assessment: { ...assessmentFixture, target: { ...assessmentFixture.target, documentId: id } },
    };
    const races = await Promise.all([
      call(data.owner.cookie, '/assessments', request),
      call(data.editor.cookie, '/assessments', { ...request, operationId: 'native-editor-race' }),
    ]);
    const replies = await Promise.all(
      races.map(async (response) =>
        Schema.decodeUnknownSync(AssessmentReplySchema)(await response.json()),
      ),
    );
    expect(replies.filter((reply) => reply.decision.status === 'accepted')).toHaveLength(1);
    expect(replies.filter((reply) => reply.decision.status === 'rejected')).toMatchObject([
      { decision: { code: 'revision-conflict' } },
    ]);
    expect(await (await call(data.owner.cookie, '/assessments', request)).json()).toEqual(
      replies[0],
    );
    expect(
      (await call(data.owner.cookie, '/assessments', { ...request, expectedRevision: 99 })).status,
    ).toBe(409);
    for (const cookie of [data.viewer.cookie, data.outsider.cookie])
      expect((await call(cookie, '/assessments', request)).status).toBe(403);
    expect(
      (await call(data.owner.cookie, '/assessments', request, 'https://untrusted.test')).status,
    ).toBe(403);
    expect(
      (await call(data.owner.cookie, '/assessments', { ...request, authoredBy: 'forged-owner' }))
        .status,
    ).toBe(400);
    expect(
      (await call(data.owner.cookie, '/assessments', { ...request, padding: 'x'.repeat(70_000) }))
        .status,
    ).toBe(413);
    await fixtureCall('/revoke', {
      userId: data.editor.userId,
      organizationId: data.organizationId,
    });
    expect(
      (
        await call(data.editor.cookie, '/assessments', {
          ...request,
          operationId: 'native-editor-race',
        })
      ).status,
    ).toBe(403);
    await owner
      .getByRole('button', { name: 'Load shared assessment (discard draft)', exact: true })
      .click();
    expect(
      (await call(data.owner.cookie, '/operations', parseOperationRequest(operationFixture.move)))
        .status,
    ).toBe(200);
    await browserExpect(
      panel(owner).getByRole('status').filter({ hasText: 'Assessment needs review' }),
    ).toHaveText('Assessment needs review after a diagram change. Your draft is preserved.');
    await browserExpect(panel(owner).getByRole('alert')).toHaveCount(0);
    await browserExpect(
      owner.getByRole('button', { name: 'Save shared assessment', exact: true }),
    ).toBeDisabled();
    await owner
      .getByRole('button', { name: 'Review assessment against current diagram', exact: true })
      .click();
    await browserExpect(panel(owner).locator('[data-assessment-status]')).toContainText(
      'Reviewed against current diagram',
    );
    await browserExpect(
      panel(owner).getByRole('status').filter({ hasText: 'Assessment needs review' }),
    ).toHaveCount(0);
    await browserExpect(
      owner.getByRole('button', { name: 'Save shared assessment', exact: true }),
    ).toBeEnabled();
    const screenshotDirectory = join(tmpdir(), 'zloz-coupling-authoring-browser');
    await mkdir(screenshotDirectory, { recursive: true });
    for (const [page, name] of [
      [owner, 'owner-dark'],
      [editor, 'editor-light'],
      [viewer, 'viewer-mobile'],
    ] as const)
      await page.screenshot({ path: join(screenshotDirectory, `${name}.png`), fullPage: true });
    expect(errors).toEqual([]);
  }, 90_000);

  test('Balanced Coupling map is read-only, responsive and preserves hidden assessment saves', async () => {
    const data = await fixture();
    const id = crypto.randomUUID();
    const api = `/api/zloz/diagrams/${data.organizationId}/${id}`;
    const call = <Body extends object>(suffix = '', body?: Body) =>
      fetch(`${origin}${api}${suffix}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const edges = Array.from({ length: 16 }, (_, index) => ({
      ...operationFixture.graph.edges[0]!,
      id: `edge-${String(index).padStart(2, '0')}`,
      label: `Relationship ${index}`,
    }));
    expect(
      (
        await call('', {
          operationId: id,
          name: 'Synthetic coupling map qualification',
          graph: { version: 1, graph: { ...operationFixture.graph, edges } },
        })
      ).status,
    ).toBe(200);
    for (let index = 0; index < 15; index++) {
      const example = couplingUiFixture.cases[index % 8]!;
      const value = {
        ...couplingUiFixture.assessment,
        target: {
          ...couplingUiFixture.assessment.target,
          documentId: id,
          graphVersion: 0,
          relationshipId: edges[index]!.id,
        },
        inputs: {
          ...couplingUiFixture.assessment.inputs,
          integrationType:
            index === 14
              ? { status: 'unknown', reason: 'Synthetic discovery still pending' }
              : {
                  ...couplingUiFixture.assessment.inputs.integrationType,
                  value: ['intrusive', 'functional', 'model', 'contract'][index % 4],
                },
          strength: { ...couplingUiFixture.assessment.inputs.strength, value: example.strength },
          distance: { ...couplingUiFixture.assessment.inputs.distance, value: example.distance },
          volatility: {
            ...couplingUiFixture.assessment.inputs.volatility,
            value: example.volatility,
          },
        },
      };
      expect(
        (
          await call('/assessments', {
            version: 1,
            operationId: `map-assessment-${index}`,
            expectedRevision: 0,
            assessment: value,
          })
        ).status,
      ).toBe(200);
    }
    const read = async () => {
      const body = Schema.decodeUnknownSync(
        Schema.Struct({ frame: Schema.Unknown.pipe(Schema.refine(isDiagramFrame)) }),
      )(await (await call()).json());
      return body.frame;
    };
    const before = await read();
    const browser = await chromium.launch();
    await using _browser = { [Symbol.asyncDispose]: () => browser.close() };
    const pages: Page[] = [];
    const errors: string[] = [];
    const writes: string[] = [];
    for (const [index, actor] of [data.owner, data.editor, data.viewer].entries()) {
      const context = await browser.newContext({
        viewport: { width: index === 2 ? 390 : 1440, height: 1000 },
        colorScheme: index === 0 ? 'dark' : 'light',
      });
      const equals = actor.cookie.indexOf('=');
      await context.addCookies([
        {
          name: actor.cookie.slice(0, equals),
          value: actor.cookie.slice(equals + 1),
          url: origin,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => {
        if (request.method() === 'POST' && /\/(operations|assessments)$/.test(request.url()))
          writes.push(request.url());
      });
      await page.goto(`${origin}/app/${data.organizationId}/diagrams/${id}`);
      await page.getByLabel('Inspector view', { exact: true }).selectOption('coupling');
      pages.push(page);
    }
    const [owner, editor, viewer] = pages;
    if (!owner || !editor || !viewer) throw new Error('Missing coupling qualification page');
    const map = (page: Page) =>
      page.getByRole('region', { name: 'Balanced Coupling assessment map', exact: true });
    const marks = (page: Page) => map(page).locator('.chart-orbit-mark');
    await browserExpect(marks(owner)).toHaveCount(12);
    await browserExpect(map(owner).locator('[data-coupling-row]')).toHaveCount(12);
    for (const page of [owner, editor]) {
      const contrast = await map(page).evaluate((element) => {
        const panel = element.closest('aside');
        if (!panel) throw new Error('Missing inspector palette');
        const rgb = (colour: string) => (colour.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const luminance = (channels: number[]) =>
          channels.reduce((sum, channel, index) => {
            const value = channel / 255;
            return (
              sum +
              (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) *
                [0.2126, 0.7152, 0.0722][index]!
            );
          }, 0);
        const background = rgb(getComputedStyle(panel).backgroundColor);
        const ratio = (channels: number[]) =>
          (Math.max(luminance(channels), luminance(background)) + 0.05) /
          (Math.min(luminance(channels), luminance(background)) + 0.05);
        return {
          text: ratio(rgb(getComputedStyle(element).color)),
          halo: [...element.querySelectorAll('.chart-orbit-halo')].map((path) => {
            const style = getComputedStyle(path);
            const alpha = Number(style.fillOpacity);
            return ratio(
              rgb(style.fill).map(
                (channel, index) => channel * alpha + background[index]! * (1 - alpha),
              ),
            );
          }),
        };
      });
      expect(contrast.text).toBeGreaterThanOrEqual(4.5);
      for (const ratio of contrast.halo) expect(ratio).toBeGreaterThanOrEqual(3);
    }
    for (const mark of await marks(owner).all()) {
      const bounds = await mark.boundingBox();
      expect(bounds?.width).toBeCloseTo(44, 5);
      expect(bounds?.height).toBeCloseTo(44, 5);
    }
    const mark = (id: string) =>
      map(owner).getByRole('button', { name: new RegExp(`Select relationship ${id}\\.`) });
    await mark('edge-00').focus();
    await mark('edge-00').press('Enter');
    await browserExpect(mark('edge-00')).toHaveAttribute('aria-pressed', 'true');
    await mark('edge-04').focus();
    await mark('edge-04').press(' ');
    await browserExpect(mark('edge-04')).toHaveAttribute('aria-pressed', 'true');
    await browserExpect(mark('edge-00')).toHaveAttribute('aria-pressed', 'false');
    expect(
      await mark('edge-04').evaluate((element) => getComputedStyle(element).outlineStyle),
    ).not.toBe('none');
    await mark('edge-08').click();
    await browserExpect(mark('edge-08')).toHaveAttribute('aria-pressed', 'true');
    await mark('edge-08').press('Delete');
    await map(owner).getByRole('button', { name: 'Next relationships', exact: true }).click();
    await browserExpect(marks(owner)).toHaveCount(2);
    await browserExpect(map(owner).locator('[data-coupling-state="unknown"]')).toHaveCount(1);
    await owner.getByLabel('Scope and horizon', { exact: true }).selectOption('');
    await browserExpect(marks(owner)).toHaveCount(0);
    await map(owner).getByRole('button', { name: 'Next relationships', exact: true }).click();
    await browserExpect(map(owner).locator('[data-coupling-state="not-started"]')).toHaveCount(1);
    const cohort = '["balanced-coupling-binary/v1","C4 containers","Next quarter"]';
    await owner.getByLabel('Scope and horizon', { exact: true }).selectOption(cohort);
    await browserExpect(marks(owner)).toHaveCount(12);
    const accessible = await map(owner).ariaSnapshot();
    expect(accessible).toContain('Integration model');
    expect(accessible).toContain('Relationship');
    await map(viewer)
      .getByRole('button', { name: 'Review assessment edge-02', exact: true })
      .click();
    await browserExpect(viewer.getByLabel('Abstraction scope', { exact: true })).toBeDisabled();
    await browserExpect(
      viewer.getByRole('button', { name: 'Save shared assessment', exact: true }),
    ).toBeDisabled();
    await viewer.getByLabel('Inspector view', { exact: true }).selectOption('coupling');
    for (const width of [360, 390]) {
      await viewer.setViewportSize({ width, height: 1000 });
      await browserExpect(map(viewer)).toBeVisible();
      await viewer.waitForTimeout(100);
      const measured = await map(viewer)
        .locator('.coupling-measure')
        .evaluate((element) => element.getBoundingClientRect().width);
      await browserExpect(marks(viewer)).toHaveCount(measured >= 300 ? 12 : 0);
      expect(await viewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    expect((await read()).document).toEqual(before.document);
    expect((await read()).assessments).toEqual(before.assessments);
    expect(writes).toEqual([]);
    await owner.getByRole('button', { name: 'Light theme', exact: true }).click();
    await browserExpect(marks(owner)).toHaveCount(12);
    await owner.getByRole('button', { name: 'Dark theme', exact: true }).click();
    await owner.getByLabel('Canvas emphasis', { exact: true }).selectOption('ddd');
    await browserExpect(marks(owner)).toHaveCount(12);
    expect((await read()).document).toEqual(before.document);
    expect((await read()).assessments).toEqual(before.assessments);
    await owner.getByLabel('Canvas emphasis', { exact: true }).selectOption('c4');
    await owner.emulateMedia({ reducedMotion: 'reduce' });
    expect(
      await owner
        .locator('.coupling-orbit')
        .evaluate((element) => element.getAnimations({ subtree: true }).length),
    ).toBe(0);
    const screenshotDirectory = join(tmpdir(), `zloz-coupling-map-${crypto.randomUUID()}`);
    await mkdir(screenshotDirectory, { recursive: true });
    for (const [page, label] of [
      [owner, 'dark-desktop'],
      [editor, 'light-desktop'],
      [viewer, 'light-mobile'],
    ] as const) {
      await map(page).screenshot({ path: join(screenshotDirectory, `${label}.png`) });
      if (label !== 'light-mobile') {
        await page
          .locator('.coupling-orbit')
          .screenshot({ path: join(screenshotDirectory, `${label}-orbit.png`) });
      }
    }
    console.info(`Coupling map screenshots: ${screenshotDirectory}`);
    await map(owner)
      .getByRole('button', { name: 'Review assessment edge-00', exact: true })
      .focus();
    await owner.keyboard.press('Enter');
    await browserExpect(owner.locator('#assessment-inspector')).toBeFocused();
    await owner
      .getByLabel('Expected-change horizon', { exact: true })
      .fill('Private pending horizon');
    const gate = Promise.withResolvers<void>();
    const intercepted = Promise.withResolvers<void>();
    await using _releaseGate = {
      [Symbol.asyncDispose]: () => {
        gate.resolve();
        return Promise.resolve();
      },
    };
    const bodies: string[] = [];
    let drop = true;
    await owner.route(`**${api}/assessments`, async (route) => {
      bodies.push(route.request().postData() ?? '');
      if (drop) {
        drop = false;
        intercepted.resolve();
        await gate.promise;
        await route.abort('failed');
      } else await route.continue();
    });
    await owner.getByRole('button', { name: 'Save shared assessment', exact: true }).click();
    await intercepted.promise;
    await owner.getByLabel('Inspector view', { exact: true }).selectOption('coupling');
    await browserExpect(owner.locator('.coupling-notice').first()).toContainText('Sending save');
    gate.resolve();
    await browserExpect(owner.locator('.coupling-notice').first()).toContainText(
      'Save outcome unknown',
    );
    await map(owner)
      .getByRole('button', { name: 'Review assessment edge-04', exact: true })
      .click();
    await browserExpect(map(owner).getByRole('status')).toContainText(
      'Close the open assessment explicitly',
    );
    await owner.getByRole('button', { name: 'Return to assessment', exact: true }).click();
    await browserExpect(owner.getByLabel('Expected-change horizon', { exact: true })).toHaveValue(
      'Private pending horizon',
    );
    await owner.getByRole('button', { name: 'Retry assessment request', exact: true }).click();
    await browserExpect(owner.locator('[data-assessment-revision]')).toHaveAttribute(
      'data-assessment-revision',
      '2',
    );
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toBe(bodies[1]);
    await owner.getByLabel('Inspector view', { exact: true }).selectOption('coupling');
    expect((await read()).document).toEqual(before.document);
    expect(
      (
        await call('/operations', {
          version: 1,
          operationId: 'map-stale',
          operation: {
            type: 'RenameNode',
            id: 'a',
            expected: 0,
            label: 'Source changed for synthetic stale check',
          },
        })
      ).status,
    ).toBe(200);
    await browserExpect(map(owner)).toHaveAttribute('data-coupling-graph-version', '1');
    await browserExpect(marks(owner)).toHaveCount(0);
    await browserExpect(map(owner).locator('[data-coupling-state="stale"]')).toHaveCount(12);
    expect(
      (
        await call('/operations', {
          version: 1,
          operationId: 'map-remove',
          operation: { type: 'Delete', expectedVersion: 1, nodeIds: [], edgeIds: ['edge-00'] },
        })
      ).status,
    ).toBe(200);
    await browserExpect(
      owner.getByRole('region', { name: 'Retained removed assessments', exact: true }),
    ).toContainText('edge-00');
    await browserExpect(map(owner)).toHaveAttribute('data-coupling-graph-version', '2');
    expect(errors).toEqual([]);
  }, 120_000);

  test('native process restart retains acknowledged and reply-lost commits but not an uncommitted fault or volatile presence', async () => {
    const data = await fixture();
    const id = crypto.randomUUID();
    const path = `/api/zloz/diagrams/${data.organizationId}/${id}`;
    const appCall = <Body extends object>(suffix: string, body?: Body) =>
      fetch(`${origin}${path}${suffix}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { cookie: data.owner.cookie, origin, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    expect(
      (
        await appCall('', {
          operationId: id,
          name: 'Restart proof',
          graph: { version: 1, graph: operationFixture.graph },
        })
      ).status,
    ).toBe(200);
    const assessmentRequest = {
      version: 1,
      operationId: 'persist-assessment',
      expectedRevision: 0,
      assessment: { ...assessmentFixture, target: { ...assessmentFixture.target, documentId: id } },
    };
    const assessmentReply = await (await appCall('/assessments', assessmentRequest)).json();
    expect(assessmentReply).toMatchObject({
      decision: { status: 'accepted', record: { revision: 1 } },
    });
    const checkpoint = await parseDiagramCheckpoint(await (await appCall('/checkpoint')).text());
    const move = parseOperationRequest(operationFixture.move);
    const acknowledged = await (await appCall('/operations', move)).json();
    expect(acknowledged).toMatchObject({ receipt: { status: 'accepted', documentVersion: 1 } });
    expect(
      (
        await appCall('/presence', {
          connectionId: 'old-process-tab',
          selection: ['a'],
          cursor: { x: 1, y: 2 },
        })
      ).status,
    ).toBe(200);
    const target = { teamId: data.organizationId, diagramId: `fault-${id}` };
    const nativeCall = <Body extends object>(suffix: string, body: Body) =>
      fetch(`http://localhost:${operationsPort}${suffix}`, {
        method: 'POST',
        headers: {
          cookie: data.owner.cookie,
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ target, ...body }),
      });
    expect(
      (await nativeCall('/initialize', { operationId: 'init', graph: operationFixture.graph }))
        .status,
    ).toBe(200);
    const rename = parseOperationRequest(operationFixture.rename);
    expect((await nativeCall('/execute?fault=before-commit', { request: rename })).status).toBe(
      503,
    );
    expect(await (await nativeCall('/read', {})).json()).toMatchObject({ success: { version: 0 } });
    expect((await nativeCall('/execute?fault=after-commit', { request: move })).status).toBe(503);
    expect(await (await nativeCall('/read', {})).json()).toMatchObject({ success: { version: 1 } });
    const recoveryRequest = { operationId: 'restart-recovery', expectedVersion: 1, checkpoint };
    const recoveryReply = await (await appCall('/restore', recoveryRequest)).json();
    expect(recoveryReply).toMatchObject({ status: 'restored', documentVersion: 2 });
    if (!child.pid) throw new Error('No native process to restart');
    await stopLocalStack(child, 'SIGKILL');
    child = startStack(false);
    await ready();
    expect(
      (
        await fetch(`${origin}/api/zloz/domain`, {
          method: 'POST',
          headers: { origin, cookie: data.owner.cookie },
        })
      ).status,
    ).toBe(404);
    expect(await (await appCall('/assessments', assessmentRequest)).json()).toEqual(
      assessmentReply,
    );
    expect(await (await appCall('/operations', move)).json()).toEqual(acknowledged);
    expect(await (await appCall('/restore', recoveryRequest)).json()).toEqual(recoveryReply);
    expect(parseGraph(await (await appCall('/export')).text())).toEqual(
      parseGraph(JSON.stringify({ version: 1, graph: operationFixture.graph })),
    );
    const restored = await (await appCall('')).json();
    expect(restored).toMatchObject({
      name: 'Restart proof',
      frame: {
        document: { version: 2, undo: [] },
        assessments: [
          {
            revision: 1,
            authoredBy: data.owner.userId,
            assessment: { target: { graphVersion: 0, relationshipId: 'ab' } },
          },
        ],
      },
    });
    const replayed = await (await nativeCall('/execute', { request: move })).json();
    expect(replayed).toMatchObject({
      success: { receipt: { status: 'accepted', documentVersion: 1 } },
    });
    expect(await (await nativeCall('/read', {})).json()).toMatchObject({ success: { version: 1 } });
    expect(await (await nativeCall('/execute', { request: rename })).json()).toMatchObject({
      success: { receipt: { status: 'accepted', documentVersion: 2 } },
    });
    expect(
      await (
        await appCall('/presence', { connectionId: 'new-process-tab', selection: [], cursor: null })
      ).json(),
    ).toMatchObject({ peers: [expect.objectContaining({ connectionId: 'new-process-tab' })] });
  }, 90_000);
});

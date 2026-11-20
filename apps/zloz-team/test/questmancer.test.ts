// The native Playwright and local process lifetimes require finally cleanup.
/* oxlint-disable linteffect/no-try-catch */
import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { openSync, closeSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Actor, Fixture } from '@opsydyn/zloz-server/test/fixture-contract';
import { Schema } from 'effect';
import { chromium, type Locator } from 'playwright';
import { expect as browserExpect } from 'playwright/test';

import type { RoomView } from '../src/questmancer/contracts';
import { stopLocalStack } from '../tools/stop-local-stack';

const port = () => {
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response() });
  const port = server.port;
  server.stop(true);
  return port;
};

const localOutbox = new URL('../.alchemy/local/email/text/', import.meta.url).pathname;
const localMessages = () => readdir(localOutbox).catch(() => []);

test('Questmancer opens one private table for a DM and three distinct player seats', async () => {
  const appPort = port();
  const fixturePort = port();
  const origin = `http://localhost:${appPort}`;
  const key = crypto.randomUUID();
  const log = join(tmpdir(), `questmancer-teams-${key}.log`);
  const fd = openSync(log, 'a', 0o600);
  const child = Bun.spawn([process.execPath, 'tools/dev.ts', '--config', 'test/alchemy.run.ts'], {
    cwd: new URL('..', import.meta.url).pathname,
    detached: true,
    stdin: 'ignore',
    stdout: fd,
    stderr: fd,
    env: {
      ...process.env,
      ZLOZ_PORT: String(appPort),
      ZLOZ_ORIGIN: origin,
      ZLOZ_FIXTURE_PORT: String(fixturePort),
      ZLOZ_FIXTURE_KEY: key,
      ZLOZ_BACKEND_PORT: String(port()),
      ZLOZ_OPERATIONS_PORT: String(port()),
      ZLOZ_QUESTMANCER_PORT: String(port()),
      ZLOZ_LOCAL_STAGE: `test-${key}`,
      ZLOZ_QUESTMANCER: 'true',
      ZLOZ_QUESTMANCER_PREVIEW: 'true',
      ZLOZ_EMAIL_SIGN_IN_TEAM: '*',
      ZLOZ_EMAIL_SIGN_IN_FROM: 'qa@example.test',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
    },
  });
  closeSync(fd);
  try {
    const deadline = Date.now() + 60_000;
    while (true) {
      if (child.exitCode !== null || Date.now() > deadline)
        throw new Error('Questmancer local stack failed. See ' + log);
      const [check, fixture] = await Promise.all([
        fetch(origin + '/api/zloz/session', { signal: AbortSignal.timeout(2_000) }).catch(
          () => null,
        ),
        fetch(`http://localhost:${fixturePort}`, { signal: AbortSignal.timeout(2_000) }).catch(
          () => null,
        ),
      ]);
      if (check?.status === 200 && fixture?.status === 403) break;
      await Bun.sleep(250);
    }
    const seeded = await fetch(`http://localhost:${fixturePort}/seed`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
    });
    expect(seeded.status).toBe(200);
    const party = Schema.decodeUnknownSync(Fixture)(await seeded.json());
    const team = '/app/' + party.organizationId;
    const lobby = team + '/questmancer';
    const api = lobby + '/api/';
    const form = (path: string, cookie: string, fields: Record<string, string>) =>
      fetch(origin + path, {
        method: 'POST',
        redirect: 'manual',
        headers: { cookie, origin, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields),
      });
    const read = (path: string, cookie: string) => fetch(origin + path, { headers: { cookie } });
    const write = (action: string, cookie: string, payload: Schema.Json, from = origin) =>
      fetch(origin + api + action, {
        method: 'POST',
        headers: {
          cookie,
          origin: from,
          'content-type': 'application/json',
          'x-quest-user': party.owner.userId,
        },
        body: JSON.stringify(payload),
      });
    const newPlayer = async (name: string) => {
      const response = await fetch(`http://localhost:${fixturePort}/new-user`, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ name, verified: true, google: true }),
      });
      expect(response.status).toBe(200);
      return Schema.decodeUnknownSync(Actor)(await response.json());
    };
    const labels = ['Mira', 'Brasswick', 'Wicket'];
    const [mira, brasswick, wicket] = await Promise.all([
      newPlayer('mira-player'),
      newPlayer('brasswick-player'),
      newPlayer('wicket-player'),
    ]);
    const actors = [mira, brasswick, wicket];
    expect((await read(api + 'room', party.outsider.cookie)).status).toBe(404);
    const anonymous = await fetch(origin + lobby, { redirect: 'manual' });
    expect(anonymous.headers.get('location')).toBe('/login?returnTo=' + encodeURIComponent(lobby));

    const browser = await chromium.launch();
    try {
      const open = async (cookie: string) => {
        const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
        context.setDefaultTimeout(12_000);
        const split = cookie.indexOf('=');
        await context.addCookies([
          { name: cookie.slice(0, split), value: cookie.slice(split + 1), url: origin },
        ]);
        const page = await context.newPage();
        await page.goto(origin + '/app');
        return page;
      };
      const dm = await open(party.owner.cookie);
      const shotDir = process.env.ZLOZ_QUESTMANCER_EVIDENCE;
      if (shotDir) await mkdir(shotDir, { recursive: true });
      const capture = async (locator: Locator, name: string) => {
        if (shotDir) await locator.screenshot({ path: join(shotDir, name + '.png') });
      };
      await capture(dm.getByRole('region', { name: 'Questmancer' }), 'dashboard');
      const previewPath = lobby + '/preview';
      const signedOut = await fetch(origin + previewPath, { redirect: 'manual' });
      expect(signedOut.status).toBe(303);
      expect(signedOut.headers.get('location')).toBe(
        '/login?returnTo=' + encodeURIComponent(previewPath),
      );
      expect((await read(previewPath, party.editor.cookie)).status).toBe(404);
      expect((await read(previewPath, party.viewer.cookie)).status).toBe(404);
      expect((await read(previewPath, party.outsider.cookie)).status).toBe(404);
      expect((await form(previewPath, party.owner.cookie, { action: 'host' })).status).toBe(405);
      expect((await read(api + 'room', party.owner.cookie)).status).toBe(404);
      const surfaceRequests: string[] = [];
      const rememberSurfaceRequest = (request: import('playwright').Request) => {
        if (new URL(request.url()).pathname.startsWith(api)) surfaceRequests.push(request.url());
      };
      dm.on('request', rememberSurfaceRequest);
      await dm.getByRole('link', { name: 'Preview Moonwell', exact: true }).click();
      await browserExpect(
        dm.getByRole('heading', { name: 'The Moonwell Observatory', exact: true }),
      ).toBeVisible();
      await browserExpect(dm.getByText('Read-only preview', { exact: true })).toBeVisible();
      await browserExpect(dm.getByRole('button', { name: 'Reveal room', exact: true })).toHaveCount(
        0,
      );
      await browserExpect(dm.getByRole('link', { name: 'Ledger', exact: true })).toHaveCount(0);
      await dm.waitForFunction(() => {
        const background = document.querySelector<HTMLImageElement>('.scene-art');
        const sprites = Array.from(document.querySelectorAll<HTMLImageElement>('.sprite-art'));
        return (
          background?.complete &&
          background.naturalWidth === 1024 &&
          sprites.length === 4 &&
          sprites.every((image) => image.complete && image.naturalWidth > 0)
        );
      });
      const artwork = dm.locator('.scene-art');
      await dm.getByRole('button', { name: 'Fit scene', exact: true }).click();
      const fitted = await artwork.evaluate((node) => getComputedStyle(node).transform);
      await dm.getByRole('button', { name: 'Zoom in', exact: true }).press('Enter');
      await browserExpect
        .poll(() => artwork.evaluate((node) => getComputedStyle(node).transform))
        .not.toBe(fitted);
      const zoomed = await artwork.evaluate((node) => getComputedStyle(node).transform);
      const board = await dm.locator('.scene-board').boundingBox();
      assert(board, 'The preview board is missing');
      await dm.mouse.move(board.x + 80, board.y + 100);
      await dm.mouse.down();
      await dm.mouse.move(board.x + 130, board.y + 125, { steps: 5 });
      await dm.mouse.up();
      await browserExpect
        .poll(() => artwork.evaluate((node) => getComputedStyle(node).transform))
        .not.toBe(zoomed);
      await dm.getByRole('button', { name: 'Fit scene', exact: true }).click();
      await capture(dm.getByRole('main'), 'owner-preview');
      expect(surfaceRequests).toEqual([]);
      dm.off('request', rememberSurfaceRequest);
      expect((await read(api + 'room', party.owner.cookie)).status).toBe(404);

      await dm.goto(origin + team);
      const invite = async (email: string) => {
        await dm.getByLabel('Email address').fill(email);
        await dm
          .getByRole('region', { name: 'Invite a teammate' })
          .getByRole('combobox')
          .selectOption('viewer');
        await dm.getByRole('button', { name: 'Create invitation link' }).click();
        return dm.getByRole('textbox', { name: 'Invitation link for ' + email }).inputValue();
      };
      for (const seat of ['brasswick', 'wicket']) {
        const email = 'qa+' + key + '-' + seat + '@example.test';
        const page = await browser.newPage();
        await page.goto(await invite(email));
        await page.getByRole('link', { name: 'Continue with email' }).click();
        await page.getByLabel('Email address').fill(email);
        const existing = new Set(await localMessages());
        await page.getByRole('button', { name: 'Send a code', exact: true }).click();
        await browserExpect(page.getByLabel('Six-digit code')).toBeVisible();
        const newMessages = async () =>
          (await localMessages()).filter((file) => !existing.has(file));
        await browserExpect.poll(newMessages).toHaveLength(1);
        const [file] = await newMessages();
        assert(file);
        const message = await Bun.file(join(localOutbox, file)).text();
        const code = /Your Teams sign-in code is (\d{6})/.exec(message)?.[1];
        assert(code, 'The local email contains a sign-in code');
        await page.getByLabel('Six-digit code').fill(code);
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
        await browserExpect(page).toHaveURL(origin + team);
        await browserExpect(page.getByText('Your role: viewer')).toBeVisible();
        await page.close();
      }
      const invitedPages = [];
      for (const actor of actors) {
        const link = await invite(actor.email);
        const page = await open(actor.cookie);
        await page.goto(link);
        if (actor === mira) await capture(page.getByRole('main'), 'player-invitation');
        await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
        await browserExpect(page).toHaveURL(origin + team);
        await browserExpect(page.getByText('Your role: viewer')).toBeVisible();
        invitedPages.push(page);
      }
      await dm.goto(origin + '/app');
      await dm.getByRole('link', { name: 'Host Moonwell', exact: true }).click();
      await dm.getByLabel('Mira', { exact: true }).selectOption(mira.userId);
      await dm.getByLabel('Brasswick', { exact: true }).selectOption(brasswick.userId);
      await dm.getByLabel('Wicket', { exact: true }).selectOption(wicket.userId);
      await capture(dm.getByRole('main'), 'dm-assign-seats');
      expect(
        (
          await form(lobby, party.owner.cookie, {
            action: 'host',
            mira: mira.userId,
            brasswick: mira.userId,
            wicket: wicket.userId,
          })
        ).status,
      ).toBe(400);
      await dm.getByRole('button', { name: 'Host Moonwell', exact: true }).click();
      await browserExpect(
        dm.getByRole('heading', { name: 'Next room', exact: true }),
      ).toBeVisible();
      expect((await read(api + 'room', wicket.cookie)).status).toBe(403);
      expect((await read(team, party.viewer.cookie)).status).toBe(200);
      expect((await read(lobby, party.viewer.cookie)).status).toBe(404);
      expect((await read(api + 'party-ledger', party.viewer.cookie)).status).toBe(404);
      expect((await write('host', party.editor.cookie, [])).status).toBe(404);

      const pages = await Promise.all(
        invitedPages.map(async (page, index) => {
          await page.goto(origin + '/app');
          await page.getByRole('link', { name: 'Join party', exact: true }).click();
          await page.getByRole('button', { name: 'Join party', exact: true }).click();
          await browserExpect(
            page.getByText('You control ' + labels[index] + '.', { exact: false }),
          ).toBeVisible();
          return page;
        }),
      );
      expect(
        (await write('move', mira.cookie, { id: 'wicket', x: 500, y: 500, expected: 0 })).status,
      ).toBe(403);
      expect(
        (
          await write(
            'move',
            mira.cookie,
            { id: 'mira', x: 500, y: 500, expected: 0 },
            'https://unrelated.invalid',
          )
        ).status,
      ).toBe(403);
      await Promise.all(
        pages.map((page, index) =>
          page
            .getByRole('button', { name: 'Select ' + labels[index], exact: true })
            .press('ArrowRight'),
        ),
      );
      await browserExpect
        .poll(async () => {
          // SAFETY: The authenticated room endpoint returns a RoomView.
          const state = (await (await read(api + 'room', party.owner.cookie)).json()) as RoomView;
          return state.tokens
            .filter((token) => token.positionVersion === 1)
            .map((token) => token.label);
        })
        .toEqual(labels);

      await dm.getByLabel('Room name').fill('The Moonwell Observatory');
      await dm.getByLabel('Describe the backdrop').fill('A moonlit telescope');
      await dm.getByRole('button', { name: 'Prepare sample backdrop', exact: true }).click();
      const preview = dm.getByRole('img', { name: 'Draft backdrop for The Moonwell Observatory' });
      await browserExpect(preview).toBeVisible({ timeout: 25_000 });
      const draftPath = await preview.getAttribute('src');
      expect(draftPath).toContain('/preview/');
      const draftId = draftPath!.split('/').at(-1) ?? '';
      expect(draftId).toMatch(/^[0-9a-f-]{36}$/);
      // SAFETY: The DM job endpoint returns the identified job and its stored asset identifier.
      const job = (await (await read(api + 'jobs/' + draftId, party.owner.cookie)).json()) as {
        assetId: string;
      };
      for (const actor of actors) {
        expect((await read(draftPath!, actor.cookie)).status).toBe(404);
        expect((await read(api + 'assets/' + job.assetId, actor.cookie)).status).toBe(404);
      }
      expect(
        (await write('reveal', wicket.cookie, { id: draftId, style: 'generated' })).status,
      ).toBe(403);
      await browserExpect(
        pages[0]!.getByRole('heading', { name: 'The Aurora Gate', exact: true }),
      ).toBeVisible();
      await dm.waitForFunction(() => {
        const image = document.querySelector<HTMLImageElement>('.backdrop-draft img');
        return image?.complete && image.naturalWidth === 1024;
      });
      await capture(dm.locator('.backdrop-draft'), 'dm-backdrop-preview');
      await dm.getByRole('button', { name: 'Reveal room', exact: true }).click();
      await Promise.all(
        pages.map((page) =>
          browserExpect(
            page.getByRole('heading', { name: 'The Moonwell Observatory', exact: true }),
          ).toBeVisible(),
        ),
      );

      const generated = await read(api + 'assets/' + job.assetId, wicket.cookie);
      expect(generated.status).toBe(200);
      expect(generated.headers.get('content-type')).toBe('image/png');
      await dm.getByLabel('Describe the sprite').fill('Pip with a lantern');
      await dm.getByRole('button', { name: 'Prepare sample sprite', exact: true }).click();
      await browserExpect(dm.getByRole('img', { name: 'Draft sprite of Pip' })).toBeVisible({
        timeout: 25_000,
      });
      await dm.waitForFunction(() => {
        const image = document.querySelector<HTMLImageElement>('img[alt="Draft sprite of Pip"]');
        return image?.complete && image.naturalWidth > 0;
      });
      await capture(
        dm.getByRole('img', { name: 'Draft sprite of Pip' }).locator('..'),
        'dm-sprite-preview',
      );
      await dm.getByRole('button', { name: 'Apply to Pip', exact: true }).click();
      await browserExpect
        .poll(async () => {
          // SAFETY: The authenticated room endpoint returns a RoomView.
          const state = (await (await read(api + 'room', wicket.cookie)).json()) as RoomView;
          return state.tokens.find((token) => token.id === 'pip')?.artVersion;
        })
        .toBe(1);
      await Promise.all(
        pages.map(async (page, index) => {
          await page.waitForFunction(() => {
            const backdrop = document.querySelector<HTMLImageElement>('.scene-board .scene-art');
            const pip = document.querySelector<HTMLImageElement>(
              'button[aria-label="Select Pip"] img',
            );
            return (
              backdrop?.complete &&
              backdrop.naturalWidth === 1024 &&
              pip?.complete &&
              pip.naturalWidth > 0 &&
              new URL(pip.src).pathname.includes('/api/assets/')
            );
          });
          await capture(page.getByRole('main'), 'room-' + labels[index]!.toLowerCase());
        }),
      );
      await dm.getByRole('button', { name: 'Save room to Ledger', exact: true }).click();
      await dm.getByLabel('Session notes · DM only').fill('The south stair is secret.');
      await dm.getByRole('button', { name: 'Save entry', exact: true }).click();
      await browserExpect(
        dm.getByRole('button', { name: 'Prepare party entry', exact: true }),
      ).toBeEnabled();
      await dm.reload();
      await browserExpect(dm.getByLabel('Session notes · DM only')).toHaveValue(
        'The south stair is secret.',
      );
      await dm.getByRole('button', { name: 'Prepare party entry', exact: true }).click();
      await dm.getByLabel('Party title').fill('Moonwell recap');
      await dm.getByLabel('Party recap').fill('Three adventurers looked through the telescope.');
      await dm.getByRole('button', { name: 'Preview party entry', exact: true }).click();
      await dm.waitForFunction(() => {
        const image = document.querySelector<HTMLImageElement>('.party-editor .party-entry img');
        return image?.complete && image.naturalWidth === 1024;
      });
      await capture(dm.getByRole('region', { name: 'Party preview' }), 'dm-party-preview');
      for (const actor of actors) {
        expect(await (await read(api + 'party-ledger', actor.cookie)).json()).toEqual([]);
      }
      await dm.getByRole('button', { name: 'Publish to party', exact: true }).click();
      await Promise.all(
        pages.map(async (page, index) => {
          await browserExpect(
            page.getByRole('heading', { name: 'Moonwell recap', exact: true }),
          ).toBeVisible();
          await page.goto(origin + '/app');
          await page.getByRole('link', { name: 'Resume session', exact: true }).click();
          await browserExpect(
            page.getByRole('heading', { name: 'Moonwell recap', exact: true }),
          ).toBeVisible();
          await page.waitForFunction(() => {
            const image = document.querySelector<HTMLImageElement>(
              '#librarians-ledger .party-entry img',
            );
            return image?.complete && image.naturalWidth === 1024;
          });
          await browserExpect(page.getByText('The south stair is secret.')).toHaveCount(0);
          await browserExpect(
            page.getByRole('heading', { name: 'Next room', exact: true }),
          ).toHaveCount(0);
          await capture(
            page.getByRole('region', { name: 'Party Ledger' }),
            'party-ledger-' + labels[index]!.toLowerCase(),
          );
        }),
      );
      for (const actor of actors) {
        expect((await read(api + 'ledger', actor.cookie)).status).toBe(404);
        expect(await (await read(api + 'party-ledger', actor.cookie)).text()).not.toContain(
          'south stair',
        );
      }
      await dm.goto(origin + team);
      await dm.getByRole('button', { name: 'Remove ' + mira.email, exact: true }).click();
      await browserExpect(
        dm.getByRole('button', { name: 'Remove ' + mira.email, exact: true }),
      ).toHaveCount(0);
      expect((await read(api + 'room', mira.cookie)).status).toBe(404);
      expect((await read(api + 'party-ledger', mira.cookie)).status).toBe(404);
    } finally {
      await browser.close();
    }
  } finally {
    await stopLocalStack(child);
  }
}, 150_000);

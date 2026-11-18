import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';

import { splitSqliteStatements } from '@alchemy.run/sql/SqlFile';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { createOperationDocument, decideOperation } from '@opsydyn/foldkit-zloz';
import type { ZlozOperationRequest } from '@opsydyn/foldkit-zloz';
import { operationHash } from '@opsydyn/foldkit-zloz-alchemy/hash';
import { betterAuth } from 'better-auth';
import { getCookies } from 'better-auth/cookies';
import { makeSignature } from 'better-auth/crypto';
import { getMigrations } from 'better-auth/db/migration';
import { organization as organizationPlugin } from 'better-auth/plugins';
import { Data, Schema } from 'effect';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

import { authOptions } from '../src/auth-options';
import { bootstrapTeam } from '../src/bootstrap';
import { handleDiagramRequest, type DiagramService } from '../src/diagram-routes';

class FixtureRejected extends Data.TaggedError('FixtureRejected')<{ message: string }> {}

const origin = 'https://zloz.test';
const secret = 'qualification-fixture-secret-never-use-in-production';

describe('Better Auth organization contract on real local D1', () => {
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("fixture"); } }',
      compatibilityDate: '2026-11-11',
      d1Databases: ['DB'],
      cf: false,
    }),
  );
  const database = runtime.getD1Database('DB');
  const options = authOptions(origin, 'fixture-client', 'fixture-provider-secret');
  const auth = database.then(async (database) => {
    for (const filename of [
      '0001_auth.sql',
      '0002_membership_invariants.sql',
      '0003_unique_membership.sql',
      '0004_team_onboarding.sql',
    ]) {
      const sql = await Bun.file(new URL(`../migrations/${filename}`, import.meta.url)).text();
      for (const statement of splitSqliteStatements(sql)) await database.prepare(statement).run();
    }
    return betterAuth({ ...options, database, secret });
  });

  beforeAll(async () => {
    await auth;
  });
  afterAll(async () => {
    await runtime.dispose();
  });

  const user = async (name: string, verified = true) => {
    const context = await (await auth).$context;
    const user = await context.internalAdapter.createUser(
      {
        name,
        email: `${name}-${crypto.randomUUID()}@example.test`,
        emailVerified: verified,
      },
      { method: 'oauth', oauth: { providerId: 'google', profile: {} } },
    );
    const session = await context.internalAdapter.createSession(user.id);
    const signature = await makeSignature(session.token, secret);
    const cookie = `${getCookies(options).sessionToken.name}=${encodeURIComponent(`${session.token}.${signature}`)}`;
    return { user, cookie, session };
  };
  const request = async (path: string, cookie: string, body: Readonly<Record<string, string>>) =>
    (await auth).handler(
      new Request(`${origin}/api/auth/${path}`, {
        method: 'POST',
        headers: { cookie, origin, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  const team = async (owner: Awaited<ReturnType<typeof user>>) => {
    const organization = await (
      await auth
    ).api.createOrganization({
      body: { name: 'Qualification team', slug: crypto.randomUUID(), userId: owner.user.id },
    });
    if (!organization)
      throw new FixtureRejected({ message: 'Server-side organization bootstrap failed' });
    return organization;
  };

  test('creation waits for its own live-view receipt before publishing the directory entry', async () => {
    const owner = await user('creation-view-lag');
    const organization = await team(owner);
    const db = await database;
    const target = { teamId: organization.id, diagramId: crypto.randomUUID() };
    const graph = { nodes: [], edges: [] };
    const document = createOperationDocument(graph);
    const fence = { stream: 'creation-stream', version: 1 };
    const entered = Promise.withResolvers<unknown>();
    const release = Promise.withResolvers<void>();
    let unavailable = false;
    const unexpected = async (): Promise<never> => {
      throw new FixtureRejected({ message: 'Unexpected diagram service call' });
    };
    const service: DiagramService = {
      saveAssessment: unexpected,
      defer: () => undefined,
      checkpoint: unexpected,
      recover: unexpected,
      graph: unexpected,
      execute: unexpected,
      heartbeat: unexpected,
      initialize: async () => ({
        created: true,
        sourceVersion: fence.version,
        sourceStream: fence.stream,
      }),
      frame: async (actor, resource, atLeast?: { stream: string; version: number }) => {
        entered.resolve({ actor, target: resource, atLeast });
        await release.promise;
        if (unavailable) throw new FixtureRejected({ message: 'View consistency timed out' });
        return { target, sourceVersion: 1, document, coverage: [] };
      },
    };
    const nativeAuth = await auth;
    const create = () =>
      handleDiagramRequest(
        new Request(`${origin}/api/zloz/diagrams/${target.teamId}/${target.diagramId}`, {
          method: 'POST',
          headers: { cookie: owner.cookie, origin, 'content-type': 'application/json' },
          body: JSON.stringify({
            operationId: target.diagramId,
            name: 'Cold open',
            graph: { version: 1, graph },
          }),
        }),
        db,
        nativeAuth,
        service,
      );
    const pending = create();
    // oxlint-disable-next-line linteffect/no-try-catch -- Release the held native Promise even when the regression assertion fails.
    try {
      const outcome = await Promise.race([
        entered.promise.then((value) => ({ type: 'fence', value })),
        pending.then(() => ({ type: 'premature-response' })),
      ]);
      expect(outcome).toEqual({
        type: 'fence',
        value: {
          actor: { userId: owner.user.id, sessionId: owner.session.id },
          target,
          atLeast: fence,
        },
      });
      expect(
        await db
          .prepare('SELECT name FROM diagramDirectory WHERE organizationId = ? AND diagramId = ?')
          .bind(target.teamId, target.diagramId)
          .first(),
      ).toBeNull();
      unavailable = true;
    } finally {
      release.resolve();
      await pending;
    }
    expect((await pending).status).toBe(503);
    expect(
      await db
        .prepare('SELECT name FROM diagramDirectory WHERE organizationId = ? AND diagramId = ?')
        .bind(target.teamId, target.diagramId)
        .first(),
    ).toBeNull();
    unavailable = false;
    expect((await create()).status).toBe(200);
    expect(
      await db
        .prepare('SELECT name FROM diagramDirectory WHERE organizationId = ? AND diagramId = ?')
        .bind(target.teamId, target.diagramId)
        .first(),
    ).toEqual({ name: 'Cold open' });
  });

  test('committed edit responds while directory projection is stalled, failed or overtaken', async () => {
    for (const fail of [false, true]) {
      const owner = await user('directory-lag');
      const organization = await team(owner);
      const db = await database;
      const diagramId = crypto.randomUUID();
      await db
        .prepare(
          'INSERT INTO diagramDirectory (organizationId, diagramId, name, updatedAt) VALUES (?, ?, ?, 0)',
        )
        .bind(organization.id, diagramId, 'Lag proof')
        .run();
      const graph = {
        nodes: [
          {
            id: 'n',
            label: 'Before',
            position: { x: 0, y: 0 },
            size: { width: 100, height: 80 },
            ports: [],
          },
        ],
        edges: [],
      };
      const request: ZlozOperationRequest = {
        version: 1,
        operationId: crypto.randomUUID(),
        operation: { type: 'RenameNode', id: 'n', expected: 0, label: 'Committed' },
      };
      const receipt = decideOperation(createOperationDocument(graph), request, {
        actorId: owner.user.id,
        teamId: organization.id,
        diagramId,
      }).receipt;
      const hash = await operationHash(request);
      const blocked = Promise.withResolvers<void>();
      const started = Promise.withResolvers<void>();
      const background: Promise<void>[] = [];
      const delay = (statement: D1PreparedStatement): D1PreparedStatement => ({
        bind: (...values) => delay(statement.bind(...values)),
        first: statement.first.bind(statement),
        all: statement.all.bind(statement),
        raw: statement.raw.bind(statement),
        run: async <T>() => {
          started.resolve();
          await blocked.promise;
          return statement.run<T>();
        },
      });
      const delayed: D1Database = {
        prepare: (sql) =>
          sql.startsWith('UPDATE diagramDirectory') ? delay(db.prepare(sql)) : db.prepare(sql),
        batch: db.batch.bind(db),
        exec: db.exec.bind(db),
        dump: db.dump.bind(db),
        withSession: db.withSession.bind(db),
      };
      const unexpected = async (): Promise<never> => {
        throw new FixtureRejected({ message: 'Unexpected diagram service call' });
      };
      const response = handleDiagramRequest(
        new Request(`${origin}/api/zloz/diagrams/${organization.id}/${diagramId}/operations`, {
          method: 'POST',
          headers: { cookie: owner.cookie, origin, 'content-type': 'application/json' },
          body: JSON.stringify(request),
        }),
        delayed,
        await auth,
        {
          defer: (work: Promise<void>) => {
            background.push(work);
          },
          execute: async () => ({ receipt, sourceVersion: 1, requestHash: hash }),
          saveAssessment: unexpected,
          checkpoint: unexpected,
          recover: unexpected,
          graph: unexpected,
          initialize: unexpected,
          frame: unexpected,
          heartbeat: unexpected,
        },
      );
      // oxlint-disable-next-line linteffect/no-try-catch -- Release the held native D1 promise even when an assertion fails.
      try {
        await started.promise;
        const outcome = await Promise.race([
          response.then((response) => ({ _tag: 'Response' as const, response })),
          Bun.sleep(100).then(() => ({ _tag: 'Timeout' as const })),
        ]);
        expect(outcome._tag).toBe('Response');
        if (outcome._tag !== 'Response')
          throw new FixtureRejected({
            message: 'Commit acknowledgement waited for secondary metadata',
          });
        expect(outcome.response.status).toBe(200);
        expect(await outcome.response.json()).toMatchObject({
          receipt: { status: 'accepted', documentVersion: 1 },
        });
        expect(background).toHaveLength(1);
        expect(
          await db
            .prepare(
              'SELECT updatedAt FROM diagramDirectory WHERE organizationId = ? AND diagramId = ?',
            )
            .bind(organization.id, diagramId)
            .first('updatedAt'),
        ).toBe(0);
        // A later projection can finish first; the delayed older write must not regress it.
        const newer = Date.now() + 1000;
        await db
          .prepare(
            'UPDATE diagramDirectory SET updatedAt = ? WHERE organizationId = ? AND diagramId = ?',
          )
          .bind(newer, organization.id, diagramId)
          .run();
        if (fail) blocked.reject(new FixtureRejected({ message: 'Secondary metadata failure' }));
        else blocked.resolve();
        await Promise.all(background);
        expect(
          await db
            .prepare(
              'SELECT updatedAt FROM diagramDirectory WHERE organizationId = ? AND diagramId = ?',
            )
            .bind(organization.id, diagramId)
            .first('updatedAt'),
        ).toBe(newer);
      } finally {
        blocked.resolve();
        await response;
        await Promise.all(background);
      }
    }
  });

  test('fresh directory recency skips the projection request while stale rows and fresh authority checks still work', async () => {
    const editor = await user('directory-request-budget');
    const organization = await team(await user('directory-request-founder'));
    const db = await database;
    await db
      .prepare(
        'INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(crypto.randomUUID(), organization.id, editor.user.id, 'editor', Date.now())
      .run();
    const diagramId = crypto.randomUUID();
    const setTimestamp = async (timestamp: number) =>
      db
        .prepare(
          'UPDATE diagramDirectory SET updatedAt = ? WHERE organizationId = ? AND diagramId = ?',
        )
        .bind(timestamp, organization.id, diagramId)
        .run();
    await db
      .prepare(
        'INSERT INTO diagramDirectory (organizationId, diagramId, name, updatedAt) VALUES (?, ?, ?, ?)',
      )
      .bind(organization.id, diagramId, 'Request budget', Date.now() + 60_000)
      .run();
    const graph = {
      nodes: [
        {
          id: 'n',
          label: 'Before',
          position: { x: 0, y: 0 },
          size: { width: 100, height: 80 },
          ports: [],
        },
      ],
      edges: [],
    };
    const input: ZlozOperationRequest = {
      version: 1,
      operationId: crypto.randomUUID(),
      operation: { type: 'RenameNode', id: 'n', expected: 0, label: 'Committed' },
    };
    const receipt = decideOperation(createOperationDocument(graph), input, {
      actorId: editor.user.id,
      teamId: organization.id,
      diagramId,
    }).receipt;
    const hash = await operationHash(input);
    let projectionRequests = 0;
    let targetReads = 0;
    let executions = 0;
    const background: Promise<void>[] = [];
    const observed: D1Database = {
      prepare: (sql) => {
        if (sql.startsWith('UPDATE diagramDirectory')) projectionRequests++;
        if (
          sql.startsWith('SELECT ') &&
          (sql.includes('FROM member') || sql.includes('FROM diagramDirectory'))
        )
          targetReads++;
        return db.prepare(sql);
      },
      batch: db.batch.bind(db),
      exec: db.exec.bind(db),
      dump: db.dump.bind(db),
      withSession: db.withSession.bind(db),
    };
    const unexpected = async (): Promise<never> => {
      throw new FixtureRejected({ message: 'Unexpected diagram service call' });
    };
    const nativeAuth = await auth;
    const operation = (targetId = diagramId, targetTeam = organization.id) =>
      handleDiagramRequest(
        new Request(`${origin}/api/zloz/diagrams/${targetTeam}/${targetId}/operations`, {
          method: 'POST',
          headers: { cookie: editor.cookie, origin, 'content-type': 'application/json' },
          body: JSON.stringify(input),
        }),
        observed,
        nativeAuth,
        {
          defer: (work) => {
            background.push(work);
          },
          execute: async (actor, target) => {
            expect(actor).toEqual({ userId: editor.user.id, sessionId: editor.session.id });
            expect(target).toEqual({ teamId: organization.id, diagramId });
            executions++;
            return { receipt, sourceVersion: 1, requestHash: hash };
          },
          saveAssessment: unexpected,
          checkpoint: unexpected,
          recover: unexpected,
          graph: unexpected,
          initialize: unexpected,
          frame: unexpected,
          heartbeat: unexpected,
        },
      );
    const now = Date.now();
    const clock = spyOn(Date, 'now').mockReturnValue(now);
    // oxlint-disable-next-line linteffect/no-try-catch -- Restore the scoped business clock even when the real D1 boundary assertion fails.
    try {
      await setTimestamp(now - 999);
      const first = await operation();
      expect(first.status).toBe(200);
      expect(await first.json()).toMatchObject({
        receipt: { status: 'accepted', documentVersion: 1 },
      });
      expect(executions).toBe(1);
      expect(targetReads).toBe(1);
      expect(projectionRequests).toBe(0);
      expect(background).toEqual([]);
      await setTimestamp(now - 1000);
      expect((await operation()).status).toBe(200);
      expect(projectionRequests).toBe(1);
      expect(background).toHaveLength(1);
      await Promise.all(background);
      expect(
        await db
          .prepare(
            'SELECT updatedAt FROM diagramDirectory WHERE organizationId = ? AND diagramId = ?',
          )
          .bind(organization.id, diagramId)
          .first<number>('updatedAt'),
      ).toBe(now);
      await setTimestamp(now + 60_000);
      expect((await operation()).status).toBe(200);
      expect(executions).toBe(3);
      expect(projectionRequests).toBe(1);
      expect(targetReads).toBe(3);
      const foreign = await team(await user('directory-join-foreign-founder'));
      const foreignId = crypto.randomUUID();
      await db
        .prepare(
          'INSERT INTO diagramDirectory (organizationId, diagramId, name, updatedAt) VALUES (?, ?, ?, ?)',
        )
        .bind(foreign.id, foreignId, 'Foreign private diagram', now)
        .run();
      expect((await operation(foreignId)).status).toBe(404);
      expect((await operation(foreignId, foreign.id)).status).toBe(403);
      expect(executions).toBe(3);
      expect(targetReads).toBe(5);
      await db
        .prepare('DELETE FROM member WHERE organizationId = ? AND userId = ?')
        .bind(organization.id, editor.user.id)
        .run();
      expect((await operation()).status).toBe(403);
      expect(executions).toBe(3);
      expect(projectionRequests).toBe(1);
      expect((await operation(foreignId)).status).toBe(403);
      expect(targetReads).toBe(7);
      expect(executions).toBe(3);
    } finally {
      clock.mockRestore();
    }
  });

  test('the real migration creates plugin tables and a signed session resolves', async () => {
    const migrations = await getMigrations({ ...options, database: await database, secret });
    expect(migrations.toBeCreated).toEqual([]);
    expect(migrations.toBeAdded).toEqual([]);
    expect(migrations.toBeAddedIndexes).toEqual([]);
    const alice = await user('alice');
    const session = await (
      await auth
    ).api.getSession({ headers: new Headers({ cookie: alice.cookie }) });
    expect(session?.user.id).toBe(alice.user.id);
    const tables = await (
      await database
    )
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all<{ name: string }>();
    expect(tables.results.map((row) => row.name)).toEqual(
      expect.arrayContaining(['user', 'session', 'organization', 'member', 'invitation']),
    );
  });

  test('bootstrap rolls back the organization if the first membership cannot be written', async () => {
    const owner = await user('rollback-owner');
    const context = await (await auth).$context;
    await context.internalAdapter.linkAccount({
      userId: owner.user.id,
      providerId: 'google',
      accountId: owner.user.id,
    });
    const db = await database;
    // This trigger exists only in this disposable D1 instance, never in migrations.
    await db
      .prepare(
        "CREATE TRIGGER fixture_bootstrap_failure BEFORE INSERT ON member WHEN NEW.role = 'owner' BEGIN SELECT RAISE(ABORT, 'fixture_bootstrap_failure'); END",
      )
      .run();
    const slug = `rollback-${crypto.randomUUID()}`;
    await expect(
      bootstrapTeam(db, { ownerEmail: owner.user.email, name: 'Rollback team', slug, apply: true }),
    ).rejects.toThrow();
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM organization WHERE slug = ?')
        .bind(slug)
        .first(),
    ).toMatchObject({ count: 0 });
    await db.prepare('DROP TRIGGER fixture_bootstrap_failure').run();
    const retried = await bootstrapTeam(db, {
      ownerEmail: owner.user.email,
      name: 'Rollback team',
      slug,
      apply: true,
    });
    expect(retried.status).toBe(200);
    expect(await retried.json()).toMatchObject({ status: 'created' });
  });

  test('native Google initiation preserves a local invitation callback and rejects external callbacks', async () => {
    const response = await request('sign-in/social', '', {
      provider: 'google',
      callbackURL: `${origin}/join/invitation123`,
    });
    expect(response.status).toBe(200);
    const result = Schema.decodeUnknownSync(Schema.Struct({ url: Schema.String }))(
      await response.json(),
    );
    const url = new URL(result.url);
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe(`${origin}/api/auth/callback/google`);
    expect(url.searchParams.get('prompt')).toBe('select_account');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(response.headers.getSetCookie().join(';')).toContain('HttpOnly');
    expect(response.headers.getSetCookie().join(';')).toContain('Secure');
    const rejected = await request('sign-in/social', '', {
      provider: 'google',
      callbackURL: 'https://attacker.invalid/join/stolen',
    });
    expect(rejected.status).toBe(403);
  });

  test('public users cannot create teams, including a forged bootstrap userId', async () => {
    const alice = await user('alice');
    const body = { name: 'Forbidden', slug: crypto.randomUUID(), userId: alice.user.id };
    expect((await request('organization/create', alice.cookie, body)).status).toBe(403);
    expect((await request('organization/create', '', body)).status).toBe(401);
  });

  test('invitation acceptance requires its intended verified identity', async () => {
    const alice = await user('alice');
    const bob = await user('bob');
    const mallory = await user('mallory');
    const organization = await team(alice);
    const invitation = await (
      await auth
    ).api.createInvitation({
      headers: new Headers({ cookie: alice.cookie }),
      body: { organizationId: organization.id, email: bob.user.email, role: 'editor' },
    });
    expect(
      (
        await request('organization/accept-invitation', mallory.cookie, {
          invitationId: invitation.id,
        })
      ).ok,
    ).toBe(false);
    expect(
      (await request('organization/accept-invitation', bob.cookie, { invitationId: invitation.id }))
        .status,
    ).toBe(200);
    const member = await (
      await database
    )
      .prepare('SELECT role FROM member WHERE organizationId = ? AND userId = ?')
      .bind(organization.id, bob.user.id)
      .first<{ role: string }>();
    expect(member?.role).toBe('editor');
  });

  test.each(['demote', 'remove'] as const)(
    'concurrent raw changes cannot %s every owner',
    async (operation) => {
      const alice = await user('alice');
      const bob = await user('bob');
      const organization = await team(alice);
      const db = await database;
      const bobMember = crypto.randomUUID();
      await db
        .prepare(
          'INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(bobMember, organization.id, bob.user.id, 'owner', Date.now())
        .run();
      const aliceMember = await db
        .prepare('SELECT id FROM member WHERE organizationId = ? AND userId = ?')
        .bind(organization.id, alice.user.id)
        .first<{ id: string }>();
      if (!aliceMember)
        throw new FixtureRejected({ message: 'Owner bootstrap did not create membership' });
      const barrier = Promise.withResolvers<void>();
      let entrants = 0;
      const beforeWrite = async () => {
        entrants += 1;
        if (entrants === 2) barrier.resolve();
        await barrier.promise;
      };
      const [plugin] = options.plugins;
      const racing = betterAuth({
        ...options,
        database: db,
        secret,
        plugins: [
          organizationPlugin({
            ...plugin.options,
            organizationHooks: {
              ...plugin.options.organizationHooks,
              beforeUpdateMemberRole: beforeWrite,
              beforeRemoveMember: beforeWrite,
            },
          }),
        ],
      });
      const change = (cookie: string, memberId: string) =>
        racing.handler(
          new Request(
            `${origin}/api/auth/organization/${operation === 'demote' ? 'update-member-role' : 'remove-member'}`,
            {
              method: 'POST',
              headers: { cookie, origin, 'content-type': 'application/json' },
              body: JSON.stringify(
                operation === 'demote'
                  ? { organizationId: organization.id, memberId, role: 'editor' }
                  : { organizationId: organization.id, memberIdOrEmail: memberId },
              ),
            },
          ),
        );
      const responses = await Promise.all([
        change(alice.cookie, bobMember),
        change(bob.cookie, aliceMember.id),
      ]);
      const owners = await db
        .prepare("SELECT COUNT(*) AS count FROM member WHERE organizationId = ? AND role = 'owner'")
        .bind(organization.id)
        .first<{ count: number }>();
      expect(owners?.count).toBeGreaterThanOrEqual(1);
      expect(responses.filter((response) => response.ok)).toHaveLength(1);
    },
  );

  test('unverified, expired and cancelled invitations cannot create membership', async () => {
    const owner = await user('owner');
    const target = await user('target', false);
    const organization = await team(owner);
    const invitation = await (
      await auth
    ).api.createInvitation({
      headers: new Headers({ cookie: owner.cookie }),
      body: {
        organizationId: organization.id,
        email: target.user.email,
        role: 'viewer',
      },
    });
    expect(
      (
        await request('organization/accept-invitation', target.cookie, {
          invitationId: invitation.id,
        })
      ).ok,
    ).toBe(false);
    const db = await database;
    await db.prepare('UPDATE user SET emailVerified = 1 WHERE id = ?').bind(target.user.id).run();
    await db.prepare('UPDATE invitation SET expiresAt = 0 WHERE id = ?').bind(invitation.id).run();
    expect(
      (
        await request('organization/accept-invitation', target.cookie, {
          invitationId: invitation.id,
        })
      ).ok,
    ).toBe(false);
    await db
      .prepare("UPDATE invitation SET expiresAt = ?, status = 'canceled' WHERE id = ?")
      .bind(Date.now() + 60_000, invitation.id)
      .run();
    expect(
      (
        await request('organization/accept-invitation', target.cookie, {
          invitationId: invitation.id,
        })
      ).ok,
    ).toBe(false);
    const count = await db
      .prepare('SELECT COUNT(*) AS count FROM member WHERE organizationId = ? AND userId = ?')
      .bind(organization.id, target.user.id)
      .first<{ count: number }>();
    expect(count?.count).toBe(0);
  });

  test('raw plugin endpoints reject unsupported and combined roles', async () => {
    const alice = await user('role-owner');
    const bob = await user('role-target');
    const organization = await team(alice);
    const memberId = crypto.randomUUID();
    await (
      await database
    )
      .prepare(
        'INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(memberId, organization.id, bob.user.id, 'editor', Date.now())
      .run();
    for (const role of ['admin', 'member', 'owner,viewer']) {
      expect(
        (
          await request('organization/invite-member', alice.cookie, {
            organizationId: organization.id,
            email: `target-${crypto.randomUUID()}@example.test`,
            role,
          })
        ).ok,
      ).toBe(false);
      expect(
        (
          await request('organization/update-member-role', alice.cookie, {
            organizationId: organization.id,
            memberId,
            role,
          })
        ).ok,
      ).toBe(false);
    }
    expect(
      await (await database).prepare('SELECT role FROM member WHERE id = ?').bind(memberId).first(),
    ).toMatchObject({ role: 'editor' });
  });

  test('concurrent acceptance at nine members admits one and keeps the other invitation retryable', async () => {
    const alice = await user('capacity-owner');
    const organization = await team(alice);
    const db = await database;
    for (let index = 0; index < 8; index += 1) {
      const filler = await user(`capacity-${index}`);
      await db
        .prepare(
          'INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(crypto.randomUUID(), organization.id, filler.user.id, 'viewer', Date.now())
        .run();
    }
    const entrants = [await user('first-entrant'), await user('second-entrant')];
    const invitations: { id: string }[] = [];
    for (const entrant of entrants)
      invitations.push(
        await (
          await auth
        ).api.createInvitation({
          headers: new Headers({ cookie: alice.cookie }),
          body: { organizationId: organization.id, email: entrant.user.email, role: 'editor' },
        }),
      );
    const barrier = Promise.withResolvers<void>();
    let waiting = 0;
    const [plugin] = options.plugins;
    const racing = betterAuth({
      ...options,
      database: db,
      secret,
      plugins: [
        organizationPlugin({
          ...plugin.options,
          organizationHooks: {
            ...plugin.options.organizationHooks,
            beforeAcceptInvitation: async () => {
              waiting += 1;
              if (waiting === 2) barrier.resolve();
              await barrier.promise;
            },
          },
        }),
      ],
    });
    const responses = await Promise.all(
      entrants.map((entrant, index) =>
        racing.handler(
          new Request(`${origin}/api/auth/organization/accept-invitation`, {
            method: 'POST',
            headers: { origin, cookie: entrant.cookie, 'content-type': 'application/json' },
            body: JSON.stringify({ invitationId: invitations[index]?.id }),
          }),
        ),
      ),
    );
    expect(responses.filter((response) => response.ok)).toHaveLength(1);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS count FROM member WHERE organizationId = ?')
        .bind(organization.id)
        .first(),
    ).toMatchObject({ count: 10 });
    const states = await db
      .prepare('SELECT status FROM invitation WHERE organizationId = ? ORDER BY status')
      .bind(organization.id)
      .all<{ status: string }>();
    expect(states.results.map((row) => row.status)).toEqual(['accepted', 'pending']);
  });

  test('duplicate acceptance grants a single membership with the invitation role', async () => {
    const owner = await user('owner');
    const target = await user('target');
    const organization = await team(owner);
    const invitation = await (
      await auth
    ).api.createInvitation({
      headers: new Headers({ cookie: owner.cookie }),
      body: {
        organizationId: organization.id,
        email: target.user.email,
        role: 'viewer',
      },
    });
    await Promise.all([
      request('organization/accept-invitation', target.cookie, {
        invitationId: invitation.id,
        role: 'owner',
      }),
      request('organization/accept-invitation', target.cookie, {
        invitationId: invitation.id,
        role: 'owner',
      }),
    ]);
    const memberships = await (
      await database
    )
      .prepare('SELECT role FROM member WHERE organizationId = ? AND userId = ?')
      .bind(organization.id, target.user.id)
      .all<{ role: string }>();
    expect(memberships.results).toEqual([{ role: 'viewer' }]);
  });
});

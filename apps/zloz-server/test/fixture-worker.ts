import { CloudflareD1 } from '@alchemy.run/better-auth/CloudflareD1';
import * as Cloudflare from '@alchemy.run/cloudflare';
import { getCookies } from 'better-auth/cookies';
import { makeSignature } from 'better-auth/crypto';
import { Config, Effect, Redacted, Schema } from 'effect';
import { HttpServerRequest, HttpServerResponse } from 'effect/http';

import { Auth, AuthLive } from '../src/auth';
import { AuthDb } from '../src/database';

// This module is imported ONLY by the guarded local test stack, never by the app.
export default class FixtureWorker extends Cloudflare.Worker<FixtureWorker>()(
  'ZlozTeamFixture',
  {
    main: import.meta.url,
    workersDev: false,
    compatibility: { date: '2026-11-11', flags: ['nodejs_compat'] },
    dev: { port: Config.Number('ZLOZ_FIXTURE_PORT'), strictPort: true },
  },
  Effect.gen(function* () {
    const auth = yield* Auth;
    const database = yield* Cloudflare.D1.QueryDatabase(AuthDb);
    const key = yield* Config.Redacted('ZLOZ_FIXTURE_KEY');
    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        if (request.headers.authorization !== `Bearer ${Redacted.value(key)}`)
          return HttpServerResponse.empty({ status: 403 });
        const path = new URL(request.url, 'http://localhost').pathname;
        const native = yield* auth.auth;
        const db = yield* database.raw;
        if (path === '/new-user') {
          const web = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
          const input = Schema.decodeUnknownSync(
            Schema.Struct({
              name: Schema.String,
              verified: Schema.Boolean,
              google: Schema.Boolean,
            }),
          )(yield* Effect.promise(() => web.json()));
          return yield* Effect.promise(async () => {
            const context = await native.$context;
            const user = await context.internalAdapter.createUser(
              {
                name: input.name,
                email: `${input.name}-${crypto.randomUUID()}@example.test`,
                emailVerified: input.verified,
              },
              { method: 'oauth', oauth: { providerId: 'google', profile: {} } },
            );
            if (input.google)
              await context.internalAdapter.linkAccount({
                userId: user.id,
                providerId: 'google',
                accountId: user.id,
              });
            const session = await context.internalAdapter.createSession(user.id);
            const signature = await makeSignature(session.token, context.secret);
            return HttpServerResponse.json({
              userId: user.id,
              email: user.email,
              sessionId: session.id,
              memberId: '',
              cookie: `${getCookies(native.options).sessionToken.name}=${encodeURIComponent(`${session.token}.${signature}`)}`,
            });
          }).pipe(Effect.flatten);
        }
        if (path === '/seed') {
          return yield* Effect.promise(async () => {
            const context = await native.$context;
            const actor = async (name: string) => {
              const user = await context.internalAdapter.createUser(
                { name, email: `${name}-${crypto.randomUUID()}@example.test`, emailVerified: true },
                { method: 'oauth', oauth: { providerId: 'google', profile: {} } },
              );
              const session = await context.internalAdapter.createSession(user.id);
              await context.internalAdapter.linkAccount({
                userId: user.id,
                providerId: 'google',
                accountId: user.id,
              });
              const signature = await makeSignature(session.token, context.secret);
              const cookie = `${getCookies(native.options).sessionToken.name}=${encodeURIComponent(`${session.token}.${signature}`)}`;
              return {
                userId: user.id,
                email: user.email,
                cookie,
                sessionId: session.id,
                memberId: crypto.randomUUID(),
              };
            };
            const owner = await actor('owner');
            const editor = await actor('editor');
            const viewer = await actor('viewer');
            const outsider = await actor('outsider');
            const team = await native.api.createOrganization({
              body: { name: 'Fixture team', slug: crypto.randomUUID(), userId: owner.userId },
            });
            const other = await native.api.createOrganization({
              body: { name: 'Other team', slug: crypto.randomUUID(), userId: outsider.userId },
            });
            if (!team || !other) throw new Error('Fixture bootstrap failed');
            for (const [member, role] of [
              [editor, 'editor'],
              [viewer, 'viewer'],
            ] as const) {
              await db
                .prepare(
                  'INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, ?, ?)',
                )
                .bind(member.memberId, team.id, member.userId, role, Date.now())
                .run();
            }
            return HttpServerResponse.json({
              organizationId: team.id,
              otherOrganizationId: other.id,
              owner,
              editor,
              viewer,
              outsider,
            });
          }).pipe(Effect.flatten);
        }
        const web = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
        const payload = yield* Effect.promise(() => web.json());
        const { userId, organizationId } = Schema.decodeUnknownSync(
          Schema.Struct({ userId: Schema.String, organizationId: Schema.String }),
        )(payload);
        if (path === '/directory') {
          yield* database
            .prepare(
              'INSERT INTO diagramDirectory (organizationId, diagramId, name, updatedAt) VALUES (?, ?, ?, ?)',
            )
            .bind(organizationId, crypto.randomUUID(), userId, Date.now())
            .run();
          return HttpServerResponse.empty({ status: 204 });
        }
        if (path === '/expire-invitation') {
          yield* database
            .prepare('UPDATE invitation SET expiresAt = ? WHERE id = ? AND organizationId = ?')
            .bind(new Date(Date.now() - 1000).toISOString(), userId, organizationId)
            .run();
          return HttpServerResponse.empty({ status: 204 });
        }
        if (path === '/revoke') {
          yield* database
            .prepare('DELETE FROM member WHERE userId = ? AND organizationId = ?')
            .bind(userId, organizationId)
            .run();
          return HttpServerResponse.empty({ status: 204 });
        }
        if (path === '/expire') {
          yield* database
            .prepare('UPDATE session SET expiresAt = ? WHERE userId = ?')
            .bind(new Date(Date.now() - 1000).toISOString(), userId)
            .run();
          return HttpServerResponse.empty({ status: 204 });
        }
        if (path === '/downgrade') {
          yield* database
            .prepare("UPDATE member SET role = 'viewer' WHERE userId = ? AND organizationId = ?")
            .bind(userId, organizationId)
            .run();
          return HttpServerResponse.empty({ status: 204 });
        }
        return HttpServerResponse.empty({ status: 404 });
      }),
    };
  }).pipe(
    Effect.provide(AuthLive),
    Effect.provide(CloudflareD1(AuthDb)),
    Effect.provide(Cloudflare.D1.QueryDatabaseBinding),
  ),
) {}

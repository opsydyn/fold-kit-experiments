import { CloudflareD1 } from '@alchemy.run/better-auth/CloudflareD1';
import * as Cloudflare from '@alchemy.run/cloudflare';
import * as DomainCloudflare from '@alchemy.run/cloudflare/Domain';
import { isOperationRequest, parseGraph } from '@opsydyn/foldkit-zloz';
import {
  DiagramAccessDenied,
  makeDiagramDomain,
} from '@opsydyn/foldkit-zloz-alchemy/collaboration';
import { RuntimeContext } from 'alchemy';
import { Clock, Config, Effect, Layer, Redacted, Result, Schema } from 'effect';
import { HttpServerRequest, HttpServerResponse } from 'effect/http';

import { Auth, AuthLive } from '../src/auth';
import { AuthDb } from '../src/database';
import { epochSql } from '../src/date-sql';
import { bodyText } from '../src/http-body';

function fixtureResult<A, E extends { readonly _tag: string }>(result: Result.Result<A, E>) {
  return result._tag === 'Success'
    ? { _tag: 'Success', success: result.success }
    : { _tag: 'Failure', failure: { _tag: result.failure._tag } };
}

const Input = Schema.Struct({
  target: Schema.Struct({ teamId: Schema.String, diagramId: Schema.String }),
  operationId: Schema.optional(Schema.String),
  graph: Schema.optional(Schema.Unknown),
  request: Schema.optional(Schema.Unknown),
});

/** Test topology only: no public graph writer is added to the application. */
export default class OperationsWorker extends Cloudflare.Worker<OperationsWorker>()(
  'ZlozOperationsFixture',
  {
    main: import.meta.url,
    workersDev: false,
    compatibility: { date: '2026-11-11', flags: ['nodejs_compat'] },
    dev: { port: Config.Number('ZLOZ_OPERATIONS_PORT'), strictPort: true },
  },
  Effect.gen(function* () {
    const auth = yield* Auth;
    const database = yield* Cloudflare.D1.QueryDatabase(AuthDb);
    const key = yield* Config.Redacted('ZLOZ_FIXTURE_KEY');
    const domain = makeDiagramDomain({
      // Mirror the production host's current membership/session boundary using real D1.
      authorize: (actor, target, edit) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          const member = yield* database
            .prepare(`SELECT member.role FROM member JOIN session ON session.userId = member.userId
        WHERE session.id = ? AND session.userId = ? AND ${epochSql('session.expiresAt')} > ? AND member.organizationId = ?`)
            .bind(actor.sessionId, actor.userId, now, target.teamId)
            .first<{ role: string }>()
            .pipe(Effect.provide(RuntimeContext.phantom));
          if (
            !member ||
            !['owner', 'editor', 'viewer'].includes(member.role) ||
            (edit && member.role === 'viewer')
          )
            return yield* new DiagramAccessDenied();
        }),
      policy: () => ({}),
    });
    const service = yield* domain.runtime.pipe(
      Effect.provide(
        domain.model.layer(Layer.empty).pipe(Layer.provide(DomainCloudflare.layerDurableObjects())),
      ),
    );
    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        if (request.headers.authorization !== `Bearer ${Redacted.value(key)}`)
          return HttpServerResponse.empty({ status: 403 });
        if (request.method !== 'POST') return HttpServerResponse.empty({ status: 405 });
        const web = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
        const native = yield* auth.auth;
        const session = yield* Effect.promise(() =>
          native.api.getSession({ headers: web.headers }),
        );
        if (!session) return HttpServerResponse.empty({ status: 401 });
        const actor = { userId: session.user.id, sessionId: session.session.id };
        const input = Schema.decodeUnknownSync(Schema.fromJsonString(Input))(
          yield* Effect.promise(() => bodyText(web)),
        );
        const path = new URL(web.url).pathname;
        if (path === '/initialize') {
          const graph = parseGraph(JSON.stringify({ version: 1, graph: input.graph }));
          const result = yield* Effect.result(
            service.initialize(actor, input.target, input.operationId ?? '', graph),
          );
          return yield* HttpServerResponse.json(fixtureResult(result), {
            status: result._tag === 'Success' ? 200 : 403,
          });
        }
        if (path === '/execute') {
          if (!isOperationRequest(input.request)) return HttpServerResponse.empty({ status: 400 });
          const fault = new URL(web.url).searchParams.get('fault');
          if (fault === 'before-commit') return HttpServerResponse.empty({ status: 503 });
          const result = yield* Effect.result(service.execute(actor, input.target, input.request));
          if (fault === 'after-commit' && result._tag === 'Success')
            return HttpServerResponse.empty({ status: 503 });
          const status =
            result._tag === 'Success'
              ? 200
              : result.failure._tag === 'OperationIdReused'
                ? 409
                : 403;
          return yield* HttpServerResponse.json(fixtureResult(result), { status });
        }
        if (path === '/read') {
          const result = yield* Effect.result(service.read(actor, input.target));
          return yield* HttpServerResponse.json(fixtureResult(result), {
            status: result._tag === 'Success' ? 200 : 403,
          });
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

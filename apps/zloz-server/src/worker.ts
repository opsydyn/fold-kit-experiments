import { CloudflareD1 } from '@alchemy.run/better-auth/CloudflareD1';
import * as Cloudflare from '@alchemy.run/cloudflare';
import * as DomainCloudflare from '@alchemy.run/cloudflare/Domain';
import { canonicalOperationValue, serializeGraph } from '@opsydyn/foldkit-zloz';
import {
  DiagramAccessDenied,
  makeDiagramDomain,
} from '@opsydyn/foldkit-zloz-alchemy/collaboration';
import { RuntimeContext } from 'alchemy';
import { Clock, Config, Effect, Layer, Redacted, Schema, type Result } from 'effect';
import { HttpServerResponse, HttpServerRequest as HttpRequest } from 'effect/http';
import { HttpServerRequest } from 'effect/http/HttpServerRequest';

import { Auth, AuthLive } from './auth';
import { AuthDb } from './database';
import { epochSql } from './date-sql';
import { deltaRead } from './delta-read';
import { diagramHttpResponse } from './diagram-response';
import { handleDiagramRequest } from './diagram-routes';
import { leaseLiveRead } from './live-lease';
import { DiagramPresence } from './presence';
import {
  AccessDenied,
  CurrentActor,
  qualification,
  Session,
  type AccessPolicy,
} from './qualification';
import { stagingBootstrapRequest } from './staging-bootstrap';
import { handleTeamRequest } from './team-routes';

const sessionLayer = (access: AccessPolicy) =>
  Layer.effect(
    Session,
    Effect.gen(function* () {
      const auth = yield* Auth;
      return (effect, { headers, rpc, payload }) =>
        Effect.gen(function* () {
          const session = yield* auth
            .getSession(new Headers(Object.entries(headers)))
            .pipe(Effect.orDie);
          if (session === null) return yield* new AccessDenied();
          const actor = {
            userId: session.user.id,
            sessionId: session.session.id,
          };
          const edit = rpc._tag === 'RenameProbe';
          const organizationId = yield* (
            edit
              ? Schema.decodeUnknownEffect(Schema.Struct({ target: Schema.String }))(payload).pipe(
                  Effect.map((value) => value.target),
                )
              : Schema.decodeUnknownEffect(Schema.Struct({ key: Schema.String }))(payload).pipe(
                  Effect.map((value) => value.key),
                )
          ).pipe(Effect.mapError(() => new AccessDenied()));
          // Runs before Domain can return a deduplicated command receipt. The
          // aggregate/read validator also rechecks at each decision or live delivery.
          yield* access.check(actor, organizationId, edit);
          return yield* effect.pipe(Effect.provideService(CurrentActor, actor));
        }).pipe(Effect.provide(RuntimeContext.phantom));
    }),
  );

/** ADR 0036: app-private backend; no workers.dev route or production resource adoption. */
export default class ZlozServer extends Cloudflare.Worker<ZlozServer>()(
  'ZlozTeamServer',
  {
    main: import.meta.url,
    workersDev: false,
    dev: {
      port: Config.Number('ZLOZ_BACKEND_PORT').pipe(Config.withDefault(1337)),
      strictPort: true,
    },
    compatibility: { date: '2026-11-11', flags: ['nodejs_compat'] },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true },
      traces: { enabled: true },
    },
  },
  Effect.gen(function* () {
    const auth = yield* Auth;
    const origin = yield* Config.String('ZLOZ_ORIGIN');
    const qualificationProbe = yield* Config.Boolean('ZLOZ_QUALIFICATION_PROBE').pipe(
      Config.withDefault(false),
    );
    const operatorToken = yield* Config.Redacted('ZLOZ_OPERATOR_TOKEN').pipe(
      Config.withDefault(Redacted.make('')),
    );
    const stagingBootstrap = yield* Config.Boolean('ZLOZ_STAGING_BOOTSTRAP').pipe(
      Config.withDefault(false),
    );
    const database = yield* Cloudflare.D1.QueryDatabase(AuthDb);
    const access: AccessPolicy = {
      check: (actor, organizationId, edit) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          const membership = yield* database
            .prepare(`
        SELECT member.role FROM member
        JOIN session ON session.userId = member.userId
        WHERE session.id = ? AND session.userId = ?
          AND ${epochSql('session.expiresAt')} > ? AND member.organizationId = ?
      `)
            .bind(actor.sessionId, actor.userId, now, organizationId)
            .first<{ role: string }>()
            .pipe(Effect.provide(RuntimeContext.phantom));
          if (membership === null || !['owner', 'editor', 'viewer'].includes(membership.role))
            return yield* new AccessDenied();
          if (edit && membership.role === 'viewer') return yield* new AccessDenied();
        }),
    };
    const domain = makeDiagramDomain({
      authorize: (actor, target, edit) =>
        access
          .check(actor, target.teamId, edit)
          .pipe(Effect.mapError(() => new DiagramAccessDenied())),
      authorizeRecovery: (actor, target) =>
        Effect.gen(function* () {
          yield* access
            .check(actor, target.teamId, true)
            .pipe(Effect.mapError(() => new DiagramAccessDenied()));
          const membership = yield* database
            .prepare('SELECT role FROM member WHERE organizationId = ? AND userId = ?')
            .bind(target.teamId, actor.userId)
            .first<{ role: string }>()
            .pipe(Effect.provide(RuntimeContext.phantom));
          if (membership?.role !== 'owner') return yield* new DiagramAccessDenied();
        }),
      recoveryPolicy: (_actor, _target, graph) =>
        graph.nodes.length > 250 ||
        graph.edges.length > 500 ||
        new TextEncoder().encode(serializeGraph(graph)).byteLength > 1_048_576
          ? 'Recovery exceeds diagram limits'
          : null,
      policy: () => ({
        canApplyOperation: (_operation, _graph, _scope, _change, candidate) => {
          if (candidate.nodes.length > 250 || candidate.edges.length > 500)
            return 'Diagram limit: 250 nodes and 500 edges';
          return new TextEncoder().encode(serializeGraph(candidate)).byteLength > 1_048_576
            ? 'Diagram limit: 1 MiB of authored graph data'
            : null;
        },
      }),
    });
    const diagram = yield* Effect.gen(function* () {
      const runtime = yield* domain.runtime;
      const api = yield* domain.api;
      const deltaApi = yield* domain.deltaApi;
      return { runtime, api, deltaApi };
    }).pipe(
      Effect.provide(
        domain
          .sessionLayer((headers) =>
            auth.getSession(headers).pipe(
              Effect.mapError(() => new DiagramAccessDenied()),
              Effect.flatMap((session) =>
                session
                  ? Effect.succeed({ userId: session.user.id, sessionId: session.session.id })
                  : Effect.fail(new DiagramAccessDenied()),
              ),
              Effect.provide(RuntimeContext.phantom),
            ),
          )
          .pipe(
            Layer.provideMerge(domain.model.layer(Layer.empty)),
            Layer.provide(DomainCloudflare.layerDurableObjects()),
          ),
      ),
    );
    const presence = yield* DiagramPresence;
    const probe = qualification(access);
    const qualificationApi = probe.api.pipe(
      Effect.provide(
        sessionLayer(access).pipe(
          Layer.provideMerge(AuthLive),
          Layer.provideMerge(probe.model.layer(Layer.empty)),
          Layer.provide(DomainCloudflare.layerDurableObjects()),
        ),
      ),
    );
    const api = qualificationProbe ? yield* qualificationApi : null;
    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest;
        const url = new URL(request.url, origin);
        if (
          url.pathname === '/internal/bootstrap' ||
          url.pathname === '/api/zloz/operator/bootstrap'
        ) {
          const original = yield* HttpRequest.toWeb(request).pipe(Effect.orDie);
          const web =
            url.pathname === '/internal/bootstrap'
              ? original
              : stagingBootstrapRequest(original, origin, stagingBootstrap);
          if (web === null) return HttpServerResponse.empty({ status: 404 });
          const native = yield* auth.auth;
          const db = yield* database.raw;
          return HttpServerResponse.fromWeb(
            yield* Effect.promise(() =>
              handleTeamRequest(web, db, native, origin, Redacted.value(operatorToken)),
            ),
          );
        }
        const originHeader = request.headers.origin;
        if ((request.method !== 'GET' && request.method !== 'HEAD') || request.headers.upgrade) {
          if (originHeader !== origin) return HttpServerResponse.empty({ status: 403 });
        }
        if (url.pathname === '/api/auth/organization/delete')
          return HttpServerResponse.empty({ status: 403 });
        if (url.pathname.startsWith('/api/auth/')) return yield* auth.fetch;
        if (url.pathname === '/api/zloz/live') {
          const read = deltaRead(url);
          if (read.kind === 'invalid') return HttpServerResponse.empty({ status: 400 });
          if (read.kind === 'delta') {
            if (request.method !== 'GET' || !request.headers.upgrade)
              return HttpServerResponse.empty({ status: 400 });
            const session = yield* auth.getSession().pipe(Effect.orDie);
            if (!session) return HttpServerResponse.empty({ status: 401 });
            const allowed = yield* access
              .check(
                { userId: session.user.id, sessionId: session.session.id },
                read.target.teamId,
                false,
              )
              .pipe(Effect.result);
            if (allowed._tag === 'Failure') return HttpServerResponse.empty({ status: 403 });
            return yield* diagram.deltaApi.fetch.pipe(Effect.flatMap(leaseLiveRead));
          }
          return yield* diagram.api.fetch.pipe(Effect.flatMap(leaseLiveRead));
        }
        if (url.pathname.startsWith('/api/zloz/diagrams/')) {
          const timing: string[] = [];
          let phaseStart = performance.now();
          const trace = qualificationProbe
            ? (phase: string) => {
                const now = performance.now();
                timing.push(`${phase};dur=${(now - phaseStart).toFixed(1)}`);
                phaseStart = now;
              }
            : undefined;
          const execution = yield* Cloudflare.WorkerExecutionContext;
          const web = yield* HttpRequest.toWeb(request).pipe(Effect.orDie);
          const native = yield* auth.auth;
          const db = yield* database.raw;
          // Project typed Effect failures before the native Promise boundary so an
          // authorization refusal cannot become an opaque successful HTTP result.
          const unwrap = <A, E>(result: Result.Result<A, E>): A => {
            if (result._tag === 'Failure') throw result.failure;
            return result.success;
          };
          const response = yield* Effect.promise(() =>
            handleDiagramRequest(
              web,
              db,
              native,
              {
                bootstrap: (...args) =>
                  Effect.runPromise(diagram.runtime.bootstrap(...args).pipe(Effect.result)).then(
                    unwrap,
                  ),
                saveAssessment: (...args) =>
                  Effect.runPromise(
                    diagram.runtime.saveAssessment(...args).pipe(Effect.result),
                  ).then(unwrap),
                defer: (work) => execution.raw.waitUntil(work),
                checkpoint: (...args) =>
                  Effect.runPromise(diagram.runtime.checkpoint(...args).pipe(Effect.result)).then(
                    unwrap,
                  ),
                recover: (...args) =>
                  Effect.runPromise(diagram.runtime.recover(...args).pipe(Effect.result)).then(
                    unwrap,
                  ),
                graph: (...args) =>
                  Effect.runPromise(
                    diagram.runtime.read(...args).pipe(
                      Effect.map((document) => document?.graph ?? null),
                      Effect.result,
                    ),
                  ).then(unwrap),
                initialize: (...args) =>
                  Effect.runPromise(diagram.runtime.initialize(...args).pipe(Effect.result)).then(
                    unwrap,
                  ),
                execute: (...args) =>
                  Effect.runPromise(diagram.runtime.execute(...args).pipe(Effect.result)).then(
                    unwrap,
                  ),
                frame: (...args) =>
                  Effect.runPromise(diagram.runtime.frame(...args).pipe(Effect.result)).then(
                    unwrap,
                  ),
                heartbeat: (target, peer) =>
                  Effect.runPromise(
                    presence
                      .getByName(canonicalOperationValue([target.teamId, target.diagramId]))
                      .heartbeat(peer)
                      .pipe(Effect.provide(RuntimeContext.phantom)),
                  ),
              },
              trace,
            ),
          );
          if (trace) response.headers.set('server-timing', timing.join(', '));
          return diagramHttpResponse(response);
        }
        if (
          url.pathname.startsWith('/api/zloz/teams/') ||
          url.pathname.startsWith('/api/zloz/invitations/')
        ) {
          const web = yield* HttpRequest.toWeb(request).pipe(Effect.orDie);
          const native = yield* auth.auth;
          const db = yield* database.raw;
          return HttpServerResponse.fromWeb(
            yield* Effect.promise(() => handleTeamRequest(web, db, native, origin, '')),
          );
        }
        if (url.pathname === '/api/zloz/capabilities') {
          const native = yield* auth.auth;
          return yield* HttpServerResponse.json({
            google: native.options.socialProviders.google !== undefined,
          });
        }
        if (url.pathname === '/api/zloz/session') {
          const session = yield* auth.getSession().pipe(Effect.orDie);
          return yield* HttpServerResponse.json(
            session === null
              ? null
              : {
                  user: { id: session.user.id, name: session.user.name, email: session.user.email },
                },
            { headers: { 'cache-control': 'private, no-store' } },
          );
        }
        if (api && url.pathname === '/api/zloz/domain')
          return yield* api.fetch.pipe(Effect.flatMap(leaseLiveRead));
        return HttpServerResponse.empty({ status: 404 });
      }).pipe(Effect.map(HttpServerResponse.setHeader('cache-control', 'private, no-store'))),
    };
  }).pipe(
    Effect.provide(AuthLive),
    Effect.provide(CloudflareD1(AuthDb)),
    Effect.provide(Cloudflare.D1.QueryDatabaseBinding),
  ),
) {}

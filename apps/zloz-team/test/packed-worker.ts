import * as Cloudflare from '@alchemy.run/cloudflare';
import * as DomainCloudflare from '@alchemy.run/cloudflare/Domain';
import { parseGraph, parseOperationRequest } from '@opsydyn/foldkit-zloz';
import { parseAssessmentRequest } from '@opsydyn/foldkit-zloz-alchemy/assessment';
import { createDiagramCheckpoint } from '@opsydyn/foldkit-zloz-alchemy/checkpoint';
import {
  DiagramAccessDenied,
  makeDiagramDomain,
} from '@opsydyn/foldkit-zloz-alchemy/collaboration';
import { Config, Effect, Layer, Redacted } from 'effect';
import { HttpServerRequest, HttpServerResponse } from 'effect/http';

/** Copied into an isolated tarball consumer; never imported by an application stack. */
export default class PackedWorker extends Cloudflare.Worker<PackedWorker>()(
  'ZlozPackedConsumer',
  {
    main: import.meta.url,
    workersDev: false,
    dev: { port: Config.Number('ZLOZ_PACKED_PORT'), strictPort: true },
    compatibility: { date: '2026-11-11', flags: ['nodejs_compat'] },
  },
  Effect.gen(function* () {
    const key = yield* Config.Redacted('ZLOZ_PACKED_KEY');
    const target = { teamId: 'packed-team', diagramId: 'packed-diagram' };
    const actor = { userId: 'packed-owner', sessionId: 'synthetic-session' };
    const authorize = (candidate: typeof actor, scope: typeof target) =>
      candidate.userId === actor.userId &&
      scope.teamId === target.teamId &&
      scope.diagramId === target.diagramId
        ? Effect.void
        : Effect.fail(new DiagramAccessDenied());
    const domain = makeDiagramDomain({ authorize, authorizeRecovery: authorize });
    const runtime = yield* domain.runtime.pipe(
      Effect.provide(
        domain.model.layer(Layer.empty).pipe(Layer.provide(DomainCloudflare.layerDurableObjects())),
      ),
    );
    const graph = parseGraph(
      '{"version":1,"graph":{"nodes":[{"id":"n","label":"Packed original","position":{"x":0,"y":0},"size":{"width":100,"height":80},"ports":[{"id":"out","kind":"output","side":"right","offset":0.5}]},{"id":"m","label":"Peer","position":{"x":200,"y":0},"size":{"width":100,"height":80},"ports":[{"id":"in","kind":"input","side":"left","offset":0.5}]}],"edges":[{"id":"ab","source":{"node":"n","port":"out"},"target":{"node":"m","port":"in"}}]}}',
    );
    const assessmentRequest = parseAssessmentRequest(
      '{"version":1,"operationId":"packed-assessment","expectedRevision":0,"assessment":{"format":"foldkit-zloz-coupling","version":1,"modelVersion":"balanced-coupling-binary/v1","target":{"documentId":"packed-diagram","graphVersion":0,"relationshipId":"ab","sourceNodeId":"n","targetNodeId":"m"},"scope":{"abstraction":"Bounded contexts","horizon":"Next six months"},"inputs":{"integrationType":{"status":"known","value":"model","basis":"observed","rationale":"Shared order schema"},"strength":{"status":"known","value":"high","basis":"declared","rationale":"Changes require joint releases"},"distance":{"status":"known","value":"high","basis":"declared","rationale":"Separate teams and release cadence"},"volatility":{"status":"unknown","reason":"Roadmap review pending"}}}}',
    );
    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        if (request.headers.authorization !== `Bearer ${Redacted.value(key)}`)
          return HttpServerResponse.empty({ status: 403 });
        if (request.method === 'POST') {
          yield* runtime.initialize(actor, target, 'packed-init', graph);
          const authored = yield* runtime.saveAssessment(actor, target, assessmentRequest);
          if (authored.decision.status !== 'accepted')
            return HttpServerResponse.empty({ status: 500 });
          const checkpoint = yield* Effect.promise(() => createDiagramCheckpoint(target, 0, graph));
          const changed = yield* runtime.execute(
            actor,
            target,
            parseOperationRequest(
              '{"version":1,"operationId":"packed-rename","operation":{"type":"RenameNode","id":"n","expected":0,"label":"Changed"}}',
            ),
          );
          if (changed.receipt.status !== 'accepted')
            return HttpServerResponse.empty({ status: 500 });
          const restored = yield* runtime.recover(actor, target, 'packed-restore', 1, checkpoint);
          const retry = yield* runtime.recover(actor, target, 'packed-restore', 1, checkpoint);
          if (restored.status !== 'restored' || retry.documentVersion !== 2)
            return HttpServerResponse.empty({ status: 500 });
        }
        const document = yield* runtime.read(actor, target);
        const retried = document
          ? yield* runtime.saveAssessment(actor, target, assessmentRequest)
          : null;
        const assessmentRevision =
          retried?.decision.status === 'accepted' ? retried.decision.record.revision : null;
        return yield* HttpServerResponse.json({
          assessmentRevision,
          version: document?.version ?? null,
          label: document?.graph.nodes[0]?.label ?? null,
        });
      }).pipe(Effect.orDie),
    };
  }),
) {}

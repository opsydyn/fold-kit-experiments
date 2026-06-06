import type { APIRoute } from 'astro';
import { DateTime, Duration, Effect, Schema } from 'effect';

const HealthResponseSchema = Schema.Struct({
  status: Schema.Literal('ok'),
  uptimeSeconds: Schema.Number,
  startedAt: Schema.String,
  timestamp: Schema.String,
});

type HealthResponse = Schema.Schema.Type<typeof HealthResponseSchema>;

const HealthResponseJson = Schema.fromJsonString(HealthResponseSchema);

const encodeHealthResponse = Schema.encodeSync(HealthResponseJson);

const startedAt = Effect.runSync(DateTime.now);

const toHealthResponse = (startedAt: DateTime.Utc, now: DateTime.Utc): HealthResponse => ({
  status: 'ok',
  uptimeSeconds: Duration.toSeconds(DateTime.distance(startedAt, now)),
  startedAt: DateTime.formatIso(startedAt),
  timestamp: DateTime.formatIso(now),
});

const json = (body: HealthResponse): Response =>
  new Response(encodeHealthResponse(body), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

const program = Effect.gen(function* () {
  const now = yield* DateTime.now;

  return json(toHealthResponse(startedAt, now));
});

export const GET = (() => Effect.runSync(program)) satisfies APIRoute;

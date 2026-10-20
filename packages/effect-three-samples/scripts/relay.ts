/**
 * Runs the editor's relay until interrupted: `bun run relay` (port 4325 on every
 * interface), or `PORT` and `HOST` to choose. See `src/relay/relay.ts`.
 */
import { Effect } from 'effect';

import { serveRelay } from '../src/relay/relay';

const port = Number(process.env['PORT'] ?? 4325);
const hostname = process.env['HOST'] ?? '0.0.0.0';

const relay = Effect.gen(function* () {
  const server = yield* serveRelay({ port, hostname });
  yield* Effect.log(`Relay on ws://${server.hostname}:${server.port}/<room>`);
  // Until the process is asked to stop: the scope then closes the relay and its sockets.
  yield* Effect.callback<void>((resume) => {
    const stop = () => resume(Effect.void);
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
  yield* Effect.log('Relay stopped');
});

relay.pipe(Effect.scoped, Effect.runFork);

import { Effect } from 'effect';

// oxlint-disable-next-line linteffect/no-effect-wrapper-alias -- Own the handshake listeners through success, failure, and cancellation.
export function waitForRelayOpen(socket: WebSocket, url: string, milliseconds: number) {
  const ready = Effect.callback<void, string>((resume) => {
    const opened = () => {
      cleanup();
      resume(Effect.void);
    };
    const refused = () => {
      cleanup();
      resume(Effect.fail(`No relay at ${url}`));
    };
    const timeout = setTimeout(refused, milliseconds);
    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeEventListener('open', opened);
      socket.removeEventListener('error', refused);
      socket.removeEventListener('close', refused);
    };
    socket.addEventListener('open', opened);
    socket.addEventListener('error', refused);
    socket.addEventListener('close', refused);
    return Effect.sync(cleanup);
  });
  return ready.pipe(Effect.withSpan('effect-three.relay.connect'));
}

import { expect, test } from 'bun:test';

import { isScopeEjected } from 'alchemy/Http';
import { Effect, Exit, Scope } from 'effect';
import { HttpEffect, HttpServerResponse } from 'effect/http';

import { diagramHttpResponse } from '../src/diagram-response';

test('finite diagram body and headers reach the client while request cleanup remains held', async () => {
  const gate = Promise.withResolvers<void>();
  const cleanupStarted = Promise.withResolvers<void>();
  const scope = Scope.makeUnsafe();
  const background: Promise<void>[] = [];
  await Effect.runPromise(
    Effect.addFinalizer(() =>
      Effect.promise(async () => {
        cleanupStarted.resolve();
        await gate.promise;
      }),
    ).pipe(Effect.provideService(Scope.Scope, scope)),
  );
  const headers = new Headers({
    'content-type': 'application/json',
    'x-diagram-proof': 'retained',
  });
  headers.append('set-cookie', 'first=synthetic; HttpOnly');
  headers.append('set-cookie', 'second=synthetic; Secure');
  const native = new Response('{"committed":true}', { status: 201, headers });
  // Exercise the installed Effect stream-scope transfer used by Alchemy's native HTTP bridge.
  const response = await Effect.runPromise(
    Effect.sync(() => HttpEffect.scopeTransferToStream(diagramHttpResponse(native))).pipe(
      Effect.provideService(Scope.Scope, scope),
    ),
  );
  const web = HttpServerResponse.toWeb(
    HttpServerResponse.setHeader(response, 'cache-control', 'private, no-store'),
  );
  const body = web.text();
  // Match the installed Worker bridge: non-ejected request cleanup is owned by waitUntil.
  if (!isScopeEjected(scope)) background.push(Effect.runPromise(Scope.close(scope, Exit.void)));
  // oxlint-disable-next-line linteffect/no-try-catch -- A held native finalizer must be released even on failed assertions.
  try {
    const outcome = await Promise.race([
      body.then((body) => ({ _tag: 'Body' as const, body })),
      Bun.sleep(100).then(() => ({ _tag: 'Timeout' as const })),
    ]);
    expect(outcome).toEqual({ _tag: 'Body', body: '{"committed":true}' });
    await cleanupStarted.promise;
    expect(background).toHaveLength(1);
    expect(web.status).toBe(201);
    expect(web.headers.get('x-diagram-proof')).toBe('retained');
    expect(web.headers.get('cache-control')).toBe('private, no-store');
    expect(web.headers.getSetCookie()).toEqual([
      'first=synthetic; HttpOnly',
      'second=synthetic; Secure',
    ]);
  } finally {
    gate.resolve();
    await body;
    await Promise.all(background);
    await Effect.runPromise(Scope.close(scope, Exit.void));
  }
});

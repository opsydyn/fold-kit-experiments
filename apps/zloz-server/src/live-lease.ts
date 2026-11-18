/// <reference types="@cloudflare/workers-types" />
import * as Cloudflare from '@alchemy.run/cloudflare';
import { Effect } from 'effect';
import { HttpServerResponse } from 'effect/http';

/** Idle sockets reconnect through current auth within the proposed 30-second bound. */
export function leaseLiveRead(response: HttpServerResponse.HttpServerResponse) {
  return Effect.gen(function* () {
    const body = response.body;
    if (response.status !== 101 || body._tag !== 'Raw' || !(body.body instanceof Response))
      return response;
    const upstream = body.body.webSocket;
    if (!upstream) return response;
    const pair = new WebSocketPair();
    const client = pair[0];
    const downstream = pair[1];
    upstream.accept();
    downstream.accept();
    const finished = new Promise<void>((resolve) => {
      let closed = false;
      const close = (code: number, reason: string) => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        upstream.close(code, reason);
        downstream.close(code, reason);
        resolve();
      };
      const timer = setTimeout(() => close(1000, 'Authorization lease ended; reconnect'), 25_000);
      upstream.addEventListener('message', (event) => downstream.send(event.data));
      downstream.addEventListener('message', (event) => upstream.send(event.data));
      upstream.addEventListener('close', () => close(1000, 'Upstream closed'));
      downstream.addEventListener('close', () => close(1000, 'Client closed'));
      upstream.addEventListener('error', () => close(1011, 'Live read failed'));
      downstream.addEventListener('error', () => close(1011, 'Live read failed'));
    });
    yield* Cloudflare.waitUntil(Effect.promise(() => finished));
    const init = { status: 101, webSocket: client };
    return HttpServerResponse.raw(new Response(null, init), { status: 101 });
  });
}

// @vitest-environment node
import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { startAgentTestServer } from './http.test-helper';
import { createFixtureResponse, serveAgentAnalysis, type ResponseObservation } from './response';

const input = { runId: 'run-1', threadId: 'agent-analysis', scenario: 'normal' } as const;
const payload = {
  runId: 'run-1',
  threadId: 'agent-analysis',
  messages: [],
  tools: [],
  context: [],
  state: { services: [] },
  forwardedProps: { scenario: 'normal' },
};
const request = (body: string, headers?: HeadersInit) =>
  new Request('http://localhost/api/agent-analysis', {
    method: 'POST',
    body,
    headers,
  });
const disposed = (observations: ReadonlyArray<ResponseObservation>) =>
  observations.filter((item) => item._tag === 'Disposed');

function streamedRequest(body: ReadableStream<Uint8Array>, signal?: AbortSignal): Request {
  // Node requires duplex for streamed request bodies; keep its extension local to tests.
  const init: RequestInit & { duplex: 'half' } = { method: 'POST', body, signal, duplex: 'half' };
  return new Request('http://localhost', init);
}

afterEach(() => vi.useRealTimers());

describe('bounded request validation', () => {
  it.each([
    '{',
    '{}',
    JSON.stringify({ ...payload, messages: 'wrong' }),
    JSON.stringify({ ...payload, threadId: 'other' }),
    JSON.stringify({ ...payload, forwardedProps: { scenario: 'other' } }),
    JSON.stringify({ ...payload, forwardedProps: {} }),
  ])('returns 400 without allocating a producer for %s', async (body) => {
    vi.useFakeTimers();
    const observations: ResponseObservation[] = [];
    const response = await Effect.runPromise(
      serveAgentAnalysis(request(body), (item) => observations.push(item)),
    );
    expect(response.status).toBe(400);
    await vi.advanceTimersByTimeAsync(100000);
    expect(observations).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([undefined, '1', '16384', '999999'])(
    'counts actual bytes independently of Content-Length %s',
    async (length) => {
      vi.useFakeTimers();
      const observations: ResponseObservation[] = [];
      const headers = new Headers();
      if (length) headers.set('Content-Length', length);
      const response = await Effect.runPromise(
        serveAgentAnalysis(request(' '.repeat(16385), headers), (item) => observations.push(item)),
      );
      expect(response.status).toBe(413);
      await vi.advanceTimersByTimeAsync(100000);
      expect(observations).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('bounds chunked UTF-8 bytes and cancels unread input on overflow', async () => {
    let cancelled = 0;
    const observations: ResponseObservation[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(' '.repeat(16383)));
        controller.enqueue(new TextEncoder().encode('é'));
      },
      cancel() {
        cancelled++;
      },
    });
    const incoming = streamedRequest(body);
    const response = await Effect.runPromise(
      serveAgentAnalysis(incoming, (item) => observations.push(item)),
    );
    expect(response.status).toBe(413);
    expect(cancelled).toBe(1);
    expect(observations).toEqual([]);
  });

  it('accepts exactly 16384 bytes even with a misleading oversized header', async () => {
    vi.useFakeTimers();
    const json = JSON.stringify(payload);
    const response = await Effect.runPromise(
      serveAgentAnalysis(request(json.padEnd(16384), { 'Content-Length': '999999' })),
    );
    expect(response.status).toBe(200);
    await response.body?.cancel();
  });

  it('preserves 413 when an oversized input source rejects cancellation', async () => {
    let cancellations = 0;
    const observations: ResponseObservation[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16385));
      },
      cancel() {
        cancellations++;
        return Promise.reject(new Error('source cancellation failed'));
      },
    });
    const incoming = streamedRequest(body);
    const response = await Effect.runPromise(
      serveAgentAnalysis(incoming, (item) => observations.push(item)),
    );
    expect(response.status).toBe(413);
    expect(cancellations).toBe(1);
    expect(observations).toEqual([]);
  });

  it('maps body read failure to 400 without starting a producer', async () => {
    const observations: ResponseObservation[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('disconnected'));
      },
    });
    const incoming = streamedRequest(body);
    expect(
      (await Effect.runPromise(serveAgentAnalysis(incoming, (item) => observations.push(item))))
        .status,
    ).toBe(400);
    expect(observations).toEqual([]);
  });

  it('aborts a pending body read without allocating a producer', async () => {
    const controller = new AbortController();
    let cancelled = 0;
    const observations: ResponseObservation[] = [];
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled++;
      },
    });
    const incoming = streamedRequest(body, controller.signal);
    const result = Effect.runPromise(
      serveAgentAnalysis(incoming, (item) => observations.push(item)),
    );
    controller.abort();
    expect((await result).status).toBe(400);
    expect(cancelled).toBe(1);
    expect(observations).toEqual([]);
  });
});

describe('request-owned SSE lifetime', () => {
  it('aborting after the snapshot clears every delayed event', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const observations: ResponseObservation[] = [];
    const response = createFixtureResponse(
      { ...input, scenario: 'slow' },
      controller.signal,
      (item) => observations.push(item),
    );
    await vi.advanceTimersByTimeAsync(650);
    expect(observations).toEqual([
      { _tag: 'Emitted', eventType: 'RUN_STARTED' },
      { _tag: 'Emitted', eventType: 'STATE_SNAPSHOT' },
    ]);
    controller.abort();
    await response.body?.cancel();
    const atDisposal = [...observations];
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(100000);
    expect(observations).toEqual(atDisposal);
    expect(disposed(observations)).toEqual([{ _tag: 'Disposed', cause: 'Aborted' }]);
  });

  it('keeps producing after the HTTP Effect returns with SSE/no-cache headers', async () => {
    vi.useFakeTimers();
    const observations: ResponseObservation[] = [];
    const response = await Effect.runPromise(
      serveAgentAnalysis(request(JSON.stringify(payload)), (item) => observations.push(item)),
    );
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toContain('no-cache');
    const text = response.text();
    await vi.advanceTimersByTimeAsync(20000);
    const wire = await text;
    expect(wire).toContain('data: {"type":"RUN_STARTED"');
    expect(wire).toContain('"path":"/services/0/latency","value":145');
    expect(wire).toContain('"type":"RUN_FINISHED"');
    expect(
      observations.filter((item) => item._tag === 'Emitted').map((item) => item.eventType),
    ).toEqual([
      'RUN_STARTED',
      'STATE_SNAPSHOT',
      'STATE_DELTA',
      'STATE_SNAPSHOT',
      'STATE_DELTA',
      'RUN_FINISHED',
    ]);
    expect(disposed(observations)).toEqual([{ _tag: 'Disposed', cause: 'Completed' }]);
  });

  it.each([
    'pre-abort',
    'abort-before-read',
    'cancel',
    'abort-and-cancel',
    'cancel-and-abort',
    'completed-then-cancel',
  ] as const)('disposes exactly once without later emission: %s', async (action) => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const observations: ResponseObservation[] = [];
    if (action === 'pre-abort') controller.abort();
    const response = createFixtureResponse(
      { ...input, scenario: 'slow' },
      controller.signal,
      (item) => observations.push(item),
    );
    if (action === 'completed-then-cancel') await vi.advanceTimersByTimeAsync(20000);
    if (action === 'abort-before-read' || action === 'abort-and-cancel') controller.abort();
    if (
      action === 'cancel' ||
      action === 'abort-and-cancel' ||
      action === 'cancel-and-abort' ||
      action === 'completed-then-cancel'
    )
      await response.body?.cancel();
    if (action === 'cancel-and-abort') controller.abort();
    const atDisposal = [...observations];
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(100000);
    expect(observations).toEqual(atDisposal);
    const cause =
      action === 'completed-then-cancel'
        ? 'Completed'
        : action === 'cancel' || action === 'cancel-and-abort'
          ? 'Cancelled'
          : 'Aborted';
    expect(disposed(observations)).toEqual([{ _tag: 'Disposed', cause }]);
  });

  it('cancelling one request does not cancel a concurrent producer', async () => {
    vi.useFakeTimers();
    const first: ResponseObservation[] = [];
    const second: ResponseObservation[] = [];
    const a = createFixtureResponse(input, new AbortController().signal, (item) =>
      first.push(item),
    );
    const b = createFixtureResponse(
      { ...input, runId: 'run-2' },
      new AbortController().signal,
      (item) => second.push(item),
    );
    await a.body?.cancel();
    const text = b.text();
    await vi.advanceTimersByTimeAsync(20000);
    expect(await text).toContain('"runId":"run-2"');
    expect(disposed(first)).toEqual([{ _tag: 'Disposed', cause: 'Cancelled' }]);
    expect(disposed(second)).toEqual([{ _tag: 'Disposed', cause: 'Completed' }]);
  });
});

describe('loopback HTTP adapter ownership', () => {
  it('rejects oversized HTTP bodies without recording a producer or hanging teardown', async () => {
    const server = await startAgentTestServer();
    try {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(' '.repeat(16385)));
        },
      });
      const init: RequestInit & { duplex: 'half' } = {
        method: 'POST',
        body,
        duplex: 'half',
        signal: AbortSignal.timeout(1000),
      };
      const response = await fetch(server.url, init);
      expect(response.status).toBe(413);
      expect(server.requests).toHaveLength(0);
    } finally {
      await server.close();
    }
  });

  it('streams real HTTP and maps client disconnect to exactly one disposal', async () => {
    const server = await startAgentTestServer();
    try {
      const controller = new AbortController();
      const response = await fetch(server.url, {
        method: 'POST',
        body: JSON.stringify({ ...payload, forwardedProps: { scenario: 'slow' } }),
        signal: controller.signal,
      });
      expect(response.status).toBe(200);
      const reader = response.body?.getReader();
      const first = await reader?.read();
      expect(new TextDecoder().decode(first?.value)).toContain('RUN_STARTED');
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]?.input).toEqual({ ...input, scenario: 'slow' });
      controller.abort();
      await reader?.cancel().catch(() => {});
      await vi.waitFor(() =>
        expect(disposed(server.requests[0]?.observations ?? [])).toHaveLength(1),
      );
    } finally {
      await server.close();
    }
  });

  it('owns records per server and teardown aborts active streams and closes its listener', async () => {
    const server = await startAgentTestServer();
    const other = await startAgentTestServer();
    try {
      const response = await fetch(server.url, { method: 'POST', body: JSON.stringify(payload) });
      await response.body?.getReader().read();
      expect(server.requests).toHaveLength(1);
      expect(other.requests).toHaveLength(0);
      await server.close();
      expect(disposed(server.requests[0]?.observations ?? [])).toHaveLength(1);
      await expect(fetch(server.url, { method: 'POST', body: '{}' })).rejects.toThrow();
    } finally {
      await server.close();
      await other.close();
    }
  });
});

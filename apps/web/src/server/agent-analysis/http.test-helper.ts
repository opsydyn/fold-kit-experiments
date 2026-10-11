import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';

import { RunAgentInputSchema } from '@ag-ui/core/schemas';
import { Effect, Schema } from 'effect';

import { Scenario } from '../../apps/agent-analysis/contract';
import type { FixtureInput } from './fixtures';
import { serveAgentAnalysis, type ResponseObservation } from './response';

export interface AgentTestRequest {
  readonly input: FixtureInput;
  readonly observations: ReadonlyArray<ResponseObservation>;
}
export interface AgentTestServer {
  readonly url: string;
  readonly requests: ReadonlyArray<AgentTestRequest>;
  readonly close: () => Promise<void>;
}

export async function startAgentTestServer(): Promise<AgentTestServer> {
  const requests: AgentTestRequest[] = [];
  const sockets = new Set<Socket>();
  const controllers = new Set<AbortController>();
  const tasks = new Set<Promise<void>>();
  const serve = async (incoming: IncomingMessage, outgoing: ServerResponse) => {
    const abortController = new AbortController();
    controllers.add(abortController);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const disconnected = () => {
      if (outgoing.writableFinished) return;
      abortController.abort();
      void reader?.cancel().catch(() => {});
    };
    incoming.on('aborted', disconnected);
    outgoing.on('close', disconnected);
    try {
      // Preserve chunk boundaries and backpressure without buffering before validation.
      const iterator = incoming.iterator({ destroyOnReturn: false });
      const decoder = new TextDecoder();
      const captured: string[] = [];
      let capturedBytes = 0;
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          const chunk = await iterator.next();
          if (chunk.done) controller.close();
          else {
            capturedBytes += chunk.value.byteLength;
            if (capturedBytes <= 16384)
              captured.push(decoder.decode(chunk.value, { stream: true }));
            controller.enqueue(chunk.value);
          }
        },
        async cancel() {
          await iterator.return?.();
        },
      });
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const init: RequestInit & { duplex: 'half' } = {
        method: incoming.method,
        headers,
        body,
        duplex: 'half',
        signal: abortController.signal,
      };
      const request = new Request('http://127.0.0.1/api/agent-analysis', init);
      const observations: ResponseObservation[] = [];
      // The helper, not production, owns request records; only successful requests are recorded.
      const response = await Effect.runPromise(
        serveAgentAnalysis(request, (item) => observations.push(item)),
      );
      if (response.ok) {
        const input = RunAgentInputSchema.parse(JSON.parse(captured.join('') + decoder.decode()));
        const { scenario } = Schema.decodeUnknownSync(Schema.Struct({ scenario: Scenario }))(
          input.forwardedProps,
        );
        requests.push({
          input: { runId: input.runId, threadId: input.threadId, scenario },
          observations,
        });
      }
      if (abortController.signal.aborted) {
        await response.body?.cancel();
        return;
      }
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.flushHeaders();
      reader = response.body?.getReader();
      if (reader) {
        while (!abortController.signal.aborted) {
          const chunk = await reader.read();
          if (chunk.done) break;
          if (!outgoing.write(chunk.value)) {
            await new Promise<void>((resolve) => {
              const ready = () => {
                outgoing.off('drain', ready);
                outgoing.off('close', ready);
                resolve();
              };
              outgoing.once('drain', ready);
              outgoing.once('close', ready);
            });
          }
        }
      }
      outgoing.end();
    } catch {
      abortController.abort();
      await reader?.cancel().catch(() => {});
      outgoing.destroy();
    } finally {
      reader?.releaseLock();
      controllers.delete(abortController);
      incoming.off('aborted', disconnected);
      outgoing.off('close', disconnected);
    }
  };
  const server = createServer((incoming, outgoing) => {
    const task = serve(incoming, outgoing);
    tasks.add(task);
    void task.finally(() => tasks.delete(task));
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = Schema.decodeUnknownSync(Schema.Struct({ port: Schema.Number }))(
    server.address(),
  );
  let closing: Promise<void> | undefined;
  const closeServer = async () => {
    const closed = new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    controllers.forEach((controller) => controller.abort());
    sockets.forEach((socket) => socket.destroy());
    await Promise.all([...tasks]);
    await closed;
    server.removeAllListeners();
  };
  return {
    url: `http://127.0.0.1:${address.port}/api/agent-analysis`,
    requests,
    close() {
      closing ??= closeServer();
      return closing;
    },
  };
}

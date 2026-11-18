import { expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';

import { parseGraph } from '@opsydyn/foldkit-zloz';
import type { ZlozGraph, ZlozOperationRequest } from '@opsydyn/foldkit-zloz';
import { isDiagramReply } from '@opsydyn/foldkit-zloz-alchemy/session';
import type { Page, BrowserContext, CDPSession } from 'playwright';

declare global {
  interface Window {
    __zlozM4Render: (payload: {
      version: number;
      labels: readonly string[];
      observedAt: number;
    }) => Promise<void>;
    __zlozC11LongTask: (entry: { start: number; duration: number }) => Promise<void>;
  }
}

interface RequestTiming {
  readonly serverTiming: string | null;
  readonly start: number;
  readonly headers: number;
  readonly decoded: number;
  readonly responseStart: number | null;
  readonly responseEnd: number | null;
}
interface LongTask {
  readonly peer: number;
  readonly start: number;
  readonly duration: number;
}
interface Sample {
  readonly index: number;
  readonly writer: number;
  readonly node: string;
  readonly label: string;
  start: number;
  accepted: boolean;
  submitted: boolean;
  documentVersion: number | null;
  requestTiming: RequestTiming | null;
  writerRenderedAt: number | null;
  controllerStartedAt: number;
  controllerReplyAt: number | null;
  controllerWriterAckAt: number | null;
  controllerReleasedAt: number | null;
  blockingIndex: number | null;
  readonly acknowledgements: Map<number, number>;
  allRenderedAt: number | null;
  failure: string | null;
  resolveOwn: () => void;
  resolveAll: () => void;
}
export interface LoadOptions {
  readonly pages: readonly Page[];
  readonly contexts: readonly BrowserContext[];
  readonly origin: string;
  readonly path: string;
  readonly graph: ZlozGraph;
  readonly output: string;
}
/** Writer completion and the independent all-peer latency observation. */
export async function completeLoadEdit(
  acknowledgeWriter: () => Promise<void>,
  observePeers: () => Promise<void>,
  releaseWriter: () => void,
): Promise<void> {
  try {
    await acknowledgeWriter();
  } finally {
    releaseWriter();
  }
  await observePeers();
}
/** Single originating browser clock; scheduling uses Node only to pace the declared workload. */
export async function qualifyFiveEditors(options: LoadOptions) {
  const { pages, contexts, origin, path, graph, output } = options;
  const master = pages[0]!;
  const clock = () => master.evaluate(() => performance.now());
  const samples: Sample[] = [];
  const byLabel = new Map<string, Sample>();
  const clocks = [0, 0, 0, 0, 0];
  const busy = [false, false, false, false, false];
  const active: (number | null)[] = [null, null, null, null, null];
  const longTasks: LongTask[] = [];
  const controllerStalls: { at: number; duration: number }[] = [];
  let lastTick = performance.now();
  const tick = setInterval(() => {
    const now = performance.now();
    if (now - lastTick > 100) controllerStalls.push({ at: lastTick, duration: now - lastTick });
    lastTick = now;
  }, 25);
  const tasks: Promise<void>[] = [];
  const cpuSessions: CDPSession[] = [];
  const cpuProfiles: string[] = [];
  const wanted = new Map(graph.nodes.map((node) => [node.id, node.label]));
  try {
    for (const [peer, page] of pages.entries()) {
      await page.exposeBinding(
        '__zlozC11LongTask',
        (_source, entry: { start: number; duration: number }) => {
          longTasks.push({ peer, ...entry });
        },
      );
      await page.exposeBinding(
        '__zlozM4Render',
        async (
          _source,
          payload: { version: number; labels: readonly string[]; observedAt: number },
        ) => {
          for (const label of payload.labels) {
            const sample = byLabel.get(label);
            if (!sample) continue;
            sample.acknowledgements.set(peer, payload.version);
            if (peer === sample.writer && sample.writerRenderedAt === null) {
              sample.writerRenderedAt = payload.observedAt;
              sample.controllerWriterAckAt = performance.now();
            }
            if (sample.documentVersion !== null && payload.version >= sample.documentVersion) {
              if (peer === sample.writer) sample.resolveOwn();
              if (
                sample.acknowledgements.size === 5 &&
                sample.allRenderedAt === null &&
                [...sample.acknowledgements.values()].every(
                  (version) => version >= sample.documentVersion!,
                )
              ) {
                sample.allRenderedAt = await clock();
                sample.resolveAll();
              }
            }
          }
        },
      );
      await page.evaluate(() => {
        performance.setResourceTimingBufferSize(5000);
        const root = document.querySelector('[data-confirmed-version]');
        if (!root) throw new Error('Missing canonical render marker');
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            void window.__zlozC11LongTask({ start: entry.startTime, duration: entry.duration });
        });
        longTaskObserver.observe({ type: 'longtask', buffered: true });
        let scheduled = false;
        const observer = new MutationObserver(() => {
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(() => {
            scheduled = false;
            const version = Number(root.getAttribute('data-confirmed-version'));
            const labels = Array.from(
              { length: 5 },
              (_, index) =>
                document.querySelector(`[data-flow-handle="n${index}"]`)?.textContent ?? '',
            );
            // The measurement binding is installed by Playwright, outside app state.
            void window.__zlozM4Render({ version, labels, observedAt: performance.now() });
          });
        });
        observer.observe(root, { attributes: true, attributeFilter: ['data-confirmed-version'] });
      });
    }
    if (process.env.ZLOZ_C11_CPU_PROFILE === '1') {
      for (const page of pages) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.setSamplingInterval', { interval: 2000 });
        await cdp.send('Profiler.start');
        cpuSessions.push(cdp);
      }
    }
    const send = async (page: Page, request: ZlozOperationRequest) => {
      const result = await page.evaluate(
        async ({ path, body }: { path: string; body: string }) => {
          const start = performance.now();
          const response = await fetch(`${path}/operations`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
            signal: AbortSignal.timeout(8000),
          });
          const headers = performance.now();
          const reply: unknown = await response.json();
          const decoded = performance.now();
          const resource = performance
            .getEntriesByName(new URL(`${path}/operations`, location.origin).href)
            .findLast(
              (entry) => entry.startTime >= start && entry instanceof PerformanceResourceTiming,
            );
          const timing = resource instanceof PerformanceResourceTiming ? resource : null;
          return {
            status: response.status,
            body: reply,
            timing: {
              serverTiming: response.headers.get('server-timing'),
              start,
              headers,
              decoded,
              responseStart: timing?.responseStart ?? null,
              responseEnd: timing?.responseEnd ?? null,
            },
          };
        },
        { path, body: JSON.stringify(request) },
      );
      if (result.status !== 200 || !isDiagramReply(result.body))
        throw new Error(`Submission HTTP ${result.status}`);
      return { reply: result.body, timing: result.timing };
    };
    const scheduleStart = performance.now();
    let maximumInFlight = 0;
    let launchDelayMaximum = 0;
    for (let index = 0; index < 1200; index++) {
      const due = scheduleStart + index * 100;
      if (performance.now() < due) await Bun.sleep(due - performance.now());
      launchDelayMaximum = Math.max(launchDelayMaximum, performance.now() - due);
      const writer = index % 5;
      const sample: Sample = {
        index,
        writer,
        node: `n${writer}`,
        label: `load:${index}`,
        start: await clock(),
        submitted: false,
        accepted: false,
        documentVersion: null,
        requestTiming: null,
        writerRenderedAt: null,
        controllerStartedAt: performance.now(),
        controllerReplyAt: null,
        controllerWriterAckAt: null,
        controllerReleasedAt: null,
        blockingIndex: null,
        acknowledgements: new Map(),
        allRenderedAt: null,
        failure: null,
        resolveOwn: () => {},
        resolveAll: () => {},
      };
      samples.push(sample);
      byLabel.set(sample.label, sample);
      if (busy[writer]) {
        sample.failure = 'writer-still-pending';
        sample.blockingIndex = active[writer] ?? null;
        continue;
      }
      busy[writer] = true;
      active[writer] = index;
      sample.submitted = true;
      maximumInFlight = Math.max(maximumInFlight, busy.filter(Boolean).length);
      let ownResolve: () => void = () => {};
      let allResolve: () => void = () => {};
      const own = new Promise<void>((resolve) => {
        ownResolve = resolve;
      });
      const all = new Promise<void>((resolve) => {
        allResolve = resolve;
      });
      sample.resolveOwn = ownResolve;
      sample.resolveAll = allResolve;
      const task = completeLoadEdit(
        async () => {
          try {
            const { reply, timing } = await send(pages[writer]!, {
              version: 1,
              operationId: `load-${index}`,
              operation: {
                type: 'RenameNode',
                id: sample.node,
                expected: clocks[writer]!,
                label: sample.label,
              },
            });
            sample.requestTiming = timing;
            sample.controllerReplyAt = performance.now();
            if (reply.receipt.status !== 'accepted') {
              sample.failure = `rejected:${reply.receipt.code}`;
              return;
            }
            sample.accepted = true;
            sample.documentVersion = reply.receipt.documentVersion;
            clocks[writer] = reply.receipt.documentVersion;
            wanted.set(sample.node, sample.label);
            if ((sample.acknowledgements.get(writer) ?? -1) >= sample.documentVersion)
              sample.resolveOwn();
            await Promise.race([own, Bun.sleep(5000)]);
            if (!sample.acknowledgements.has(writer)) sample.failure = 'own-render-timeout';
          } catch (error) {
            sample.failure = error instanceof Error ? error.message : 'unknown-submit';
          }
        },
        async () => {
          if (sample.failure) return;
          if (
            sample.acknowledgements.size === 5 &&
            [...sample.acknowledgements.values()].every(
              (version) => version >= sample.documentVersion!,
            )
          ) {
            sample.allRenderedAt = await clock();
            sample.resolveAll();
          }
          await Promise.race([all, Bun.sleep(5000)]);
          if (sample.allRenderedAt === null && !sample.failure)
            sample.failure = 'all-peer-render-timeout';
        },
        () => {
          sample.controllerReleasedAt = performance.now();
          busy[writer] = false;
          active[writer] = null;
        },
      );
      tasks.push(task);
    }
    await Promise.all(tasks);
    for (const [peer, cdp] of cpuSessions.entries()) {
      const profile = await cdp.send('Profiler.stop');
      const path = `${output}.cpu-${peer}.json`;
      await writeFile(path, JSON.stringify(profile));
      cpuProfiles.push(path);
      await cdp.detach();
    }
    const exported = parseGraph(
      await (await contexts[0]!.request.get(`${origin}${path}/export`)).text(),
    );
    const expected = {
      ...graph,
      nodes: graph.nodes.map((node) => ({ ...node, label: wanted.get(node.id)! })),
    };
    const parity = JSON.stringify(exported) === JSON.stringify(expected);
    const latencies = samples
      .map((sample) =>
        sample.allRenderedAt === null
          ? Number.POSITIVE_INFINITY
          : sample.allRenderedAt - sample.start,
      )
      .sort((a, b) => a - b);
    const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1]!;
    // Stall beyond the 128-receipt coverage window, then require full checkpoint catch-up.
    await contexts[4]!.setOffline(true);
    // An established socket may survive network emulation until its 25-second lease closes.
    await Bun.sleep(26_000);
    const stalledVersion = await pages[4]!
      .locator('[data-confirmed-version]')
      .getAttribute('data-confirmed-version');
    for (let index = 0; index < 130; index++) {
      const label = `catch-up:${index}`;
      const { reply } = await send(master, {
        version: 1,
        operationId: `catch-up-${index}`,
        operation: { type: 'RenameNode', id: 'n0', expected: clocks[0]!, label },
      });
      if (reply.receipt.status !== 'accepted') throw new Error('Recovery workload rejected');
      clocks[0] = reply.receipt.documentVersion;
      wanted.set('n0', label);
    }
    const remainedStalled =
      (await pages[4]!
        .locator('[data-confirmed-version]')
        .getAttribute('data-confirmed-version')) === stalledVersion;
    const catchUpStart = await clock();
    await contexts[4]!.setOffline(false);
    let caughtUp = false;
    const deadline = performance.now() + 10_000;
    while (!caughtUp && performance.now() < deadline) {
      caughtUp =
        (await pages[4]!.locator('[data-flow-handle="n0"]').textContent()) === 'catch-up:129';
      if (!caughtUp) await Bun.sleep(25);
    }
    const catchUpMs = (await clock()) - catchUpStart;
    const finalGraph = parseGraph(
      await (await contexts[0]!.request.get(`${origin}${path}/export`)).text(),
    );
    const finalExpected = {
      ...graph,
      nodes: graph.nodes.map((node) => ({ ...node, label: wanted.get(node.id)! })),
    };
    const finalParity = JSON.stringify(finalGraph) === JSON.stringify(finalExpected);
    const failures = samples.filter(
      (sample) => sample.failure !== null || sample.allRenderedAt === null,
    );
    const report = {
      version: 1,
      environment: 'local workerd and five Chromium contexts; synthetic signed identities',
      workload: {
        clients: 5,
        nodes: 250,
        edges: 500,
        planned: 1200,
        editsPerSecond: 10,
        seconds: 120,
        maxPendingPerWriter: 1,
      },
      counts: {
        planned: samples.length,
        submitted: samples.filter((sample) => sample.submitted).length,
        accepted: samples.filter((sample) => sample.accepted).length,
        renderedByAll: samples.filter((sample) => sample.allRenderedAt !== null).length,
        failures: failures.length,
      },
      timing: {
        clock: 'originating browser performance.now; controller scheduling only paces submissions',
        p95Ms: Number.isFinite(p95) ? p95 : null,
        missingSamplesHaveInfiniteLatency: true,
        launchDelayMaximum,
        maximumInFlight,
      },
      recovery: {
        interruptedPeer: 4,
        acceptedWhileStalled: 130,
        coverageWindow: 128,
        remainedStalled,
        caughtUp,
        catchUpMs,
      },
      parity,
      finalParity,
      diagnostics: {
        longTasks,
        controllerStalls,
        cpuProfiles,
        clocks:
          'RequestTiming and writerRenderedAt use the same writer browser clock; controller timing uses Node only; acceptance uses the original master browser clock.',
      },
      samples: samples.map(
        ({ acknowledgements, resolveOwn: _own, resolveAll: _all, ...sample }) => ({
          ...sample,
          acknowledgements: [...acknowledgements],
          latencyMs: sample.allRenderedAt === null ? null : sample.allRenderedAt - sample.start,
        }),
      ),
    };
    await writeFile(output, JSON.stringify(report, null, 2));
    expect(report.counts.submitted).toBe(1200);
    expect(report.counts.accepted).toBe(1200);
    expect(report.counts.renderedByAll).toBe(1200);
    expect(failures).toHaveLength(0);
    expect(p95).toBeLessThan(1000);
    expect(launchDelayMaximum).toBeLessThan(500);
    expect(parity).toBe(true);
    expect(finalParity).toBe(true);
    expect(remainedStalled).toBe(true);
    expect(caughtUp).toBe(true);
    expect(catchUpMs).toBeLessThan(10_000);
  } catch (error) {
    await writeFile(
      `${output}.failure.json`,
      JSON.stringify(
        {
          planned: 1200,
          observed: samples.length,
          submitted: samples.filter((sample) => sample.submitted).length,
          accepted: samples.filter((sample) => sample.accepted).length,
          runtimeError: error instanceof Error ? error.message : String(error),
          diagnostics: { longTasks, controllerStalls },
          samples: samples.map(
            ({ acknowledgements, resolveOwn: _own, resolveAll: _all, ...sample }) => ({
              ...sample,
              acknowledgements: [...acknowledgements],
            }),
          ),
        },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    clearInterval(tick);
  }
}

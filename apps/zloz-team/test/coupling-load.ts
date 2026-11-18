import { expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';

import { parseGraph } from '@opsydyn/foldkit-zloz';
import type { AssessmentRecord, AssessmentRequest } from '@opsydyn/foldkit-zloz-alchemy/assessment';
import { AssessmentReplySchema } from '@opsydyn/foldkit-zloz-alchemy/assessment';
import { isDiagramFrame, type DiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';
import { parseCouplingAssessment } from '@opsydyn/foldkit-zloz/coupling';
import { Schema } from 'effect';
import type { Page, BrowserContext } from 'playwright';

import fixture from './fixtures/coupling-projection-v1.json';

/** Frozen graph shape; 60 literal cases per binary combination, not generated evaluator outcomes. */
export function makeCouplingStressFixture(documentId: string) {
  const graph = parseGraph(
    JSON.stringify({
      version: 1,
      graph: {
        nodes: Array.from({ length: 250 }, (_, index) => ({
          id: `n${index}`,
          label: `Node ${index}`,
          position: { x: (index % 10) * 180, y: Math.floor(index / 10) * 120 },
          size: { width: 150, height: 80 },
          ports: [
            { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
            { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
          ],
        })),
        edges: Array.from({ length: 500 }, (_, index) => ({
          id: `e${index}`,
          source: { node: `n${index % 250}`, port: 'out' },
          target: { node: `n${((index % 250) + (index < 250 ? 1 : 10)) % 250}`, port: 'in' },
        })),
      },
    }),
  );
  const records: AssessmentRecord[] = graph.edges.slice(0, 480).map((edge, index) => {
    const example = fixture.cases[index % 8]!;
    return {
      revision: 1,
      authoredBy: 'synthetic-seed',
      operationId: `coupling-seed-${index}`,
      assessment: parseCouplingAssessment(
        JSON.stringify({
          ...fixture.assessment,
          target: {
            documentId,
            graphVersion: 0,
            relationshipId: edge.id,
            sourceNodeId: edge.source.node,
            targetNodeId: edge.target.node,
          },
          inputs: {
            ...fixture.assessment.inputs,
            integrationType: {
              ...fixture.assessment.inputs.integrationType,
              value: ['intrusive', 'functional', 'model', 'contract'][index % 4],
            },
            strength: { ...fixture.assessment.inputs.strength, value: example.strength },
            distance: { ...fixture.assessment.inputs.distance, value: example.distance },
            volatility: { ...fixture.assessment.inputs.volatility, value: example.volatility },
          },
        }),
      ),
    };
  });
  return { graph, records };
}
interface RenderedEvidence {
  sourceVersion: number;
  state: string;
  text: string;
}
interface ExpectedEvidence {
  revision: number;
  marker: string;
  state: string;
}
/** The marker delimiter prevents prefix matches; revision must be provenance text, not a root version. */
export function matchesAssessmentEvidence(
  rendered: RenderedEvidence,
  expected: ExpectedEvidence,
  source: number,
) {
  return (
    rendered.sourceVersion >= source &&
    rendered.state === expected.state &&
    rendered.text.includes(`· revision ${expected.revision} ·`) &&
    rendered.text.includes(expected.marker)
  );
}
interface DomPayload {
  sourceVersion: number;
  graphVersion: number;
  observedAt: number;
  rows: { id: string; state: string; text: string }[];
}
declare global {
  interface Window {
    __zlozAssessmentRender: (payload: DomPayload) => Promise<void>;
  }
}
interface Sample extends ExpectedEvidence {
  index: number;
  writer: number;
  relationshipId: string;
  start: number;
  submitted: boolean;
  accepted: boolean;
  sourceVersion: number | null;
  acknowledgements: Map<number, { sourceVersion: number; observedAt: number }>;
  allRenderedAt: number | null;
  failure: string | null;
  blockingIndex: number | null;
  controllerReleasedAt: number | null;
  resolveOwn: () => void;
  resolveAll: () => void;
}
export interface AssessmentWireCount {
  frames: number;
  bytes: number;
}
interface Options {
  pages: readonly Page[];
  contexts: readonly BrowserContext[];
  origin: string;
  path: string;
  frame: DiagramFrame;
  output: string;
  wire: readonly AssessmentWireCount[];
}
/** Separate assessment-only admission. The original C11 helper is intentionally untouched. */
export async function qualifyAssessmentUpdates({
  pages,
  contexts,
  origin,
  path,
  frame,
  output,
  wire,
}: Options) {
  const master = pages[0]!;
  const clock = () => master.evaluate(() => performance.now());
  const samples: Sample[] = [];
  const tasks: Promise<void>[] = [];
  const busy: (number | null)[] = [null, null, null, null, null];
  const records = new Map(
    (frame.assessments ?? []).map((record) => [record.assessment.target.relationshipId, record]),
  );
  const ids = await master
    .locator('[data-coupling-row]')
    .evaluateAll((rows) => rows.slice(0, 5).map((row) => row.getAttribute('data-coupling-row')!));
  expect(ids).toHaveLength(5);
  const states = await master
    .locator('[data-coupling-row]')
    .evaluateAll((rows) => rows.slice(0, 5).map((row) => row.getAttribute('data-coupling-state')!));
  const pageErrors: string[] = [];
  let launchDelayMaximum = 0;
  const admission = { planned: 1200, panel: 'open', kind: 'assessment-only' };
  const resolve = async (sample: Sample) => {
    if (sample.sourceVersion === null) return;
    if ((sample.acknowledgements.get(sample.writer)?.sourceVersion ?? -1) >= sample.sourceVersion)
      sample.resolveOwn();
    if (
      sample.allRenderedAt === null &&
      sample.acknowledgements.size === 5 &&
      [...sample.acknowledgements.values()].every(
        (ack) => ack.sourceVersion >= sample.sourceVersion!,
      )
    ) {
      sample.allRenderedAt = await clock();
      sample.resolveAll();
    }
  };
  const read = async () => {
    const response = await contexts[0]!.request.get(`${origin}${path}`);
    const body: { frame?: unknown } = await response.json();
    if (!isDiagramFrame(body.frame)) throw new Error('Missing validated assessment frame');
    return body.frame;
  };
  const send = async (page: Page, request: AssessmentRequest) => {
    const result = await page.evaluate(
      async ({ path, request }) => {
        const response = await fetch(`${path}/assessments`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(8000),
        });
        const body: unknown = await response.json();
        return { status: response.status, body };
      },
      { path, request },
    );
    if (result.status !== 200) throw new Error(`Assessment HTTP ${result.status}`);
    return Schema.decodeUnknownSync(AssessmentReplySchema)(result.body);
  };
  try {
    for (const [peer, page] of pages.entries()) {
      page.on('pageerror', (error) => pageErrors.push(error.message));
      // Open the evidence being acknowledged, so this is actual rendered provenance, not just hidden data.
      for (const id of ids) await page.locator(`[data-coupling-row="${id}"] summary`).click();
      await page.exposeBinding('__zlozAssessmentRender', async (_source, payload: DomPayload) => {
        if (payload.graphVersion !== 0) return;
        for (const row of payload.rows) {
          for (const sample of samples) {
            if (
              sample.relationshipId !== row.id ||
              !matchesAssessmentEvidence(
                { ...row, sourceVersion: payload.sourceVersion },
                sample,
                sample.sourceVersion ?? 0,
              )
            )
              continue;
            sample.acknowledgements.set(peer, {
              sourceVersion: payload.sourceVersion,
              observedAt: payload.observedAt,
            });
            await resolve(sample);
          }
        }
      });
      await page.evaluate((ids) => {
        const root = document.querySelector('[data-coupling-source]');
        if (!root) throw new Error('Missing assessment map');
        const report = () => {
          const rows = ids
            .map((id) => document.querySelector(`[data-coupling-row="${id}"]`))
            .filter((row): row is Element => row !== null)
            .map((row) => ({
              id: row.getAttribute('data-coupling-row')!,
              state: row.getAttribute('data-coupling-state')!,
              text: row.textContent ?? '',
            }));
          const payload = {
            sourceVersion: Number(root.getAttribute('data-coupling-source')),
            graphVersion: Number(root.getAttribute('data-coupling-graph-version')),
            observedAt: performance.now(),
            rows,
          };
          void window.__zlozAssessmentRender(payload);
        };
        let scheduled = false;
        new MutationObserver(() => {
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(() => {
            scheduled = false;
            report();
          });
        }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
      }, ids);
    }
    const scheduleStart = performance.now();
    for (let index = 0; index < 1200; index++) {
      const due = scheduleStart + index * 100;
      if (performance.now() < due) await Bun.sleep(due - performance.now());
      launchDelayMaximum = Math.max(launchDelayMaximum, performance.now() - due);
      const writer = index % 5;
      const relationshipId = ids[writer]!;
      const current = records.get(relationshipId)!;
      const sample: Sample = {
        index,
        writer,
        relationshipId,
        revision: current.revision + 1,
        marker: `assessment-load:${index}!`,
        state: states[writer]!,
        start: await clock(),
        submitted: false,
        accepted: false,
        sourceVersion: null,
        acknowledgements: new Map(),
        allRenderedAt: null,
        failure: null,
        blockingIndex: busy[writer] ?? null,
        controllerReleasedAt: null,
        resolveOwn: () => {},
        resolveAll: () => {},
      };
      samples.push(sample);
      if (busy[writer] !== null) {
        sample.failure = 'writer-still-pending';
        continue;
      }
      busy[writer] = index;
      sample.submitted = true;
      const own = new Promise<void>((done) => {
        sample.resolveOwn = done;
      });
      const all = new Promise<void>((done) => {
        sample.resolveAll = done;
      });
      const request: AssessmentRequest = {
        version: 1,
        operationId: `assessment-load-${index}`,
        expectedRevision: current.revision,
        assessment: {
          ...current.assessment,
          inputs: {
            ...current.assessment.inputs,
            strength: {
              ...fixture.assessment.inputs.strength,
              status: 'known',
              value:
                current.assessment.inputs.strength.status === 'known'
                  ? current.assessment.inputs.strength.value
                  : 'high',
              basis: 'observed',
              rationale: sample.marker,
            },
          },
        },
      };
      const submitAndObserve = async () => {
        try {
          const reply = await send(pages[writer]!, request);
          if (reply.decision.status !== 'accepted') {
            sample.failure = `rejected:${reply.decision.code}`;
            return;
          }
          sample.accepted = true;
          sample.sourceVersion = reply.sourceVersion;
          records.set(relationshipId, reply.decision.record);
          await resolve(sample);
          await Promise.race([own, Bun.sleep(5000)]);
          if ((sample.acknowledgements.get(writer)?.sourceVersion ?? -1) < reply.sourceVersion)
            sample.failure = 'own-evidence-timeout';
        } catch (error) {
          sample.failure = String(error);
        } finally {
          sample.controllerReleasedAt = performance.now();
          busy[writer] = null;
        }
        if (sample.failure) return;
        await Promise.race([all, Bun.sleep(5000)]);
        if (sample.allRenderedAt === null) sample.failure = 'all-peer-evidence-timeout';
      };
      tasks.push(submitAndObserve());
    }
    await Promise.all(tasks);
    const beforeRecovery = await read();
    const beforeExport = await (await contexts[0]!.request.get(`${origin}${path}/export`)).text();
    const duplicateRecord = records.get(ids[0]!)!;
    const duplicateRequest: AssessmentRequest = {
      version: 1,
      operationId: duplicateRecord.operationId,
      expectedRevision: duplicateRecord.revision - 1,
      assessment: duplicateRecord.assessment,
    };
    const duplicate = await send(master, duplicateRequest);
    const afterDuplicate = await read();
    const duplicateStable = JSON.stringify(afterDuplicate) === JSON.stringify(beforeRecovery);
    await contexts[4]!.setOffline(true);
    await Bun.sleep(26_000);
    const stalledSource = await pages[4]!
      .locator('[data-coupling-source]')
      .getAttribute('data-coupling-source');
    for (let index = 0; index < 130; index++) {
      const id = ids[index % 5]!;
      const current = records.get(id)!;
      const request: AssessmentRequest = {
        version: 1,
        operationId: `assessment-catch-up-${index}`,
        expectedRevision: current.revision,
        assessment: {
          ...current.assessment,
          inputs: {
            ...current.assessment.inputs,
            strength: {
              status: 'known',
              value:
                current.assessment.inputs.strength.status === 'known'
                  ? current.assessment.inputs.strength.value
                  : 'high',
              basis: 'observed',
              rationale: `assessment-catch-up:${index}!`,
            },
          },
        },
      };
      const reply = await send(master, request);
      if (reply.decision.status !== 'accepted') throw new Error('Assessment catch-up rejected');
      records.set(id, reply.decision.record);
    }
    const remainedStalled =
      (await pages[4]!.locator('[data-coupling-source]').getAttribute('data-coupling-source')) ===
      stalledSource;
    const expected = ids.map((id, index) => {
      const record = records.get(id)!;
      return {
        id,
        revision: record.revision,
        marker:
          record.assessment.inputs.strength.status === 'known'
            ? record.assessment.inputs.strength.rationale
            : '',
        state: states[index]!,
      };
    });
    const finalFrame = await read();
    const catchUpStart = await clock();
    await contexts[4]!.setOffline(false);
    let caughtUp = false;
    const deadline = performance.now() + 10_000;
    while (!caughtUp && performance.now() < deadline) {
      caughtUp = await pages[4]!.evaluate(
        ({ expected, source }) => {
          const root = document.querySelector('[data-coupling-source]');
          return (
            Number(root?.getAttribute('data-coupling-source') ?? -1) >= source &&
            root?.getAttribute('data-coupling-graph-version') === '0' &&
            expected.every((item) => {
              const row = document.querySelector(`[data-coupling-row="${item.id}"]`);
              return (
                row?.getAttribute('data-coupling-state') === item.state &&
                row.textContent?.includes(`· revision ${item.revision} ·`) &&
                row.textContent.includes(item.marker)
              );
            })
          );
        },
        { expected, source: finalFrame.sourceVersion },
      );
      if (!caughtUp) await Bun.sleep(25);
    }
    const catchUpMs = (await clock()) - catchUpStart;
    const afterExport = await (await contexts[0]!.request.get(`${origin}${path}/export`)).text();
    const latencies = samples
      .map((sample) =>
        sample.allRenderedAt === null ? Infinity : sample.allRenderedAt - sample.start,
      )
      .sort((a, b) => a - b);
    const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1]!;
    const parity =
      JSON.stringify(beforeRecovery.document) === JSON.stringify(frame.document) &&
      JSON.stringify(finalFrame.document) === JSON.stringify(frame.document) &&
      beforeExport === afterExport;
    const recordsParity =
      JSON.stringify([...records].sort()) ===
      JSON.stringify(
        (finalFrame.assessments ?? [])
          .map((record) => [record.assessment.target.relationshipId, record])
          .sort(),
      );
    const report = {
      ...admission,
      environment:
        'local native workerd/dev-Astro/five signed synthetic Chromium peers; assessment map open',
      workload: {
        clients: 5,
        nodes: 250,
        edges: 500,
        assessed: 480,
        planned: 1200,
        updatesPerSecond: 10,
        seconds: 120,
        maxPendingPerWriter: 1,
        graphVersion: 0,
        relationships: ids,
      },
      counts: {
        planned: samples.length,
        submitted: samples.filter((s) => s.submitted).length,
        accepted: samples.filter((s) => s.accepted).length,
        renderedByAll: samples.filter((s) => s.allRenderedAt !== null).length,
        failures: samples.filter((s) => s.failure !== null || s.allRenderedAt === null).length,
      },
      timing: {
        clock:
          'master browser performance.now; all five DOM provenance/marker acknowledgements required',
        p95Ms: Number.isFinite(p95) ? p95 : null,
        missingSamplesHaveInfiniteLatency: true,
        launchDelayMaximum,
      },
      recovery: {
        remainedStalled,
        caughtUp,
        catchUpMs,
        acceptedWhileStalled: 130,
        coverageWindow: 128,
        expected,
      },
      parity,
      recordsParity,
      sourceParity:
        finalFrame.sourceVersion ===
        frame.sourceVersion + samples.filter((sample) => sample.accepted).length + 130,
      duplicateStable,
      duplicate,
      pageErrors,
      wire,
      bytes: {
        initialRecords: Buffer.byteLength(JSON.stringify(frame.assessments)),
        finalRecords: Buffer.byteLength(JSON.stringify(finalFrame.assessments)),
        finalFrame: Buffer.byteLength(JSON.stringify(finalFrame)),
      },
    };
    await writeFile(
      output,
      JSON.stringify(
        {
          ...report,
          samples: samples.map(
            ({ acknowledgements, resolveOwn: _own, resolveAll: _all, ...sample }) => ({
              ...sample,
              acknowledgements: [...acknowledgements],
              latencyMs: sample.allRenderedAt === null ? null : sample.allRenderedAt - sample.start,
            }),
          ),
        },
        null,
        2,
      ),
    );
    expect(samples.filter((s) => s.submitted)).toHaveLength(1200);
    expect(samples.filter((s) => s.accepted)).toHaveLength(1200);
    expect(samples.filter((s) => s.allRenderedAt !== null && s.failure === null)).toHaveLength(
      1200,
    );
    expect(p95).toBeLessThan(1000);
    expect(launchDelayMaximum).toBeLessThan(500);
    expect(remainedStalled).toBe(true);
    expect(caughtUp).toBe(true);
    expect(catchUpMs).toBeLessThan(10_000);
    expect(parity).toBe(true);
    expect(recordsParity).toBe(true);
    expect(finalFrame.sourceVersion).toBe(
      frame.sourceVersion + samples.filter((sample) => sample.accepted).length + 130,
    );
    expect(duplicateStable).toBe(true);
    expect(pageErrors).toEqual([]);
  } catch (error) {
    await writeFile(
      `${output}.failure.json`,
      JSON.stringify(
        {
          ...admission,
          error: String(error),
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
  }
}

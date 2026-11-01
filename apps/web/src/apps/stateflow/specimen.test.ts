import { describe, expect, it } from 'vitest';

import { diagnosticsMachine } from '../request-diagnostics/machine';
import { lastStep, testFor } from './specimen';
import { specimens } from './specimens';
import { checkoutExamples, checkoutMachine, checkoutSpecimen } from './specimens/checkout';
import { diagnosticsExamples, diagnosticsSpecimen } from './specimens/diagnostics';

// The coverage search's paths are the generated tests: running each one here proves every
// "Copy test" the page offers would pass.
describe('specimen coverage', () => {
  const machines = [
    { specimen: diagnosticsSpecimen, machine: diagnosticsMachine, examples: diagnosticsExamples },
    { specimen: checkoutSpecimen, machine: checkoutMachine, examples: checkoutExamples },
  ] as const;

  it.each(machines)(
    'every path for $specimen.id fires its edge',
    ({ specimen, machine, examples }) => {
      specimen.coverage.forEach((path) => {
        const edge = specimen.edges.find((candidate) => candidate.id === path.edgeId);
        // SAFETY: each specimen's coverage paths name only keys of its own examples.
        const messages = path.steps.map(
          (step) =>
            (examples as Readonly<Record<string, Parameters<typeof machine.step>[1]>>)[step],
        );
        // SAFETY: the machine and its messages come from the same row; `never` only erases
        // the union of the two machines' types, which `lastStep` cannot take at once.
        const result = lastStep(machine as never, messages as never);
        expect(result).toMatchObject({
          _tag: 'Transitioned',
          from: edge?.from,
          target: edge?.target,
        });
      });
    },
  );

  it('reaches every live edge of the request-diagnostics machine', () => {
    expect(diagnosticsSpecimen.coverage).toHaveLength(diagnosticsSpecimen.edges.length);
    expect(diagnosticsSpecimen.dead).toEqual([]);
  });

  it('finds both branches of a guard that reads the state', () => {
    const idle = diagnosticsSpecimen.coverage.find((path) =>
      path.edgeId.startsWith('Cancelling:CompletedCancelFetchMetrics:Idle'),
    );

    expect(idle?.steps).toEqual(['leftPage', 'cancelled']);
  });

  it('reports the checkout’s unreachable state and its dead edge, and no path to it', () => {
    expect(checkoutSpecimen.unreachable).toEqual(['Refunded']);
    expect(checkoutSpecimen.dead).toEqual([
      { edgeId: 'Refunded:ClickedContinue:Browsing:Unguarded:', reason: 'UnreachableSource' },
    ]);
    expect(checkoutSpecimen.coverage).toHaveLength(checkoutSpecimen.edges.length - 1);
  });

  it('writes a Vitest case naming the machine and its examples', () => {
    const path = checkoutSpecimen.coverage.find((item) =>
      item.edgeId.startsWith('Charging:SettledCharge:Declined'),
    );
    const edge = checkoutSpecimen.edges.find((item) => item.id === path?.edgeId);
    const test = edge && path ? testFor(checkoutSpecimen, edge, path) : '';

    expect(test).toContain("it('Charging → Declined on SettledCharge'");
    expect(test).toContain('lastStep(checkoutMachine, [');
    expect(test).toContain('checkoutExamples.declined,');
  });

  it('replays undecodable events as ignored without moving the machine', () => {
    const frames = diagnosticsSpecimen.replay([
      'not json',
      ...diagnosticsSpecimen.sample.slice(0, 1),
    ]);

    expect(frames[0]).toMatchObject({
      stateTag: 'Loading',
      record: { outcome: 'ignored', reason: 'Undecodable' },
    });
    expect(frames[1]).toMatchObject({ stateTag: 'Ready', record: { sequence: 2 } });
  });

  it('accepts only events its machine can decode', () => {
    specimens.forEach((specimen) => {
      expect(specimen.sample.every(specimen.accepts)).toBe(true);
      expect(specimen.accepts('{"_tag":"NoSuchMessage"}')).toBe(false);
    });
  });
});

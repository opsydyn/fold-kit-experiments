import { expect, spyOn, test } from 'bun:test';

import { Data, Option } from 'effect';
import type { SlowContext } from 'foldkit/runtime';

import * as Editor from '../src/editor/main';

class UnexpectedGraphInspection extends Data.TaggedError('UnexpectedGraphInspection') {}

test('editor retains each slow warning without inspecting or forwarding model payloads', () => {
  const slow = Editor.slow;
  expect(slow.onSlow).toBeFunction();
  const model = Object.defineProperty({}, 'graph', {
    get() {
      throw new UnexpectedGraphInspection();
    },
    enumerable: true,
  });
  const phases: readonly SlowContext<unknown, unknown>['_tag'][] = [
    'View',
    'Update',
    'Patch',
    'SubscriptionDependencies',
  ];
  const warning = spyOn(console, 'warn').mockImplementation(() => {});
  // oxlint-disable-next-line linteffect/no-try-catch -- Restore the captured native console boundary even on assertion failure.
  try {
    for (const phase of phases) {
      slow.onSlow({
        _tag: phase,
        model,
        previousModel: model,
        nextModel: model,
        message: Option.some({ _tag: 'ObservedFrame', payload: model }),
        subscriptionKey: 'live',
        durationMs: 24.5,
        thresholdMs: 16,
      });
    }
    expect(warning).toHaveBeenCalledTimes(phases.length);
    for (const [index, args] of warning.mock.calls.entries()) {
      expect(args).toHaveLength(1);
      expect(args[0]).toBeString();
      expect(args[0]).toContain(phases[index]!);
      expect(args[0]).toContain('24.5');
      expect(args[0]).toContain('16');
      expect(args[0].length).toBeLessThan(160);
    }
  } finally {
    warning.mockRestore();
  }
});

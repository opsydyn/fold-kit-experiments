import { Option } from 'effect';
import { Scene } from 'foldkit';
import { describe, expect, it } from 'vitest';

import { svgRoot } from '../../ui/shared';
import { CopyTest, ReportTransition } from './command';
import { view } from './main';
import { Message } from './message';
import { initModel } from './model';
import { checkoutSpecimen } from './specimens/checkout';
import { update } from './update';

const replayed = update(initModel, Message.ClickedEnd()).model;
const checkout = update(initModel, Message.ChoseSpecimen({ specimen: checkoutSpecimen.id })).model;

// These tests catch missing accessible content, miswired controls and inspection that changes live state.
describe('Stateflow Observatory view', () => {
  it('renders a titled, accessible graph and replay controls before hydration', () => {
    Scene.scene(
      { update, view },
      Scene.given(initModel),
      Scene.expect(
        Scene.role('application', { name: 'Request diagnostics state graph' }),
      ).toExist(),
      Scene.expect(Scene.text('Current state: Loading')).toExist(),
      Scene.expect(Scene.text('Playback: paused')).toExist(),
      Scene.expect(Scene.text('Event 0 of 8')).toExist(),
      ...['Reset', 'Step back', 'Play', 'Step', 'To the end', 'Copy link', 'Listen live'].map(
        (name) => Scene.expect(Scene.role('button', { name })).toExist(),
      ),
      Scene.expect(Scene.label('Replay position')).toExist(),
      Scene.expect(Scene.label('Machine')).toExist(),
      ...['Sequence', 'Event', 'From', 'Outcome', 'Target', 'Reason', 'Commands'].map((name) =>
        Scene.expect(Scene.role('columnheader', { name })).toExist(),
      ),
      Scene.expect(Scene.text('Select an event to inspect its recorded facts.')).toExist(),
      Scene.tap(({ html }) => {
        expect(Scene.textContent(Option.getOrThrow(Scene.find(html, 'svg title')))).toBe(
          'Request diagnostics state graph',
        );
        // Each transition is labelled with its message, not a number to look up.
        expect(Scene.textContent(html)).toContain('CompletedCancelFetchMetrics');
      }),
    );
  });

  it('steps, steps back and resets through the update loop', () => {
    Scene.scene(
      { update, view },
      Scene.given(initModel),
      Scene.click(Scene.role('button', { name: 'Play' })),
      Scene.expect(Scene.text('Playback: playing')).toExist(),
      Scene.click(Scene.role('button', { name: 'Pause' })),
      Scene.expect(Scene.text('Playback: paused')).toExist(),
      Scene.click(Scene.role('button', { name: 'Step' })),
      Scene.Command.resolveAll([
        ReportTransition,
        Message.CompletedReportTransition({ sequence: 1 }),
      ]),
      Scene.expect(Scene.text('Current state: Ready')).toExist(),
      Scene.expect(Scene.text('Transitions: 1')).toExist(),
      Scene.expect(Scene.text('Outbound Port: emitted #1')).toExist(),
      Scene.click(Scene.role('button', { name: 'Step back' })),
      Scene.expect(Scene.text('Current state: Loading')).toExist(),
      Scene.click(Scene.role('button', { name: 'To the end' })),
      Scene.expect(Scene.text('Current state: Idle')).toExist(),
      Scene.click(Scene.role('button', { name: 'Reset' })),
      Scene.expect(Scene.text('Current state: Loading')).toExist(),
      Scene.expect(Scene.text('Transitions: 0')).toExist(),
    );
  });

  it('replays to an event picked in the swimlane', () => {
    Scene.scene(
      { update, view },
      Scene.given(initModel),
      Scene.click(
        Scene.role('button', {
          name: 'Replay to event 5: ClickedReload, Ready → Cancelling, ⇒ FetchMetrics.Interrupt',
        }),
      ),
      Scene.expect(Scene.text('Current state: Cancelling')).toExist(),
      Scene.expect(Scene.text('Event 5 of 8')).toExist(),
      Scene.tap(({ html }) => {
        const inspector = Option.getOrThrow(Scene.getByLabel('Selected trace inspector')(html));
        expect(Scene.textContent(inspector)).toContain('#5 ClickedReload');
        expect(Scene.textContent(inspector)).toContain('FetchMetrics.Interrupt');
      }),
    );
  });

  it('inspects a historical event without moving the scrubber and highlights related rows', () => {
    Scene.scene(
      { update, view },
      Scene.given(replayed),
      Scene.click(Scene.role('button', { name: 'Inspect event 5: ClickedReload' })),
      Scene.expect(Scene.text('Current state: Idle')).toExist(),
      Scene.tap(({ html }) => {
        const content = Scene.textContent(
          Option.getOrThrow(Scene.getByLabel('Selected trace inspector')(html)),
        );
        expect(content).toContain('Ready → Cancelling');
        expect(content).toContain('"sequence": 5');
      }),
      Scene.click(Scene.role('button', { name: 'Select state Ready' })),
      Scene.tap(({ html }) => {
        expect(Scene.findAll(html, '[data-related="true"]').length).toBe(4);
      }),
    );
  });

  it('marks ignored messages on the state that shrugged them off', () => {
    const ignored = update(checkout, Message.ScrubbedTo({ cursor: 11 })).model;
    Scene.scene(
      { update, view },
      Scene.given(ignored),
      Scene.expect(Scene.text('Ignored: 1')).toExist(),
      Scene.expect(
        Scene.role('button', { name: 'Select state Charging, ignored 1 messages' }),
      ).toExist(),
      Scene.tap(({ html }) => {
        const content = Scene.textContent(
          Option.getOrThrow(Scene.getByLabel('Selected trace inspector')(html)),
        );
        expect(content).toContain('NotApplicable');
        expect(content).toContain('Charging → —');
      }),
    );
  });

  it('lets keyboard users select states and inspect edges, taken or not', () => {
    Scene.scene(
      { update, view },
      Scene.given(initModel),
      Scene.keydown(Scene.role('button', { name: 'Select state Ready' }), ' '),
      Scene.expect(Scene.text('Related events highlighted: Ready')).toExist(),
      Scene.keydown(
        Scene.role('button', {
          name: 'Cancelling → Idle on CompletedCancelFetchMetrics (otherwise #1), taken 0 times',
        }),
        'Enter',
      ),
      Scene.tap(({ html }) => {
        const content = Scene.textContent(
          Option.getOrThrow(Scene.getByLabel('Selected trace inspector')(html)),
        );
        expect(content).toContain('Guard: otherwise #1');
        expect(content).toContain('No recorded event for this transition.');
      }),
      Scene.expect(Scene.text('Current state: Loading')).toExist(),
    );
  });

  it('focuses graph actions without adding an inert SVG root focus stop', () => {
    Scene.scene(
      { update, view },
      Scene.given(initModel),
      Scene.tap(({ html }) => {
        const root = Option.getOrThrow(Scene.find(html, 'svg'));
        expect(Scene.attr(root, 'tabIndex')).toEqual(Option.none());
        expect(
          Scene.attr(Option.getOrThrow(Scene.getByLabel('Select state Loading')(html)), 'tabIndex'),
        ).toEqual(Option.some('0'));
      }),
    );
  });

  it('retains root focus and keyboard events for charts with a root key handler', () => {
    Scene.scene(
      {
        update,
        view: (model, h) =>
          svgRoot(
            h,
            { width: 200, height: 100, interactive: true, ariaLabel: 'Keyboard chart' },
            () => Option.some(Message.SelectedNode({ node: 'Ready' })),
            [h.text([], [model.selectedNode ?? 'None'])],
          ),
      },
      Scene.given(initModel),
      Scene.tap(({ html }) => expect(Scene.attr(html, 'tabIndex')).toEqual(Option.some('0'))),
      Scene.keydown('svg', 'Enter'),
      Scene.expect(Scene.text('Ready')).toExist(),
    );
  });

  it('shows coverage: unreachable states, dead edges and tests to copy', () => {
    Scene.scene(
      { update, view },
      Scene.given(checkout),
      Scene.expect(Scene.text('Unreachable: Refunded')).toExist(),
      Scene.expect(Scene.text('dead: UnreachableSource')).toExist(),
      Scene.click(
        Scene.role('button', { name: 'Copy a test for Charging → Declined on SettledCharge' }),
      ),
      Scene.Command.resolveAll([CopyTest, Message.CompletedCopy({ what: 'test', copied: true })]),
      Scene.expect(Scene.text('Test copied: paste it into the machine’s test file.')).toExist(),
    );
  });
});

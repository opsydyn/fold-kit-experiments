import { Option } from 'effect';
import { Scene } from 'foldkit';
import { describe, expect, it } from 'vitest';

import { ReportTransition } from './command';
import { fixture } from './fixture';
import { view } from './main';
import { Message } from './message';
import { initModel } from './model';
import { update } from './update';

const replayed = fixture.reduce(
  (model, event) => update(model, Message.ReceivedReplayEvent({ event })).model,
  initModel,
);

// These tests catch missing accessible content, miswired controls and inspection that changes live state.
describe('Stateflow Observatory view', () => {
  it('renders a titled, accessible static graph and replay controls before hydration', () => {
    Scene.scene(
      {
        update,
        view: (model, h) => {
          const document = view(model, h);
          expect(document.title).toBe('Stateflow Observatory — Loading');
          return document;
        },
      },
      Scene.given(initModel),
      Scene.expect(
        Scene.role('application', { name: 'Request diagnostics state graph' }),
      ).toExist(),
      Scene.expect(Scene.text('Current state: Loading')).toExist(),
      Scene.expect(Scene.text('Playback: paused')).toExist(),
      Scene.expect(Scene.text('Replay session: Request diagnostics')).toExist(),
      ...['Play', 'Pause', 'Step', 'Reset'].map((name) =>
        Scene.expect(Scene.role('button', { name })).toExist(),
      ),
      ...['Sequence', 'Event', 'From', 'Outcome', 'Target', 'Reason'].map((name) =>
        Scene.expect(Scene.role('columnheader', { name })).toExist(),
      ),
      Scene.expect(Scene.text('Select an event to inspect its recorded facts.')).toExist(),
      Scene.tap(({ html }) => {
        expect(Scene.textContent(Option.getOrThrow(Scene.find(html, 'svg title')))).toBe(
          'Request diagnostics state graph',
        );
        expect(Scene.textContent(Option.getOrThrow(Scene.find(html, 'svg desc')))).toContain(
          'Select a state',
        );
      }),
    );
  });

  it('wires play, pause, step and reset through the update loop', () => {
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
      Scene.click(Scene.role('button', { name: 'Reset' })),
      Scene.expect(Scene.text('Current state: Loading')).toExist(),
      Scene.expect(Scene.text('Transitions: 0')).toExist(),
    );
  });

  it('inspects a historical event without changing the live machine and highlights related rows', () => {
    Scene.scene(
      { update, view },
      Scene.given(replayed),
      Scene.click(Scene.role('button', { name: 'Inspect event 5: ClickedReload' })),
      Scene.expect(Scene.text('Current state: Idle')).toExist(),
      Scene.tap(({ html }) => {
        const inspector = Option.getOrThrow(Scene.getByLabel('Selected trace inspector')(html));
        const content = Scene.textContent(inspector);
        expect(content).toContain('ClickedReload');
        expect(content).toContain('Ready → Cancelling');
        expect(content).toContain('FetchMetrics');
        expect(content).toContain('"sequence": 5');
      }),
      Scene.click(Scene.role('button', { name: 'Select state Ready' })),
      Scene.tap(({ html }) => {
        expect(
          Scene.attr(
            Option.getOrThrow(Scene.getByLabel('Select state Ready')(html)),
            'aria-pressed',
          ),
        ).toEqual(Option.some('true'));
        expect(Scene.findAll(html, '[data-related="true"]').length).toBe(4);
      }),
    );
  });

  it('shows ignored reasons and preserves the absent target', () => {
    const ignored = update(
      initModel,
      Message.ReceivedReplayEvent({ event: { _tag: 'StartedSelection' } }),
    ).model;
    Scene.scene(
      { update, view },
      Scene.given(ignored),
      Scene.expect(Scene.text('Ignored: 1')).toExist(),
      Scene.tap(({ html }) => {
        const content = Scene.textContent(
          Option.getOrThrow(Scene.getByLabel('Selected trace inspector')(html)),
        );
        expect(content).toContain('ignored');
        expect(content).toContain('NotApplicable');
        expect(content).toContain('Loading → —');
      }),
    );
  });
  it('lets keyboard users select states and inspect a recorded edge', () => {
    Scene.scene(
      { update, view },
      Scene.given(replayed),
      Scene.keydown(Scene.role('button', { name: 'Select state Loading' }), 'Enter'),
      Scene.expect(Scene.text('Related events highlighted: Loading')).toExist(),
      Scene.keydown(Scene.role('button', { name: 'Select state Ready' }), ' '),
      Scene.expect(Scene.text('Related events highlighted: Ready')).toExist(),
      Scene.keydown(
        Scene.role('button', { name: '5. Ready → Cancelling: ClickedReload (unguarded)' }),
        'Enter',
      ),
      Scene.tap(({ html }) => {
        const inspector = Option.getOrThrow(Scene.getByLabel('Selected trace inspector')(html));
        expect(Scene.textContent(inspector)).toContain('#5 ClickedReload');
        expect(Scene.textContent(inspector)).toContain('Guard: unguarded');
      }),
      Scene.expect(Scene.text('Current state: Idle')).toExist(),
    );
  });
});

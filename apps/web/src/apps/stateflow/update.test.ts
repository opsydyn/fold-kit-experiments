import { Option } from 'effect';
import { describe, expect, it } from 'vitest';

import { Message as DiagnosticsMessage } from '../request-diagnostics/message';
import { samplePoints } from '../request-diagnostics/model';
import { Message } from './message';
import { initModel } from './model';
import type { Model } from './model';
import { currentRecord, stateTagOf, traceOf } from './replay';
import { checkoutSpecimen } from './specimens/checkout';
import { update, withSession } from './update';

const run = (model: Model, messages: ReadonlyArray<Message>): Model =>
  messages.reduce((current, message) => update(current, message).model, model);

const loaded = DiagnosticsMessage.LoadedMetrics({ points: samplePoints });

describe('stateflow replay update', () => {
  it('records the browser motion preference and the phone width as model state', () => {
    const model = run(initModel, [
      Message.ChangedReducedMotion({ isReducedMotion: true }),
      Message.ChangedNarrow({ isNarrow: true }),
    ]);

    expect(model).toMatchObject({ reducedMotion: true, narrow: true });
  });

  it('steps forward through the sample, reporting each step on the telemetry Port', () => {
    const result = update(initModel, Message.ClickedStep());

    expect(result.model.cursor).toBe(1);
    expect(stateTagOf(result.model)).toBe('Ready');
    expect(result.commands?.map((command) => command.name)).toEqual(['ReportTransition']);
  });

  it('scrubs back and forth by replaying the machine, without reporting', () => {
    const forward = update(initModel, Message.ScrubbedTo({ cursor: 5 }));
    const back = update(forward.model, Message.ClickedStepBack());

    expect(stateTagOf(forward.model)).toBe('Cancelling');
    expect(forward.commands).toBeUndefined();
    expect(forward.model.selectedSequence).toBe(5);
    expect(stateTagOf(back.model)).toBe('Ready');
    expect(traceOf(back.model)).toHaveLength(4);
  });

  it('clamps the scrubber to the session', () => {
    expect(update(initModel, Message.ScrubbedTo({ cursor: 99 })).model.cursor).toBe(8);
    expect(update(initModel, Message.ScrubbedTo({ cursor: -3 })).model.cursor).toBe(0);
  });

  it('plays from the start once the session has played through, and stops at its end', () => {
    const ended = run(initModel, [Message.ClickedEnd()]);
    const playing = update(ended, Message.ClickedPlay()).model;
    const stepped = run(
      playing,
      Array.from({ length: 8 }, () => Message.AdvancedReplay({ deltaTimeMs: 500 })),
    );

    expect(playing).toMatchObject({ cursor: 0, playback: 'playing' });
    expect(stepped).toMatchObject({ cursor: 8, playback: 'paused' });
  });

  it('opens another machine on its own sample', () => {
    const model = run(initModel, [
      Message.ScrubbedTo({ cursor: 3 }),
      Message.ChoseSpecimen({ specimen: checkoutSpecimen.id }),
    ]);

    expect(model).toMatchObject({ specimen: 'checkout', cursor: 0, source: 'sample' });
    expect(model.events).toBe(checkoutSpecimen.sample);
    expect(stateTagOf(model)).toBe('Browsing');
  });

  it('starts a recording from an inbound Port event and extends it with the next', () => {
    const first = update(initModel, Message.ReceivedReplayEvent({ event: loaded }));
    const second = update(
      first.model,
      Message.ReceivedReplayEvent({ event: DiagnosticsMessage.ClickedReload() }),
    );

    expect(first.model).toMatchObject({ source: 'recording', cursor: 1 });
    expect(first.model.events).toHaveLength(1);
    expect(second.model.cursor).toBe(2);
    expect(traceOf(second.model).at(-1)).toMatchObject({
      messageTag: 'ClickedReload',
      commandNames: ['FetchMetrics.Interrupt'],
    });
    expect(second.commands?.map((command) => command.name)).toEqual(['ReportTransition']);
  });

  it('records ignored events without moving the machine', () => {
    const { model } = update(
      initModel,
      Message.ReceivedReplayEvent({ event: DiagnosticsMessage.StartedSelection() }),
    );

    expect(stateTagOf(model)).toBe('Loading');
    expect(traceOf(model).at(-1)).toMatchObject({ outcome: 'ignored', reason: 'NotApplicable' });
  });

  it('keeps a scrubber held earlier where it is while a recording grows', () => {
    const recording = run(initModel, [
      Message.ReceivedReplayEvent({ event: loaded }),
      Message.ReceivedReplayEvent({ event: DiagnosticsMessage.StartedSelection() }),
      Message.ScrubbedTo({ cursor: 1 }),
      Message.ReceivedReplayEvent({ event: DiagnosticsMessage.ClearedSelection() }),
    ]);

    expect(recording.events).toHaveLength(3);
    expect(recording.cursor).toBe(1);
  });

  it('takes live events only while listening, and only ones a machine can decode', () => {
    const event = checkoutSpecimen.sample[0] ?? '';
    const deaf = update(initModel, Message.ReceivedLiveEvent({ specimen: 'checkout', event }));
    const live = run(initModel, [
      Message.ClickedLive(),
      Message.ReceivedLiveEvent({ specimen: 'checkout', event: '{"_tag":"Nope"}' }),
      Message.ReceivedLiveEvent({ specimen: 'checkout', event }),
    ]);

    expect(deaf.model).toBe(initModel);
    expect(live).toMatchObject({ specimen: 'checkout', source: 'recording', cursor: 1 });
    expect(stateTagOf(live)).toBe('Cart');
  });

  it('clears a recording', () => {
    const cleared = run(initModel, [
      Message.ReceivedReplayEvent({ event: loaded }),
      Message.ClickedClearRecording(),
    ]);

    expect(cleared).toMatchObject({ events: [], cursor: 0, source: 'recording' });
  });

  it('opens on the session a shared link carries', () => {
    const model = withSession(initModel, {
      specimen: 'checkout',
      events: checkoutSpecimen.sample,
      at: 4,
    });

    expect(model).toMatchObject({ specimen: 'checkout', cursor: 4, source: 'link' });
    expect(stateTagOf(model)).toBe('Address');
    expect(withSession(initModel, null)).toBe(initModel);
  });

  it('copies the session as a link and an edge as a test, and says how that went', () => {
    const link = update(initModel, Message.ClickedCopyLink());
    const edge = checkoutSpecimen.coverage[0]?.edgeId ?? '';
    const test = update(
      { ...initModel, specimen: 'checkout', events: checkoutSpecimen.sample },
      Message.ClickedCopyTest({ edge }),
    );
    const copied = update(initModel, Message.CompletedCopy({ what: 'test', copied: true }));

    expect(link.commands?.map((command) => command.name)).toEqual(['CopySessionLink']);
    expect(test.commands?.map((command) => command.name)).toEqual(['CopyTest']);
    expect(copied.model.notice).toContain('Test copied');
  });

  it('resets to the start of the same session', () => {
    const reset = run(initModel, [Message.ClickedEnd(), Message.ClickedReset()]);

    expect(reset).toMatchObject({
      specimen: initModel.specimen,
      events: initModel.events,
      cursor: 0,
      playback: 'paused',
      selectedSequence: null,
    });
    expect(Option.isNone(currentRecord(reset))).toBe(true);
  });

  it('holds the record of the event at the scrubber', () => {
    const stepped = update(initModel, Message.ClickedStep()).model;

    expect(Option.getOrNull(currentRecord(stepped))).toMatchObject({
      sequence: 1,
      outcome: 'transitioned',
      from: 'Loading',
      messageTag: 'LoadedMetrics',
      target: 'Ready',
    });
  });

  it('steps nowhere, and reports nothing, with no events to replay', () => {
    const empty = run(initModel, [Message.ClickedClearRecording()]);
    const stepped = update({ ...empty, playback: 'playing' }, Message.ClickedStep());

    expect(stepped.model).toMatchObject({ events: [], cursor: 0, playback: 'paused' });
    expect(stepped.commands).toBeUndefined();
  });

  it('switches between the layered and the force layout', () => {
    const force = update(initModel, Message.ChoseLayout({ layout: 'force' })).model;

    expect(force.layout).toBe('force');
    expect(update(force, Message.ChoseLayout({ layout: 'layered' })).model.layout).toBe('layered');
  });

  it('copies nothing for an edge the coverage search found no path to', () => {
    const checkout = { ...initModel, specimen: 'checkout', events: checkoutSpecimen.sample };
    const dead = checkoutSpecimen.dead[0]?.edgeId ?? '';
    const result = update(checkout, Message.ClickedCopyTest({ edge: dead }));

    expect(result.model).toBe(checkout);
    expect(result.commands).toBeUndefined();
  });
});

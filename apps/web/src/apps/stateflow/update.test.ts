import { describe, expect, it } from 'vitest';

import { fixture } from './fixture';
import { Message } from './message';
import { initModel } from './model';
import { update } from './update';

describe('stateflow replay update', () => {
  it('records a transitioned replay event', () => {
    const first = update(initModel, Message.ReceivedReplayEvent({ event: fixture[0] }));

    expect(first.model.trace).toHaveLength(1);
    expect(first.model.trace[0]).toMatchObject({ outcome: 'transitioned' });
  });

  it('records ignored events without changing the machine state', () => {
    const first = update(initModel, Message.ReceivedReplayEvent({ event: fixture[0] }));
    const ignored = update(
      { ...first.model, explorer: { _tag: 'Idle' } },
      Message.ReceivedReplayEvent({ event: fixture[0] }),
    );

    expect(ignored.model.explorer).toEqual({ _tag: 'Idle' });
    expect(ignored.model.trace.at(-1)).toMatchObject({ outcome: 'ignored' });
  });

  it('reports reload command metadata without returning diagnostics commands', () => {
    const ready = update(initModel, Message.ReceivedReplayEvent({ event: fixture[0] }));
    const result = update(ready.model, Message.ReceivedReplayEvent({ event: fixture[4] }));

    expect(result.commands?.map((command) => command.name)).toEqual(['ReportTransition']);
    expect(result.model.trace.at(-1)).toMatchObject({
      commandNames: ['FetchMetrics.Interrupt'],
    });
  });

  it('replays the bounded cancellation fixture to Idle', () => {
    const result = fixture.reduce(
      (state, event) => update(state.model, Message.ReceivedReplayEvent({ event })),
      { model: initModel },
    );

    expect(result.model.explorer).toEqual({ _tag: 'Idle' });
  });

  it('pauses playback while consuming the final replay event', () => {
    const playing = update(initModel, Message.ClickedPlay());
    const result = fixture.reduce(
      (state) => update(state.model, Message.AdvancedReplay()),
      playing,
    );

    expect(result.model.replayIndex).toBe(fixture.length);
    expect(result.model.playback).toBe('paused');
    expect(result.commands?.map((command) => command.name)).toEqual(['ReportTransition']);
  });

  it('does not resume playback after the fixture is exhausted', () => {
    const result = update({ ...initModel, replayIndex: fixture.length }, Message.ClickedPlay());

    expect(result.model.playback).toBe('paused');
  });
});

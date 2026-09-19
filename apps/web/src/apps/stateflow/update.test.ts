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
      (state) => update(state.model, Message.AdvancedReplay({ deltaTimeMs: 200 })),
      playing,
    );

    expect(result.model.replayIndex).toBe(fixture.length);
    expect(result.model.playback).toBe('paused');
    expect(result.model.replayElapsedMs).toBe(0);
    expect(result.commands?.map((command) => command.name)).toEqual(['ReportTransition']);
  });

  it('does not resume playback after the fixture is exhausted', () => {
    const result = update({ ...initModel, replayIndex: fixture.length }, Message.ClickedPlay());

    expect(result.model.playback).toBe('paused');
  });
  it('waits for 200ms of playing frames before consuming one event', () => {
    const playing = update(initModel, Message.ClickedPlay()).model;
    const almost = [16, 16, 100, 67].reduce(
      (model, deltaTimeMs) => update(model, Message.AdvancedReplay({ deltaTimeMs })).model,
      playing,
    );
    expect(almost.trace).toHaveLength(0);
    expect(almost.replayElapsedMs).toBe(199);
    const first = update(almost, Message.AdvancedReplay({ deltaTimeMs: 1 }));
    expect(first.model.trace).toHaveLength(1);
    expect(first.model.replayElapsedMs).toBe(0);
    expect(first.commands?.map((command) => command.name)).toEqual(['ReportTransition']);
  });

  it('preserves elapsed time across pause/resume and ignores paused frames', () => {
    const playing = update(initModel, Message.ClickedPlay()).model;
    const partial = update(playing, Message.AdvancedReplay({ deltaTimeMs: 120 })).model;
    const paused = update(partial, Message.ClickedPause()).model;
    const delayed = update(paused, Message.AdvancedReplay({ deltaTimeMs: 1000 })).model;
    expect(delayed).toBe(paused);
    expect(delayed.trace).toHaveLength(0);
    expect(delayed.replayElapsedMs).toBe(120);
    const resumed = update(delayed, Message.ClickedPlay()).model;
    expect(update(resumed, Message.AdvancedReplay({ deltaTimeMs: 79 })).model.trace).toHaveLength(
      0,
    );
    expect(update(resumed, Message.AdvancedReplay({ deltaTimeMs: 80 })).model.trace).toHaveLength(
      1,
    );
  });

  it('drops long-frame backlog instead of rapidly draining the fixture', () => {
    const playing = update(initModel, Message.ClickedPlay()).model;
    const late = update(playing, Message.AdvancedReplay({ deltaTimeMs: 5000 })).model;
    expect(late.trace).toHaveLength(1);
    expect(late.replayElapsedMs).toBe(0);
    expect(update(late, Message.AdvancedReplay({ deltaTimeMs: 16 })).model.trace).toHaveLength(1);
  });

  it('steps exactly once while paused and restarts the next playback interval', () => {
    const playing = update(initModel, Message.ClickedPlay()).model;
    const partial = update(playing, Message.AdvancedReplay({ deltaTimeMs: 150 })).model;
    expect(update(partial, Message.ClickedStep()).model).toBe(partial);
    const paused = update(partial, Message.ClickedPause()).model;
    const stepped = update(paused, Message.ClickedStep()).model;
    expect(stepped.trace).toHaveLength(1);
    expect(stepped.playback).toBe('paused');
    expect(stepped.replayElapsedMs).toBe(0);
    const resumed = update(stepped, Message.ClickedPlay()).model;
    expect(update(resumed, Message.AdvancedReplay({ deltaTimeMs: 199 })).model.trace).toHaveLength(
      1,
    );
    expect(update(stepped, Message.ClickedReset()).model).toEqual(initModel);
  });

  it('ignores negative or non-finite frame deltas', () => {
    const playing = update(initModel, Message.ClickedPlay()).model;
    for (const deltaTimeMs of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(update(playing, Message.AdvancedReplay({ deltaTimeMs })).model).toBe(playing);
    }
  });
  it('keeps edge inspection separate from live state and recorded trace selection', () => {
    const recorded = update(initModel, Message.ClickedStep()).model;
    const selected = update(
      recorded,
      Message.SelectedEdge({ edge: 'Loading:Navigated:Cancelling:When:0' }),
    );
    expect(selected.commands).toBeUndefined();
    expect(selected.model.explorer).toBe(recorded.explorer);
    expect(selected.model.trace).toBe(recorded.trace);
    expect(selected.model.selectedEdge).toBe('Loading:Navigated:Cancelling:When:0');
    expect(selected.model.selectedSequence).toBeNull();
    const trace = update(selected.model, Message.SelectedTrace({ sequence: 1 })).model;
    expect(trace.selectedEdge).toBeNull();
    expect(trace.selectedSequence).toBe(1);
    expect(update(selected.model, Message.ClickedReset()).model).toEqual(initModel);
  });
});

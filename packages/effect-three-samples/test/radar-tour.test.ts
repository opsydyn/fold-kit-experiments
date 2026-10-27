import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { tourFrom } from '../src/radar/command';
import { Message } from '../src/radar/message';
import type { Model } from '../src/radar/model';
import { captionOf, leadIn, recordable, type Recording } from '../src/radar/tour';
import { init, update } from '../src/radar/update';

const start = init().model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const steps = (model: Model, messages: ReadonlyArray<Message>): Model =>
  messages.reduce(step, model);
const recordingOf = (model: Model): Recording | undefined =>
  model.tour._tag === 'Idle' ? undefined : model.tour.recording;

/** Plays a tour to its end, a frame at a time, as the frame clock would. */
const played = (model: Model): Model => {
  const frames = Array.from({ length: 400 }, () => Message.AdvancedTour({ deltaTimeMs: 250 }));
  return steps(step(model, Message.ClickedPlayTour()), frames);
};

/** Everything a tour sets, as opposed to clocks and frames. */
const viewOf = (model: Model) => ({
  selected: model.selected,
  cluster: model.cluster,
  edition: model.edition,
  query: model.query,
  category: model.category,
  enabledRings: model.enabledRings,
  showRelationships: model.showRelationships,
  themeChoice: model.themeChoice,
  monolith: model.monolith,
  camera: model.camera.position,
});

const session: ReadonlyArray<Message> = [
  Message.ClickedFlyTo({ id: 'foldkit' }),
  Message.HoveredBlip({ key: 'blip:elm' }),
  Message.ClickedCluster({ category: 'tools' }),
  Message.ChangedQuery({ query: 'b' }),
  Message.ChangedQuery({ query: 'bu' }),
  Message.ChangedQuery({ query: 'bun' }),
  Message.ClickedRing({ ring: 'caution' }),
  Message.ChoseTheme({ choice: 'paper' }),
  Message.ChangedEdition({ index: 1 }),
  Message.ClickedUniverse(),
  Message.ClickedMonolith(),
  Message.ClickedEntry({ id: 'bun' }),
];

describe('the flight recorder', () => {
  test('records the reader’s moves, not hovers; a search typed is one move', () => {
    const recorded = steps(step(start, Message.ClickedRecord()), session);
    const moves = recordingOf(recorded)?.steps ?? [];
    expect(moves.map(({ _tag }) => _tag)).not.toContain('HoveredBlip');
    expect(moves.filter(({ _tag }) => _tag === 'ChangedQuery')).toEqual([
      Message.ChangedQuery({ query: 'bun' }),
    ]);
    expect(moves).toHaveLength(session.length - 3);
  });

  test('stopping with nothing recorded leaves nothing to play', () => {
    const nothing = steps(start, [Message.ClickedRecord(), Message.ClickedStopRecording()]);
    expect(nothing.tour._tag).toBe('Idle');
  });

  test('a tour replays the session from where it began, and ends where it stopped', () => {
    // Recorded from an earlier edition, so the start link matters.
    const before = step(start, Message.ChangedEdition({ index: 2 }));
    const stopped = steps(before, [
      Message.ClickedRecord(),
      ...session,
      Message.ClickedStopRecording(),
    ]);
    expect(stopped.tour._tag).toBe('Ready');
    // Wander off, then play: the tour puts everything back as it was recorded.
    const wandered = steps(stopped, [
      Message.ClickedResetView(),
      Message.ChangedQuery({ query: 'elm' }),
      Message.ChoseTheme({ choice: 'night' }),
    ]);
    const replayed = played(wandered);
    expect(replayed.tour._tag).toBe('Ready');
    expect(viewOf(replayed)).toEqual(viewOf(stopped));
  });

  test('moves come at their pace after a lead-in, each with its caption', () => {
    const ready = steps(start, [
      Message.ClickedRecord(),
      Message.ClickedFlyTo({ id: 'foldkit' }),
      Message.ClickedStopRecording(),
    ]);
    const playing = step(ready, Message.ClickedPlayTour());
    const early = step(playing, Message.AdvancedTour({ deltaTimeMs: leadIn / 2 }));
    expect(Option.isNone(early.selected)).toBe(true);
    const first = step(early, Message.AdvancedTour({ deltaTimeMs: leadIn }));
    expect(first.selected).toEqual(Option.some('foldkit'));
    expect(first.tour._tag === 'Playing' && first.tour.caption).toBe('Flies to FoldKit');
  });

  test('the reader’s own move stops a tour; a theme on a tour is not saved', () => {
    const ready = steps(start, [
      Message.ClickedRecord(),
      Message.ChoseTheme({ choice: 'blueprint' }),
      Message.ClickedStopRecording(),
    ]);
    const playing = step(ready, Message.ClickedPlayTour());
    expect(step(playing, Message.ClickedTurn({ direction: 'left' })).tour._tag).toBe('Ready');
    const themed = update(
      step(playing, Message.AdvancedTour({ deltaTimeMs: leadIn / 2 })),
      Message.AdvancedTour({ deltaTimeMs: leadIn }),
    );
    expect(themed.model.themeChoice).toBe('blueprint');
    expect((themed.commands ?? []).map(({ name }) => name)).not.toContain('SaveThemeChoice');
  });

  test('every move a tour keeps has a caption', () => {
    const samples: ReadonlyArray<Message> = [
      ...session,
      Message.DoubleClickedBlip({ key: 'blip:bun' }),
      Message.ClickedBlip({ key: 'blip:bun' }),
      Message.ClickedEmptySpace(),
      Message.ClickedResetView(),
      Message.ClickedTurn({ direction: 'right' }),
      Message.ClickedZoom({ direction: 'in' }),
      Message.ClickedRelay({ to: 'elm' }),
      Message.ClickedPlay(),
      Message.ChangedCategory({ category: 'all' }),
      Message.ClickedClearFilters(),
      Message.ClickedRelationships(),
      Message.EnteredKonamiCode(),
    ];
    const covered = new Set(samples.map(({ _tag }) => _tag));
    for (const tag of recordable) expect(covered.has(tag)).toBe(true);
    for (const move of samples.filter(({ _tag }) => recordable.has(_tag))) {
      expect(captionOf(start, move).length).toBeGreaterThan(0);
    }
  });

  test('a tour file loads only if it is one, and keeps only the moves a tour may hold', () => {
    const file = JSON.stringify({
      version: 1,
      start: 'entry=bun',
      steps: [Message.ClickedUniverse(), Message.HoveredBlip({ key: 'blip:bun' })],
    });
    const loaded = tourFrom(file);
    expect(loaded._tag).toBe('SucceededLoadTour');
    expect(loaded._tag === 'SucceededLoadTour' && loaded.recording).toEqual({
      start: 'entry=bun',
      steps: [Message.ClickedUniverse()],
    });
    for (const bad of ['not json', '{}', JSON.stringify({ version: 2, start: '', steps: [] })]) {
      expect(tourFrom(bad)._tag).toBe('FailedLoadTour');
    }
  });
});

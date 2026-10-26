import { loadDemoRadar, ringIds } from '@opsydyn/effect-three-samples/radar/data';
import { describe, expect, it } from 'vitest';

import { filterPositions, layoutEntries } from './geometry';
import { Message } from './message';
import { initModel, type Model } from './model';
import { update } from './update';

const seed = () => initModel(loadDemoRadar());
const step = (model: Model, message: Message) => update(model, message).model;
function matching(model: Model): string[] {
  if (model.data._tag !== 'Ready') return [];
  return filterPositions(layoutEntries(model.data.dataset.entries), {
    query: model.query,
    category: model.category,
    rings: model.enabledRings,
  }).map(({ entry }) => entry.id);
}
const start = (clientX = 0) =>
  Message.StartedRadarPointer({ pointerId: 1, clientX, clientY: 0, renderedBaseRadius: 260 });

describe('radar interaction contract', () => {
  it('starts at the specified pose with all entries inspectable', () => {
    const model = seed();
    expect(model.center).toEqual([0, 20]);
    expect(model.zoom).toBe(1);
    expect(model.selection).toEqual({ _tag: 'None' });
    expect(matching(model)).toHaveLength(32);
  });
  it('centres list selection on the stable full-data slot, but marker selection does not move the view', () => {
    const selected = step(seed(), Message.ClickedEntryRow({ id: 'effect' }));
    expect(selected.center).toEqual([125, 22]);
    expect(selected.selection).toEqual({ _tag: 'Selected', id: 'effect' });
    const marker = step(seed(), Message.ClickedBlip({ id: 'effect', keyboard: false }));
    expect(marker.center).toEqual([0, 20]);
    expect(marker.selection).toEqual(selected.selection);
    expect(step(marker, Message.ClickedTurn({ direction: 'east' })).selection).toEqual(
      selected.selection,
    );
  });
  it('clears selection only when filters exclude it, and never resurrects it on clear-filters', () => {
    const selected = step(seed(), Message.ClickedEntryRow({ id: 'effect' }));
    expect(step(selected, Message.ChangedQuery({ query: 'typed' })).selection).toEqual(
      selected.selection,
    );
    const filtered = step(selected, Message.ChangedQuery({ query: 'unison' }));
    expect(filtered.selection).toEqual({ _tag: 'Cleared' });
    expect(matching(filtered)).toEqual(['unison', 'unison-cloud']);
    expect(step(filtered, Message.ClickedBlip({ id: 'effect', keyboard: true }))).toBe(filtered);
    const clear = step(filtered, Message.ClickedClearFilters());
    expect(clear.selection).toEqual({ _tag: 'Cleared' });
    expect(clear.center).toEqual([125, 22]);
    expect(matching(clear)).toHaveLength(32);
  });
  it('intersects category and rings, faces the category and preserves the view when choosing All', () => {
    let model = step(seed(), Message.ChangedCategory({ category: 'tools' }));
    expect(model.center).toEqual([-45, 20]);
    expect(matching(model)).toHaveLength(8);
    model = step(model, Message.ClickedRing({ ring: 'adopt' }));
    expect(matching(model)).toEqual([
      'claude-code',
      'codex',
      'llama-cpp',
      'marimo',
      'ollama',
      'pi',
    ]);
    expect(step(model, Message.ChangedCategory({ category: 'all' })).center).toEqual([-45, 20]);
    for (const ring of ['trial', 'assess', 'caution'] as const)
      model = step(model, Message.ClickedRing({ ring }));
    expect(matching(model)).toEqual([]);
    expect(model.enabledRings).toEqual([]);
    for (const ring of ringIds) model = step(model, Message.ClickedRing({ ring }));
    expect(model.enabledRings).toEqual(ringIds);
    expect(matching(model)).toHaveLength(8);
  });
  it('reset-view differs from clear-filters and zoom is bounded', () => {
    let model = step(seed(), Message.ChangedQuery({ query: 'unison' }));
    for (let i = 0; i < 20; i++) model = step(model, Message.ClickedZoomIn());
    expect(model.zoom).toBe(2);
    const reset = step(model, Message.ClickedResetView());
    expect(reset.zoom).toBe(1);
    expect(reset.center).toEqual([0, 20]);
    expect(reset.query).toBe('unison');
    for (let i = 0; i < 20; i++) model = step(model, Message.ClickedZoomOut());
    expect(model.zoom).toBe(1);
    expect(step(model, Message.PressedRadarKey({ key: 'ArrowRight' })).center).toEqual([15, 20]);
    expect(step(model, Message.PressedRadarKey({ key: 'Home' })).query).toBe('unison');
    expect(step(model, Message.PressedRadarKey({ key: 'x' }))).toBe(model);
  });
  it('ignores invalid IDs and excluded row activations', () => {
    const model = step(seed(), Message.ChangedCategory({ category: 'tools' }));
    expect(step(model, Message.ClickedEntryRow({ id: 'effect' }))).toBe(model);
    expect(step(model, Message.ClickedEntryRow({ id: 'absent' }))).toBe(model);
  });
  it('uses gesture-start deltas and ignores other pointers/cancellation identities', () => {
    let model = step(seed(), start());
    expect(step(model, Message.MovedRadarPointer({ pointerId: 2, clientX: 130, clientY: 0 }))).toBe(
      model,
    );
    model = step(model, Message.MovedRadarPointer({ pointerId: 1, clientX: 130, clientY: 0 }));
    expect(model.center).toEqual([-45, 20]);
    expect(
      step(model, Message.MovedRadarPointer({ pointerId: 1, clientX: 260, clientY: 0 })).center,
    ).toEqual([-90, 20]);
    expect(step(model, Message.EndedRadarPointer({ pointerId: 2 }))).toBe(model);
    expect(step(model, Message.EndedRadarPointer({ pointerId: 1 })).gesture._tag).toBe('Idle');
  });
  it('suppresses one pointer selection after a drag but keeps keyboard and later clicks usable', () => {
    let model = step(seed(), start());
    model = step(model, Message.MovedRadarPointer({ pointerId: 1, clientX: 5, clientY: 0 }));
    model = step(model, Message.EndedRadarPointer({ pointerId: 1 }));
    model = step(model, Message.ClickedBlip({ id: 'effect', keyboard: false }));
    expect(model.selection).toEqual({ _tag: 'None' });
    expect(step(model, Message.ClickedBlip({ id: 'effect', keyboard: false })).selection).toEqual({
      _tag: 'Selected',
      id: 'effect',
    });
    const tiny = step(
      step(
        step(seed(), start()),
        Message.MovedRadarPointer({ pointerId: 1, clientX: 4, clientY: 0 }),
      ),
      Message.EndedRadarPointer({ pointerId: 1 }),
    );
    expect(step(tiny, Message.ClickedBlip({ id: 'effect', keyboard: false })).selection._tag).toBe(
      'Selected',
    );
    expect(step(tiny, Message.ClickedBlip({ id: 'effect', keyboard: true })).selection._tag).toBe(
      'Selected',
    );
  });
  it('stops stale gestures on controls and rejects non-finite/overflowing pointer facts', () => {
    const model = step(seed(), start());
    const filtered = step(model, Message.ChangedQuery({ query: '' }));
    expect(filtered.gesture._tag).toBe('Idle');
    expect(
      step(filtered, Message.MovedRadarPointer({ pointerId: 1, clientX: 260, clientY: 0 })),
    ).toBe(filtered);
    expect(
      step(
        seed(),
        Message.StartedRadarPointer({
          pointerId: 1,
          clientX: 0,
          clientY: 0,
          renderedBaseRadius: 0,
        }),
      ),
    ).toEqual(seed());
    const huge = step(seed(), start(1e308));
    expect(
      step(huge, Message.MovedRadarPointer({ pointerId: 1, clientX: -1e308, clientY: 0 })),
    ).toBe(huge);
    expect(step(model, Message.MovedRadarPointer({ pointerId: 1, clientX: NaN, clientY: 0 }))).toBe(
      model,
    );
  });
});

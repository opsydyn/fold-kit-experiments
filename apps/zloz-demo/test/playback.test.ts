import { expect, test } from 'bun:test';

import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { update } from '../src/editor/update';
const send = (model: Model, message: Message) => update(model, message).model;
function ready() {
  let model = send(init().model, Message.ClickedOrderHistory());
  model = send(model, Message.ChangedPlaybackReducedMotion({ reducedMotion: false }));
  model = send(model, Message.ChangedPlaybackVisibility({ visible: true }));
  return send(model, Message.ClickedPlaybackEnabled());
}
function tick(model: Model, run = model.playbackRun) {
  return Message.AdvancedEditionPlayback({
    modelId: model.modelIdentity.id,
    run,
    milliseconds: 2000,
  });
}
test('opt-in playback projects read-only editions with ghosts and preserves the working graph/Undo/camera', () => {
  const initial = ready();
  expect(init().model.historyPlayback).toBeNull();
  const started = send(initial, Message.ClickedPlaybackPlay());
  expect(started.historyReview?.editionId).toBe('order-start');
  expect(started.historyReview?.editor.readOnly).toBe(true);
  expect(started.historyPlayback?.cursor.status).toBe('playing');
  const advanced = send(started, tick(started));
  expect(advanced.historyReview?.editionId).toBe('order-evolved');
  expect(advanced.historyBaselineId).toBe('order-start');
  expect(advanced.historyPlayback?.cursor.status).toBe('paused');
  expect(advanced.editor).toBe(initial.editor);
  const rewound = send(advanced, Message.ClickedPlaybackRewind());
  expect(rewound.historyReview?.editionId).toBe('order-start');
  expect(rewound.editor).toBe(initial.editor);
});
test('pause/restart rejects old ticks, including malformed payloads, and manual inspection pauses', () => {
  const started = send(ready(), Message.ClickedPlaybackPlay());
  const paused = send(started, Message.ClickedPlaybackPause());
  const resumed = send(paused, Message.ClickedPlaybackPlay());
  const stale = send(resumed, { ...tick(started), milliseconds: NaN });
  expect(stale.historyReview).toBe(resumed.historyReview);
  expect(stale.historyPlayback).toBe(resumed.historyPlayback);
  const inspected = send(
    resumed,
    Message.ObservedZlozInput({ message: { type: 'NodeSelected', id: 'order', additive: false } }),
  );
  expect(inspected.historyPlayback?.cursor.status).toBe('paused');
  expect(send(inspected, tick(resumed)).historyReview).toBe(inspected.historyReview);
  const left = send(resumed, Message.SelectedWorkbenchSection({ section: 'diagram' }));
  expect(left.historyPlayback?.cursor.status).toBe('paused');
});
test('reduced motion, hidden pages, present and collection changes stop transport without automatic resumption', () => {
  const started = send(ready(), Message.ClickedPlaybackPlay());
  const reduced = send(started, Message.ChangedPlaybackReducedMotion({ reducedMotion: true }));
  expect(reduced.historyPlayback?.cursor.status).toBe('paused');
  expect(send(reduced, Message.ClickedPlaybackPlay()).historyReview).toBe(reduced.historyReview);
  expect(send(reduced, Message.ClickedPlaybackNext()).historyReview?.editionId).toBe(
    'order-evolved',
  );
  expect(
    send(reduced, Message.ChangedPlaybackReducedMotion({ reducedMotion: false })).historyPlayback
      ?.cursor.status,
  ).toBe('paused');
  const hidden = send(started, Message.ChangedPlaybackVisibility({ visible: false }));
  expect(hidden.historyPlayback?.cursor.status).toBe('paused');
  expect(
    send(hidden, Message.ChangedPlaybackVisibility({ visible: true })).historyPlayback?.cursor
      .status,
  ).toBe('paused');
  const present = send(started, Message.ClickedHistoryPresent());
  expect(present.historyReview).toBeNull();
  expect(send(present, tick(started)).historyReview).toBeNull();
  const replaced = { ...started, editions: started.editions.slice() };
  expect(send(replaced, tick(started)).historyPlayback?.cursor.status).toBe('paused');
});

test('fork/switch round trips disable transport and busy document operations cannot start it', () => {
  const started = send(ready(), Message.ClickedPlaybackPlay());
  const named = send(started, Message.ChangedForkName({ name: 'Alternative' }));
  expect(named.historyPlayback?.cursor.status).toBe('paused');
  const forked = send(named, Message.ClickedForkEdition());
  expect(forked.modelIdentity.id).not.toBe(started.modelIdentity.id);
  expect(forked.historyPlayback).toBeNull();
  const back = send(forked, Message.SelectedWorkingModel({ id: started.modelIdentity.id }));
  expect(back.historyPlayback).toBeNull();
  expect(send(back, tick(started)).historyReview).toBeNull();
  const base = ready();
  const pending = send(
    base,
    Message.ChoseModelDocumentFiles({ files: [new File(['{}'], 'model.json')] }),
  );
  expect(send(pending, Message.ClickedPlaybackPlay()).historyPlayback?.cursor.status).toBe(
    'paused',
  );
  expect(send(pending, Message.ClickedPlaybackPlay()).historyReview).toBeNull();
});

test('successive scrubber requests keep their seek session, pause the clock and preserve working data', () => {
  const base = ready();
  const started = send(base, Message.ClickedPlaybackPlay());
  const scope = { modelId: started.modelIdentity.id, session: started.historyPlayback!.session };
  const selected = send(
    started,
    Message.SelectedPlaybackEdition({ ...scope, editionId: 'order-evolved' }),
  );
  expect(selected.historyReview?.editionId).toBe('order-evolved');
  expect(selected.historyPlayback?.cursor.status).toBe('paused');
  expect(selected.historyPlayback?.session).toBe(scope.session);
  const first = send(
    selected,
    Message.SelectedPlaybackEdition({ ...scope, editionId: 'order-start' }),
  );
  expect(first.historyReview?.editionId).toBe('order-start');
  expect(first.editor).toBe(base.editor);
  expect(send(first, tick(started)).historyReview).toBe(first.historyReview);
  expect(send(first, Message.SelectedPlaybackEdition({ ...scope, editionId: null }))).toBe(first);
  expect(send(first, Message.SelectedPlaybackEdition({ ...scope, editionId: 'missing' }))).toBe(
    first,
  );
});
test('seek intents cannot survive present/sidebar return trips, collection changes or re-enabling', () => {
  const started = send(ready(), Message.ClickedPlaybackPlay());
  const request = Message.SelectedPlaybackEdition({
    modelId: started.modelIdentity.id,
    session: started.historyPlayback!.session,
    editionId: 'order-evolved',
  });
  const present = send(started, Message.ClickedHistoryPresent());
  expect(send(present, request)).toBe(present);
  const left = send(started, Message.SelectedWorkbenchSection({ section: 'diagram' }));
  const back = send(left, Message.SelectedWorkbenchSection({ section: 'history' }));
  expect(send(back, request)).toBe(back);
  const hidden = send(started, Message.ChangedPlaybackVisibility({ visible: false }));
  const visible = send(hidden, Message.ChangedPlaybackVisibility({ visible: true }));
  expect(send(visible, request)).toBe(visible);
  const enabledAgain = send(
    send(started, Message.ClickedPlaybackEnabled()),
    Message.ClickedPlaybackEnabled(),
  );
  expect(send(enabledAgain, request)).toBe(enabledAgain);
  const reordered = send(
    { ...started, editions: started.editions.slice().reverse() },
    Message.ClickedPlaybackPause(),
  );
  expect(send(reordered, request)).toBe(reordered);
  const named = send(started, Message.ChangedForkName({ name: 'Seek alternative' }));
  const forked = send(named, Message.ClickedForkEdition());
  const returned = send(forked, Message.SelectedWorkingModel({ id: started.modelIdentity.id }));
  const reenabled = send(returned, Message.ClickedPlaybackEnabled());
  expect(reenabled.modelIdentity.id).toBe(started.modelIdentity.id);
  expect(reenabled.historyPlayback).not.toBeNull();
  expect(send(reenabled, request)).toBe(reenabled);
  const pending = send(
    ready(),
    Message.ChoseModelDocumentFiles({ files: [new File(['{}'], 'model.json')] }),
  );
  const blocked = send(
    pending,
    Message.SelectedPlaybackEdition({
      modelId: pending.modelIdentity.id,
      session: pending.historyPlayback!.session,
      editionId: 'order-evolved',
    }),
  );
  expect(blocked.historyReview).toBeNull();
  expect(blocked.editor).toBe(pending.editor);
  expect(blocked.notice).toContain('Finish active');
});

test('the named scrubber sample is additive/idempotent and direct seeking reaches its final checkpoint', () => {
  const base = send(init().model, Message.ClickedScrubberHistory());
  expect(base.editions).toHaveLength(8);
  expect(send(base, Message.ClickedScrubberHistory()).editions).toHaveLength(8);
  let model = send(base, Message.SelectedWorkbenchSection({ section: 'history' }));
  model = send(model, Message.ChangedPlaybackVisibility({ visible: true }));
  model = send(model, Message.ClickedPlaybackEnabled());
  const selected = send(
    model,
    Message.SelectedPlaybackEdition({
      modelId: model.modelIdentity.id,
      session: model.historyPlayback!.session,
      editionId: 'scrubber-order-7',
    }),
  );
  expect(selected.historyReview?.editionId).toBe('scrubber-order-7');
  expect(selected.historyBaselineId).toBe('scrubber-order-6');
  expect(selected.editor).toBe(base.editor);
});

test('ghost controls stay live while baseline selection pauses playback and rejects prior ticks', () => {
  const started = send(ready(), Message.ClickedPlaybackPlay());
  const toggled = send(started, Message.ClickedHistoryGhost({ part: 'nodes' }));
  expect(toggled.historyPlayback?.cursor.status).toBe('playing');
  expect(toggled.historyGhosts.nodes).toBe(!started.historyGhosts.nodes);
  const baseline = send(toggled, Message.SelectedHistoryBaseline({ id: 'order-evolved' }));
  expect(baseline.historyPlayback?.cursor.status).toBe('paused');
  expect(baseline.historyBaselineId).toBe('order-evolved');
  expect(send(baseline, tick(started)).historyReview).toBe(baseline.historyReview);
  expect(baseline.editor).toBe(started.editor);
});

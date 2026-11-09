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

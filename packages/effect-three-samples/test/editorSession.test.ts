/**
 * Two editor tabs, simulated: each `Say` one makes reaches the other as `HeardWire`,
 * and turns tick on both. They join one session and end with the same document, over
 * the channel or through a relay alike.
 */
import { expect, test } from 'bun:test';

import { Lockstep } from '@opsydyn/effect-three';
import { Option } from 'effect';

import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { decodeWireText, encodeWireText, managedResources, relayIn } from '../src/editor/session';
import { update } from '../src/editor/update';
import type { Wire } from '../src/editor/wire';

type Model = ReturnType<typeof init>['model'];
type Tab = { model: Model; outbox: Array<Wire>; said: Array<Wire>; via: Array<string> };

/** Runs `message` on `tab`, keeping what it says for the other tabs. */
const run = (tab: Tab, message: typeof Message.Type) => {
  const result = update(tab.model, message);
  tab.model = result.model;
  for (const command of result.commands ?? []) {
    if (command.name !== 'Say') continue;
    // SAFETY: a `Say` Command's arguments are `{ wire, via }`, as `session.ts` defines it.
    const { wire, via } = command.args as { readonly wire: Wire; readonly via: string };
    tab.outbox.push(wire);
    tab.said.push(wire);
    tab.via.push(via);
  }
};

/** The tabs' clock, in milliseconds: a turn's worth passes with each exchange. */
const clock = { now: 0 };

/** Every tab hears what the others said, then every tab ticks, `times` over. */
const exchange = (tabs: ReadonlyArray<Tab>, times: number) => {
  for (let i = 0; i < times; i++) {
    clock.now += 50;
    const said = tabs.map((tab) => tab.outbox.splice(0));
    tabs.forEach((tab, index) => {
      said.forEach((wires, from) => {
        if (from !== index)
          for (const wire of wires) run(tab, Message.HeardWire({ wire, at: clock.now }));
      });
    });
    for (const tab of tabs) run(tab, Message.TickedTurn({ at: clock.now }));
  }
};

const keys = (tab: Tab) => tab.model.nodes.map((node) => node.key);

const opened = (peer: string, relay: Option.Option<string> = Option.none()): Tab => {
  const tab: Tab = { model: init().model, outbox: [], said: [], via: [] };
  run(tab, Message.NamedTab({ peer, at: 0, relay }));
  return tab;
};

const studio = 'ws://relay.test:4325/studio';

/** A tab whose page names the relay, once its socket is open. */
const openedOnRelay = (peer: string): Tab => {
  const tab = opened(peer, Option.some(studio));
  run(tab, Message.ConnectedRelay());
  return tab;
};

/** What the relay resource asks for, as the runtime reads it from the Model. */
const relayWanted = (tab: Tab) => managedResources.relay.modelToMaybeRequirements(tab.model);

test('a second tab is welcomed with the document, and both apply every edit alike', () => {
  const a = opened('a');
  run(a, Message.WaitedForWelcome());
  expect(a.model.session._tag).toBe('Live');
  run(a, Message.ClickedAdd({ kind: 'cone' }));
  exchange([a], 3);
  expect(keys(a)).toContain('cone-1');

  const b = opened('b');
  expect(b.model.session._tag).toBe('Joining');
  exchange([a, b], 12);
  expect(b.model.session._tag).toBe('Live');
  expect(keys(b)).toEqual(keys(a));

  // Both edit in the same turns; both end with the same document and history.
  run(a, Message.ClickedAdd({ kind: 'ring' }));
  run(b, Message.ClickedAdd({ kind: 'ring' }));
  run(b, Message.EditedNode({ key: 'ball-1', path: ['position', 1], value: 2 }));
  exchange([a, b], 8);
  expect(keys(a)).toEqual(['crate-1', 'ball-1', 'light-1', 'cone-1', 'ring-1', 'ring-2']);
  expect(b.model.nodes).toEqual(a.model.nodes);
  expect(b.model.history).toEqual(a.model.history);
  // Each tab selects what it added itself: a the first ring (a's id sorts first), b the second.
  expect(a.model.selected).toEqual(['ring-1']);
  expect(b.model.selected).toEqual(['ring-2']);
  // Undo on one tab undoes for both: the history is shared.
  run(b, Message.ClickedUndo());
  exchange([a, b], 6);
  expect(a.model.nodes).toEqual(b.model.nodes);
});

test('a tab that says goodbye, or goes quiet, stops holding the others up', () => {
  const a = opened('a');
  run(a, Message.WaitedForWelcome());
  const b = opened('b');
  exchange([a, b], 12);
  run(b, Message.LeftPage());
  exchange([a, b], 2);
  run(a, Message.ClickedAdd({ kind: 'box' }));
  exchange([a], 6);
  expect(keys(a)).toContain('box-1');

  // c joins, then goes quiet: a, the leader, drops it after three seconds of waiting.
  const c = opened('c');
  exchange([a, c], 12);
  expect(c.model.session._tag).toBe('Live');
  // c stops; once the turns it sent ahead are used up, a waits on it, and so do edits.
  exchange([a], 20);
  const waiting =
    a.model.session._tag === 'Live' ? Lockstep.waitingOn(a.model.session.lockstep) : [];
  expect(waiting).toEqual(['c']);
  run(a, Message.ClickedAdd({ kind: 'ball' }));
  exchange([a], 10);
  expect(keys(a)).not.toContain('ball-2');
  // Three seconds on, the leader drops c from the turn everyone waits on, and goes on.
  exchange([a], 70);
  expect(keys(a)).toContain('ball-2');
  expect(a.said.some((wire) => wire._tag === 'Drop' && wire.peer === 'c')).toBe(true);
});

test('until a tab is in a session, edits wait: a joining tab changes nothing', () => {
  const b = opened('b');
  run(b, Message.ClickedAdd({ kind: 'cone' }));
  expect(keys(b)).not.toContain('cone-1');
});

test('through a relay, a tab says hello only once the socket is open, and says all through it', () => {
  const a = opened('a', Option.some(studio));
  expect(a.model.session._tag).toBe('Joining');
  expect(a.said).toEqual([]);
  expect(relayWanted(a)).toEqual(Option.some({ url: studio, peer: 'a' }));
  run(a, Message.ConnectedRelay());
  expect(a.said).toEqual([{ _tag: 'Hello', peer: 'a' }]);
  run(a, Message.WaitedForWelcome());

  const b = openedOnRelay('b');
  exchange([a, b], 12);
  expect(b.model.session._tag).toBe('Live');
  run(b, Message.ClickedAdd({ kind: 'ring' }));
  exchange([a, b], 6);
  expect(keys(a)).toContain('ring-1');
  expect(a.model.nodes).toEqual(b.model.nodes);
  expect([...a.via, ...b.via].every((via) => via === 'relay')).toBe(true);
  expect(opened('c').via).toEqual(['tabs']);
});

test('a tab that loses the relay edits alone, and reconnecting joins again under a new name', () => {
  const a = openedOnRelay('a');
  run(a, Message.WaitedForWelcome());
  const b = openedOnRelay('b');
  exchange([a, b], 12);
  run(b, Message.ClickedAdd({ kind: 'cone' }));
  exchange([a, b], 6);

  run(b, Message.LostRelay());
  expect(Option.map(b.model.relay, (relay) => relay.link)).toEqual(Option.some('Lost'));
  expect(relayWanted(b)).toEqual(Option.none());
  // b keeps its document and edits on alone; a drops it once it goes quiet.
  run(b, Message.ClickedAdd({ kind: 'box' }));
  exchange([b], 6);
  expect(keys(b)).toEqual([...keys(a), 'box-1']);
  exchange([a], 80);
  run(a, Message.ClickedAdd({ kind: 'ball' }));
  exchange([a], 6);
  expect(keys(a)).toContain('ball-2');

  // Reconnecting names the tab again; as a newcomer, it is welcomed with a's document.
  const commands = update(b.model, Message.ClickedReconnect()).commands ?? [];
  expect(commands.map((command) => command.name)).toEqual(['NameTab']);
  run(b, Message.NamedTab({ peer: 'b2', at: 0, relay: Option.some(studio) }));
  expect(relayWanted(b)).toEqual(Option.some({ url: studio, peer: 'b2' }));
  run(b, Message.ConnectedRelay());
  exchange([a, b], 12);
  expect(b.model.session._tag).toBe('Live');
  expect(b.model.nodes).toEqual(a.model.nodes);
});

test('a relay that never opens leaves the tab editing alone', () => {
  const a = opened('a', Option.some(studio));
  run(a, Message.FailedRelay({ reason: `No relay at ${studio}` }));
  expect(a.model.session._tag).toBe('Live');
  run(a, Message.ClickedAdd({ kind: 'box' }));
  exchange([a], 4);
  expect(keys(a)).toContain('box-1');
});

test('a welcome crosses the relay as JSON and arrives as it was sent', () => {
  const a = openedOnRelay('a');
  run(a, Message.WaitedForWelcome());
  const b = openedOnRelay('b');
  exchange([a, b], 12);
  const welcome = a.said.find((wire) => wire._tag === 'Welcome');
  expect(welcome).toBeDefined();
  for (const wire of [...a.said, ...b.said]) {
    expect(decodeWireText(encodeWireText(wire))).toEqual(Option.some(wire));
  }
  expect(decodeWireText('{"_tag":"Hello"}')).toEqual(Option.none());
  expect(decodeWireText('not json')).toEqual(Option.none());
});

test('a page names a relay only with a WebSocket address', () => {
  expect(relayIn(`?relay=${encodeURIComponent(studio)}`)).toEqual(Option.some(studio));
  expect(relayIn('?relay=wss://relay.example/room')).toEqual(
    Option.some('wss://relay.example/room'),
  );
  expect(relayIn('?relay=https://relay.example/room')).toEqual(Option.none());
  expect(relayIn('?relay=nowhere')).toEqual(Option.none());
  expect(relayIn('')).toEqual(Option.none());
});

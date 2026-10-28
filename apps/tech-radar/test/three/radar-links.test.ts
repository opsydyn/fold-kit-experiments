import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { decodeLink, linkOf } from '../../src/radar/three/link';
import { Message } from '../../src/radar/three/message';
import {
  clusterView,
  editionsOf,
  flightTo,
  type Model,
  positionOf,
} from '../../src/radar/three/model';
import { elevationOf, isBirdsEye } from '../../src/radar/three/space';
import { applyLink, init, update } from '../../src/radar/three/update';

const start = init().model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const steps = (model: Model, messages: ReadonlyArray<Message>): Model =>
  messages.reduce(step, model);
const paramsOf = (query: string): Readonly<Record<string, string>> =>
  Object.fromEntries(new URLSearchParams(query));
const opened = (query: string) => init({ link: paramsOf(query) });
const commandNames = (model: Model, message: Message): ReadonlyArray<string> =>
  (update(model, message).commands ?? []).map(({ name }) => name);

describe('deep links', () => {
  test('the radar as it opens has an empty link', () => {
    expect(linkOf(start)).toBe('');
  });

  test('every part of the view goes into the link and comes back out', () => {
    const viewed = steps(start, [
      Message.ChangedEdition({ index: 1 }),
      Message.ChangedQuery({ query: 'sync' }),
      Message.ChangedCategory({ category: 'platforms' }),
      Message.ClickedRing({ ring: 'caution' }),
      Message.ClickedRelationships(),
      Message.ChoseTheme({ choice: 'blueprint' }),
      Message.ClickedFlyTo({ id: 'local-first-sync' }),
    ]);
    const link = linkOf(viewed);
    expect(paramsOf(link)).toEqual({
      entry: 'local-first-sync',
      edition: editionsOf(start)[1]?.authoredOn ?? '',
      view: 'entry',
      q: 'sync',
      category: 'platforms',
      rings: 'adopt,trial,assess',
      edges: 'off',
      theme: 'blueprint',
    });
    const reopened = applyLink(start, decodeLink(paramsOf(link)));
    expect(linkOf(reopened)).toBe(link);
    expect(reopened.camera).toEqual(viewed.camera);
  });

  test('a link opens the radar there: pinned, in its edition and theme', () => {
    const { model, commands } = opened('entry=foldkit&view=entry&edition=2025-10-14&theme=paper');
    expect(model.selected).toEqual(Option.some('foldkit'));
    expect(model.edition).toBe(0);
    expect(model.themeChoice).toBe('paper');
    const foldkit = positionOf(model, 'foldkit');
    expect(Option.map(foldkit, flightTo)).toEqual(Option.some(model.camera));
    // A link's theme is for this visit: the saved one is not looked for over it.
    expect(commands ?? []).toEqual([]);
    expect(init().commands?.map(({ name }) => name)).toEqual(['LoadThemeChoice']);
  });

  test('a link can stand above the map or at a cluster', () => {
    expect(isBirdsEye(opened('view=universe').model.camera.position)).toBe(true);
    const tools = opened('view=cluster:tools').model;
    expect(tools.cluster).toEqual(Option.some('tools'));
    expect(elevationOf(tools.camera.position)).toBeCloseTo(clusterView.elevation, 9);
  });

  test('the view is where the camera is aimed, not which entry happens to be pinned', () => {
    const flown = step(start, Message.ClickedFlyTo({ id: 'foldkit' }));
    expect(paramsOf(linkOf(flown)).view).toBe('entry');
    // Pinned still, but stopped at another cluster: the link names the cluster.
    const stopped = step(flown, Message.ClickedCluster({ category: 'tools' }));
    expect(paramsOf(linkOf(stopped)).view).toBe('cluster:tools');
    expect(applyLink(start, decodeLink(paramsOf(linkOf(stopped)))).camera).toEqual(stopped.camera);
    // Turned away by hand: no view to name.
    const turned = step(flown, Message.ClickedTurn({ direction: 'left' }));
    expect(paramsOf(linkOf(turned)).view).toBeUndefined();
  });

  test('parts that are unknown, malformed or name nothing here are let go', () => {
    const garbage = opened(
      [
        'entry=no-such-entry',
        'edition=2001-01-01',
        'view=cluster:nowhere',
        'category=everything',
        'rings=adopt,later',
        'edges=sometimes',
        'theme=sepia',
        'q=' + 'x'.repeat(200),
        'unrelated=1',
      ].join('&'),
    ).model;
    expect(linkOf(garbage)).toBe('');
    expect(Option.isNone(garbage.selected)).toBe(true);
    expect(garbage.camera).toEqual(start.camera);
    expect(decodeLink(paramsOf('entry=<script>')).entry).toEqual(Option.none());
  });

  test('the address bar follows the view, but not drags, hovers or frames', () => {
    expect(commandNames(start, Message.ClickedFlyTo({ id: 'bun' }))).toEqual(['ReplaceLink']);
    expect(commandNames(start, Message.HoveredBlip({ key: 'blip:bun' }))).toEqual([]);
    const drag = Message.MadeGesture({
      gesture: {
        _tag: 'Drag',
        button: 0,
        modifiers: { shift: false, control: false, meta: false, alt: false },
        width: 800,
        height: 500,
        x: 10,
        y: 10,
        deltaX: 8,
        deltaY: 0,
      },
    });
    expect(commandNames(start, drag)).toEqual([]);
  });

  test('Copy link copies, and says how it went until the view next changes', () => {
    expect(commandNames(start, Message.ClickedCopyLink())).toEqual(['CopyLink']);
    const copied = step(start, Message.CompletedCopyLink({ outcome: 'copied' }));
    expect(copied.linkNotice).toEqual(Option.some('copied'));
    const moved = step(copied, Message.ClickedFlyTo({ id: 'bun' }));
    expect(Option.isNone(moved.linkNotice)).toBe(true);
  });
});

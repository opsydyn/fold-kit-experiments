import {
  describeScene,
  type FieldPath,
  type FieldValue,
  type Gesture,
  Inspector,
  Lockstep,
  movedAlike,
  orbit,
  type Placement,
  scene,
  type SceneNode,
  SceneFile,
  SceneSchema,
  shotCamera,
  type ShotAngle,
  type Vec3,
} from '@opsydyn/effect-three';
import { BoxSelect, TransformGizmo, ViewportGizmo } from '@opsydyn/effect-three-foldkit';
import { Array as Arr, Match, Option, Result } from 'effect';
import type { Return } from 'foldkit/update';

import { DownloadFile, ReadText } from './command';
import { nodeKeyOf, placed, placementOf, selectableOf } from './document';
import { applyEdit, type Edit } from './edit';
import { Message } from './message';
import type { Model } from './model';
import { NameTab, type RelayService, Say, selfOf, WaitForWelcome } from './session';
import { type Packet, quietMilliseconds, type Relay, type Wire } from './wire';

type AppReturn = Return<Model, Message, RelayService>;
type Nodes = ReadonlyArray<SceneNode>;
type Live = Extract<Model['session'], { readonly _tag: 'Live' }>;

const snaps = { translationSnap: 0.25, rotationSnap: Math.PI / 12, scaleSnap: 0.25 } as const;
const free = { translationSnap: null, rotationSnap: null, scaleSnap: null } as const;

const nodeIn = (nodes: Nodes, key: string): Option.Option<SceneNode> =>
  Arr.findFirst(nodes, (node) => node.key === key);

// PROPOSING

/**
 * An Edit this tab asks for: into its next turn packet when in a session, applied here
 * at once when offline (no channel, as in tests), and dropped while still joining.
 */
const propose = (model: Model, edit: Edit): Model =>
  Match.valueTags(model.session, {
    Offline: () => applyEdit(model, edit, true),
    Joining: () => model,
    Live: (session) => ({
      ...model,
      session: { ...session, lockstep: Lockstep.submit(session.lockstep, edit) },
    }),
  });

// THE GIZMO

/** Each node after the gizmo put the first selected at `placement`; the rest move alike. */
const placeSelected = (model: Model, placement: Placement): Model => {
  const before = Option.getOrElse(model.before, () => model.nodes);
  const first = Option.flatMap(Arr.head(model.selected), (key) => nodeIn(before, key));
  return Option.match(first, {
    onNone: () => model,
    onSome: (moved) => ({
      ...model,
      nodes: model.nodes.map((node) => {
        const was = Option.getOrElse(nodeIn(before, node.key), () => node);
        if (node.key === moved.key) return placed(node, placement);
        if (!model.selected.includes(node.key)) return node;
        return placed(node, movedAlike(placementOf(moved), placement, placementOf(was)));
      }),
    }),
  });
};

const fromGizmo = (model: Model, out: TransformGizmo.OutMessage): Model =>
  TransformGizmo.OutMessage.match(out, {
    Moved: ({ placement }) => placeSelected(model, placement),
    Finished: ({ placement }) => {
      const next = placeSelected(model, placement);
      const placements = next.nodes
        .filter((node) => model.selected.includes(node.key))
        .map((node) => ({ key: node.key, placement: placementOf(node) }));
      return propose({ ...next, before: Option.none() }, { _tag: 'Place', placements });
    },
  });

const withGizmo = (model: Model, message: TransformGizmo.Message): Model => {
  const result = TransformGizmo.update(model.gizmo, message);
  const next = { ...model, gizmo: result.model };
  return result.outMessage === undefined ? next : fromGizmo(next, result.outMessage);
};

const pressGizmo = (model: Model, key: string, origin: Vec3, direction: Vec3): Model => {
  const first = Option.flatMap(Arr.head(model.selected), (selected) =>
    nodeIn(model.nodes, selected),
  );
  return Option.match(Option.all([TransformGizmo.handleOf(model.gizmo, key), first]), {
    onNone: () => model,
    onSome: ([handle, node]) =>
      withGizmo(
        { ...model, before: Option.some(model.nodes) },
        TransformGizmo.Message.Pressed({
          handle,
          origin,
          direction,
          placement: placementOf(node),
          camera: model.camera,
        }),
      ),
  });
};

const whileHeld = (model: Model, message: TransformGizmo.Message): Model =>
  TransformGizmo.held(model.gizmo) ? withGizmo(model, message) : model;

// THE VIEWPORT GIZMO

const withView = (model: Model, message: ViewportGizmo.Message): Model => {
  const result = ViewportGizmo.update(model.view, message);
  return { ...model, view: result.model, camera: result.outMessage?.camera ?? model.camera };
};

const press = (model: Model, key: string, origin: Vec3, direction: Vec3): Model =>
  Option.isSome(ViewportGizmo.axisOf(model.view, key))
    ? withView(
        { ...model, pressedView: true },
        ViewportGizmo.Message.Pressed({ key, camera: model.camera }),
      )
    : pressGizmo({ ...model, pressedView: false }, key, origin, direction);

const hover = (model: Model, key: string): Model => {
  const gizmo = Option.match(TransformGizmo.handleOf(model.gizmo, key), {
    onNone: () => model,
    onSome: (handle) => withGizmo(model, TransformGizmo.Message.Hovered({ handle })),
  });
  return withView(gizmo, ViewportGizmo.Message.Entered({ key }));
};

const leave = (model: Model, key: string): Model => {
  const gizmo = Option.isSome(TransformGizmo.handleOf(model.gizmo, key))
    ? withGizmo(model, TransformGizmo.Message.Hovered({ handle: null }))
    : model;
  return withView(gizmo, ViewportGizmo.Message.Left({ key }));
};

// SELECTING

const select = (
  model: Model,
  path: { readonly key: string; readonly path: ReadonlyArray<string> },
) =>
  Option.match(Option.fromNullishOr(nodeKeyOf(model.nodes, path)), {
    onNone: () => ({ ...model, pressedView: false }),
    onSome: (key) => ({ ...model, selected: [key], pressedView: false }),
  });

const clickNothing = (model: Model): Model =>
  model.pressedView ? { ...model, pressedView: false } : { ...model, selected: [] };

const offNodes = (gesture: Gesture): boolean => !('key' in gesture) || gesture.key === undefined;

const gesture = (model: Model, made: Gesture): Model => {
  if (made._tag === 'Drag' && BoxSelect.claims(model.box, made)) {
    return { ...model, box: BoxSelect.update(model.box, BoxSelect.dragOf(made)).model };
  }
  return !TransformGizmo.held(model.gizmo) && offNodes(made)
    ? { ...model, camera: orbit(model.camera, made) }
    : model;
};

const endBox = (model: Model): Model => {
  const result = BoxSelect.update(
    model.box,
    BoxSelect.Message.Ended({ camera: model.camera, selectable: selectableOf(model.nodes) }),
  );
  return { ...model, box: result.model, selected: result.outMessage?.keys ?? model.selected };
};

// SESSION

const live = (model: Model, session: Live): Model => ({ ...model, session });

/** Says `wire` to the others: through the relay when the page names one, else the channel. */
const say = (model: Model, wire: Wire) =>
  Say({ wire, via: Option.isSome(model.relay) ? 'relay' : 'tabs' });

/** The Welcome for `peer`: the session and the shared document as they are now. */
const welcome = (model: Model, lockstep: Lockstep.Lockstep<Edit>, peer: string): Wire => ({
  _tag: 'Welcome',
  to: peer,
  turn: lockstep.turn,
  lead: lockstep.lead,
  members: lockstep.members,
  nodes: model.nodes,
  resources: model.resources,
  history: model.history,
});

/**
 * Every turn whose packets are all in, applied: each Edit to the document (mine when
 * this tab made it), then a Welcome to any newcomer whose first turn has come.
 */
const settle = (model: Model, session: Live): AppReturn => {
  const before = session.lockstep.turn;
  const result = Lockstep.advance(session.lockstep);
  const applied = result.applied.reduce(
    (at, { peer, input }) => applyEdit(at, input, peer === result.state.self),
    live(model, { ...session, lockstep: result.state }),
  );
  const newcomers = Lockstep.welcomeDue(before, result.state);
  return {
    model: applied,
    commands: newcomers.map((peer) => say(applied, welcome(applied, result.state, peer))),
  };
};

/** The turn the session waits on, and since when; none once it waits on no one. */
const stallOf = (session: Live, at: number): Live['stalled'] => {
  if (Lockstep.waitingOn(session.lockstep).length === 0) return Option.none();
  const turn = session.lockstep.turn;
  const same = Option.filter(session.stalled, (stalled) => stalled.turn === turn);
  return Option.orElse(same, () => Option.some({ turn, since: at }));
};

/** Whether this tab, leading, has waited too long on others at the turn all wait on. */
const tooQuiet = (session: Live, at: number): boolean =>
  Lockstep.leaderAt(session.lockstep, session.lockstep.turn) === session.lockstep.self &&
  Option.exists(session.stalled, (stalled) => at - stalled.since >= quietMilliseconds);

/** As leader, tabs held up on for too long are dropped from the turn all wait on. */
const dropQuiet = (model: Model, session: Live, at: number): AppReturn => {
  if (!tooQuiet(session, at)) return { model: live(model, session) };
  const { lockstep } = session;
  const quiet = Lockstep.waitingOn(lockstep).filter((peer) => peer !== lockstep.self);
  const dropped = quiet.reduce(
    (state, peer) => Lockstep.remove(state, peer, lockstep.turn),
    lockstep,
  );
  const next = settle(model, { _tag: 'Live', lockstep: dropped, stalled: Option.none() });
  return {
    model: next.model,
    commands: [
      ...quiet.map((peer) => say(model, { _tag: 'Drop', peer, until: lockstep.turn })),
      ...(next.commands ?? []),
    ],
  };
};

/** A turn's tick: this tab's packet out, what is complete applied, the quiet dropped. */
const tick = (model: Model, at: number): AppReturn => {
  if (model.session._tag !== 'Live') return { model };
  const sent = Lockstep.send(model.session.lockstep);
  const settled = settle(model, { ...model.session, lockstep: sent.state });
  const session = settled.model.session;
  const dropped =
    session._tag === 'Live'
      ? dropQuiet(settled.model, { ...session, stalled: stallOf(session, at) }, at)
      : settled;
  return {
    model: dropped.model,
    commands: [
      ...(sent.packet === undefined ? [] : [say(model, { _tag: 'Turn', packet: sent.packet })]),
      ...(settled.commands ?? []),
      ...(dropped.commands ?? []),
    ],
  };
};

/** Says hello, and waits to be welcomed. */
const hello = (model: Model, peer: string): AppReturn => ({
  model,
  commands: [say(model, { _tag: 'Hello', peer }), WaitForWelcome()],
});

/**
 * This tab named: it joins, saying hello at once over the channel, or once the relay
 * the page names is open (`connected`).
 */
const named = (model: Model, peer: string, relay: Option.Option<string>): AppReturn => {
  const joining: Model = {
    ...model,
    session: { _tag: 'Joining', self: peer, heard: [] },
    relay: Option.map(relay, (url) => ({ url, link: 'Connecting' as const })),
  };
  return Option.isSome(relay) ? { model: joining } : hello(joining, peer);
};

const linked = (model: Model, link: Relay['link']): Model => ({
  ...model,
  relay: Option.map(model.relay, (relay) => ({ ...relay, link })),
});

/** The relay open: this tab says hello through it. */
const connected = (model: Model): AppReturn =>
  model.session._tag === 'Joining'
    ? hello(linked(model, 'Open'), model.session.self)
    : { model: linked(model, 'Open') };

/**
 * The relay unreachable, or gone: this tab carries on in a session of its own, with its
 * document as it is (the others drop it when it goes quiet).
 */
const lost = (model: Model): Model => {
  if (!Option.exists(model.relay, (relay) => relay.link !== 'Lost')) return model;
  const unlinked = linked(model, 'Lost');
  return Option.match(selfOf(model.session), {
    onNone: () => unlinked,
    onSome: (self) =>
      live(unlinked, { _tag: 'Live', lockstep: Lockstep.make(self), stalled: Option.none() }),
  });
};

/** Reconnecting: a new name, so this tab joins through the relay again as a newcomer. */
const reconnect = (model: Model): AppReturn =>
  Option.exists(model.relay, (relay) => relay.link === 'Lost')
    ? { model, commands: [NameTab()] }
    : { model };

/** No welcome came: this tab starts a session of its own, with its document as it is. */
const waited = (model: Model): Model =>
  model.session._tag === 'Joining'
    ? live(model, {
        _tag: 'Live',
        lockstep: Lockstep.make(model.session.self),
        stalled: Option.none(),
      })
    : model;

/**
 * Whether this tab can take a welcome: still joining, or (the welcome came just after it
 * gave up waiting) in a session of its own that no one else is in.
 */
const welcomable = (session: Model['session'], to: string): boolean => {
  if (session._tag === 'Joining') return session.self === to;
  if (session._tag !== 'Live') return false;
  const { lockstep } = session;
  return lockstep.self === to && Lockstep.membersAt(lockstep, lockstep.turn).length === 1;
};

const heardWhileJoining = (session: Model['session']) =>
  session._tag === 'Joining' ? session.heard : [];

/** Welcomed: this tab joins the session and takes its document and history. */
const welcomed = (model: Model, wire: Extract<Wire, { readonly _tag: 'Welcome' }>): AppReturn => {
  if (!welcomable(model.session, wire.to)) return { model };
  const lockstep = Lockstep.join(wire.to, wire, heardWhileJoining(model.session));
  const document = {
    ...model,
    nodes: wire.nodes,
    resources: wire.resources,
    history: wire.history,
    saved: wire.nodes,
    selected: [],
  };
  return settle(document, { _tag: 'Live', lockstep, stalled: Option.none() });
};

/** A Hello: the leader admits the newcomer in its next packet. */
const helloed = (model: Model, peer: string): AppReturn =>
  model.session._tag === 'Live'
    ? {
        model: live(model, {
          ...model.session,
          lockstep: Lockstep.admit(model.session.lockstep, peer),
        }),
      }
    : { model };

/** A turn packet: kept while joining, received (and what it completes applied) once in. */
const turned = (model: Model, packet: Packet): AppReturn =>
  Match.valueTags(model.session, {
    Offline: () => ({ model }),
    Joining: (session) => ({
      model: { ...model, session: { ...session, heard: [...session.heard, packet] } },
    }),
    Live: (session) =>
      settle(model, { ...session, lockstep: Lockstep.receive(session.lockstep, packet) }),
  });

/** A tab gone, by its own goodbye or the leader's drop: no one waits for it from `until`. */
const gone = (model: Model, peer: string, until: number): AppReturn =>
  model.session._tag === 'Live'
    ? settle(model, {
        ...model.session,
        lockstep: Lockstep.remove(model.session.lockstep, peer, until),
      })
    : { model };

/** What another tab said, as this tab's session stands. */
const hear = (model: Model, wire: Wire): AppReturn =>
  Match.valueTags(wire, {
    Hello: ({ peer }) => helloed(model, peer),
    Turn: ({ packet }) => turned(model, packet),
    Welcome: (welcome) => welcomed(model, welcome),
    Bye: ({ peer, until }) => gone(model, peer, until),
    Drop: ({ peer, until }) => gone(model, peer, until),
  });

/** Leaving: the others stop waiting after the last turn this tab sent. */
const bye = (model: Model): AppReturn =>
  model.session._tag === 'Live'
    ? {
        model,
        commands: [
          say(model, {
            _tag: 'Bye',
            peer: model.session.lockstep.self,
            until: Lockstep.leave(model.session.lockstep) + 1,
          }),
        ],
      }
    : { model };

// LOCAL

/** The things to frame: those named that are in the document, or all of them. */
const subjectOf = (model: Model, keys: ReadonlyArray<string>): Nodes => {
  const named = model.nodes.filter((node) => keys.includes(node.key));
  return named.length === 0 ? model.nodes : named;
};

/** The camera framing the subject from `angle`; with nothing of known size, as it was. */
const frame = (model: Model, keys: ReadonlyArray<string>, angle: ShotAngle): Model => {
  const bounds = describeScene(
    scene({ resources: model.resources, children: subjectOf(model, keys) }),
  ).bounds;
  return bounds === null ? model : { ...model, camera: shotCamera(model.camera, bounds, angle) };
};

const toggleSnapping = (model: Model): Model => {
  const snapping = !model.snapping;
  return {
    ...model,
    snapping,
    gizmo: { ...model.gizmo, gizmo: { ...model.gizmo.gizmo, ...(snapping ? snaps : free) } },
  };
};

const refused = (model: Model, issue: string): Model => ({ ...model, issue: Option.some(issue) });

const proposeField = (model: Model, key: string, path: FieldPath, value: FieldValue): Model =>
  propose({ ...model, issue: Option.none() }, { _tag: 'Field', key, path, value });

/** An inspector edit to `node`, checked here first so a refusal is shown at once. */
const checkField = (model: Model, node: SceneNode, path: FieldPath, value: FieldValue): Model =>
  Result.match(Inspector.edit(SceneSchema.SceneNode, node, path, value), {
    onFailure: (issue) => refused(model, issue),
    onSuccess: () => proposeField(model, node.key, path, value),
  });

const editNode = (model: Model, key: string, path: FieldPath, value: FieldValue): Model =>
  Option.match(nodeIn(model.nodes, key), {
    onNone: () => model,
    onSome: (node) => checkField(model, node, path, value),
  });

// FILES

/** The document as a scene file: its nodes and what they share, in a scene of their own. */
const fileText = (model: Model): string =>
  SceneFile.save(scene({ resources: model.resources, children: model.nodes }));

const save = (model: Model): AppReturn => ({
  model: { ...model, saved: model.nodes },
  commands: [DownloadFile({ name: 'scene.json', text: fileText(model) })],
});

/** A file read: its scene proposed as the document, or why it cannot be. */
const load = (model: Model, text: string): Model =>
  Result.match(SceneFile.read(text), {
    onFailure: (error) => refused(model, `That file is not a scene: ${error.issue}`),
    onSuccess: (loaded) =>
      propose(
        { ...model, saved: loaded.children },
        { _tag: 'Open', nodes: loaded.children, resources: loaded.resources },
      ),
  });

/** The first file chosen is read; choosing none does nothing. */
const chooseFiles = (model: Model, files: ReadonlyArray<File>): AppReturn =>
  Option.match(Arr.head(files), {
    onNone: () => ({ model }),
    onSome: (file) => ({ model, commands: [ReadText({ file })] }),
  });

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    PressedScene: ({ key, origin, direction }) => ({ model: press(model, key, origin, direction) }),
    DraggedScene: ({ origin, direction }) => ({
      model: whileHeld(model, TransformGizmo.Message.Dragged({ origin, direction })),
    }),
    ReleasedScene: () => ({ model: whileHeld(model, TransformGizmo.Message.Released()) }),
    ClickedScene: (hit) => ({ model: select(model, hit) }),
    ClickedNothing: () => ({ model: clickNothing(model) }),
    HoveredScene: ({ key }) => ({ model: hover(model, key) }),
    LeftScene: ({ key }) => ({ model: leave(model, key) }),
    MadeGesture: ({ gesture: made }) => ({ model: gesture(model, made) }),
    EndedGesture: () => ({ model: endBox(model) }),
    ClickedAdd: ({ kind }) => ({ model: propose(model, { _tag: 'Add', kind, at: null }) }),
    PlacedThing: ({ kind, at }) => ({ model: propose(model, { _tag: 'Add', kind, at }) }),
    FramedShot: ({ subject, angle }) => ({ model: frame(model, subject, angle) }),
    ChoseMood: ({ mood }) => ({ model: { ...model, mood } }),
    ClickedOutlined: ({ key }) => ({ model: { ...model, selected: [key] } }),
    ClickedDuplicate: () => ({
      model: propose(model, { _tag: 'Duplicate', keys: model.selected }),
    }),
    ClickedDelete: () => ({ model: propose(model, { _tag: 'Delete', keys: model.selected }) }),
    ChoseMode: ({ mode }) => ({
      model: withGizmo(model, TransformGizmo.Message.ChoseMode({ mode })),
    }),
    ClickedSnapping: () => ({ model: toggleSnapping(model) }),
    ClickedUndo: () => ({ model: propose(model, { _tag: 'Undo' }) }),
    ClickedRedo: () => ({ model: propose(model, { _tag: 'Redo' }) }),
    ClickedStep: ({ id }) => ({ model: propose(model, { _tag: 'Jump', id }) }),
    EditedNode: ({ key, path, value }) => ({ model: editNode(model, key, path, value) }),
    ClickedSave: () => save(model),
    ChoseFiles: ({ files }) => chooseFiles(model, files),
    ReadFile: ({ text }) => ({ model: load(model, text) }),
    CompletedDownload: () => ({ model }),
    ReceivedSceneLifecycle: () => ({ model }),
    NamedTab: ({ peer, relay }) => named(model, peer, relay),
    WaitedForWelcome: () => ({ model: waited(model) }),
    HeardWire: ({ wire }) => hear(model, wire),
    TickedTurn: ({ at }) => tick(model, at),
    LeftPage: () => bye(model),
    CompletedSay: () => ({ model }),
    ConnectedRelay: () => connected(model),
    FailedRelay: () => ({ model: lost(model) }),
    LostRelay: () => ({ model: lost(model) }),
    ReleasedRelay: () => ({ model }),
    ClickedReconnect: () => reconnect(model),
  });

import { glided, type Gesture, orbit, orbitOptions, teleported } from '@opsydyn/effect-three';
import { Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { CheckSupport, Enter, Exit } from './command';
import { Message } from './message';
import { initialModel, type Model, mostPlants, type PlantKind } from './model';
import { NamePlayer, type RelayService, Say } from './presence';
import { quietMilliseconds, type Relay, type Wire } from './wire';

type AppReturn = Return<Model, Message, RelayService>;

/** A plant of `kind` at `point`, the oldest going once there are too many. */
const planted = (
  model: Model,
  point: readonly [number, number, number],
  kind: PlantKind,
): Model => ({
  ...model,
  plants: [...model.plants, { id: `plant-${model.nextPlant}`, at: point, kind }].slice(-mostPlants),
  nextPlant: model.nextPlant + 1,
});

/** On the floor, within the room's walls. */
const onFloor = (at: readonly [number, number, number]): readonly [number, number, number] => [
  Math.min(2.8, Math.max(-2.8, at[0])),
  0,
  Math.min(2.8, Math.max(-2.8, at[2])),
];

const support = { true: 'ready', false: 'unavailable' } as const;

const orbitLimits = orbitOptions({
  minDistance: 2,
  maxDistance: 9,
  maxPolarAngle: 1.45,
  minAzimuthAngle: -0.4,
  maxAzimuthAngle: 1.6,
});

/** Look around, unless the gesture began on something to click. */
const orbited = (model: Model, gesture: Gesture): Model =>
  'key' in gesture && gesture.key !== undefined
    ? model
    : { ...model, camera: orbit(model.camera, gesture, orbitLimits) };

/** Says `wire` (made with this player's name) to the other players, once named. */
const say = (model: Model, wire: (peer: string) => Wire): AppReturn =>
  Option.match(model.self, {
    onNone: () => ({ model }),
    onSome: (peer) => ({
      model,
      commands: [Say({ wire: wire(peer), via: Option.isSome(model.relay) ? 'relay' : 'tabs' })],
    }),
  });

const bye = (model: Model): AppReturn => say(model, (peer) => ({ _tag: 'Bye', peer }));

/**
 * What another player said: where they are now (in their place in the list, so the
 * scene keeps its order), or that they have gone. This player's own words are ignored.
 */
const heard = (model: Model, wire: Wire, at: number): Model => {
  if (Option.contains(model.self, wire.peer)) return model;
  const others = model.others.filter((other) => other.peer !== wire.peer);
  if (wire._tag === 'Bye') return { ...model, others };
  const known = model.others.some((other) => other.peer === wire.peer);
  const now = { peer: wire.peer, poses: wire.poses, at };
  return {
    ...model,
    others: known
      ? model.others.map((other) => (other.peer === wire.peer ? now : other))
      : [...others, now],
  };
};

/** Players unheard for too long (a crash, a lost link) are no longer shown. */
const swept = (model: Model, at: number): Model =>
  model.others.every((other) => at - other.at <= quietMilliseconds)
    ? model
    : { ...model, others: model.others.filter((other) => at - other.at <= quietMilliseconds) };

const linked = (model: Model, link: Relay['link']): Model => ({
  ...model,
  relay: Option.map(model.relay, (relay) => ({ ...relay, link })),
});

export const init = (props: { readonly assetBase?: string } = {}) => ({
  model: initialModel(props.assetBase ?? '/models/'),
  commands: [
    CheckSupport({ mode: 'immersive-vr' }),
    CheckSupport({ mode: 'immersive-ar' }),
    NamePlayer(),
  ],
});

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    CheckedSupport: ({ mode, supported }) => ({
      model:
        mode === 'immersive-vr'
          ? { ...model, vr: support[`${supported}`] }
          : { ...model, ar: support[`${supported}`] },
    }),
    ClickedEnter: ({ mode }) => ({
      model: { ...model, session: 'entering' },
      commands: [Enter({ mode })],
    }),
    ClickedExit: () => ({ model, commands: [Exit()] }),
    FailedEnter: () => ({ model: { ...model, session: 'none' } }),
    // The session's end arrives whoever ends it; what was detected goes with it.
    // Leaving the session, the player stops being shown to the others.
    ChangedSession: ({ mode }) =>
      mode === null
        ? bye({ ...model, session: 'none', planes: [], meshes: [] })
        : { model: { ...model, session: mode } },
    ClickedFloor: ({ point }) => ({ model: planted(model, onFloor(point), model.kind) }),
    ChoseKind: ({ kind }) => ({ model: { ...model, kind } }),
    PlacedPlant: ({ at, kind }) => ({ model: planted(model, onFloor(at), kind) }),
    ClickedPlant: ({ id }) => ({
      model: modifyFields(model, { plants: (plants) => plants.filter((plant) => plant.id !== id) }),
    }),
    ClickedClear: () => ({ model: { ...model, plants: [] } }),
    SelectedSurface: ({ surface }) => ({ model: planted(model, surface.point, model.kind) }),
    DetectedPlanes: ({ detected }) => ({ model: { ...model, planes: detected.planes } }),
    DetectedMeshes: ({ detected }) => ({ model: { ...model, meshes: detected.meshes } }),
    Glided: ({ moved }) => ({
      model: modifyFields(model, { player: (player) => glided(player, moved) }),
    }),
    Teleported: ({ teleported: arrived }) => ({
      model: modifyFields(model, { player: (player) => teleported(player, arrived) }),
    }),
    ReportedPoses: ({ poses }) => say(model, (peer) => ({ _tag: 'Pose', peer, poses })),
    NamedPlayer: ({ peer, relay }) => ({
      model: {
        ...model,
        self: Option.some(peer),
        relay: Option.map(relay, (url) => ({ url, link: 'Connecting' as const })),
      },
    }),
    HeardPresence: ({ wire, at }) => ({ model: heard(model, wire, at) }),
    TickedPresence: ({ at }) => ({ model: swept(model, at) }),
    LeftPage: () => bye(model),
    CompletedSay: () => ({ model }),
    ConnectedRelay: () => ({ model: linked(model, 'Open') }),
    FailedRelay: () => ({ model: linked(model, 'Lost') }),
    LostRelay: () => ({ model: linked(model, 'Lost') }),
    ReleasedRelay: () => ({ model }),
    MadeGesture: ({ gesture }) => ({ model: orbited(model, gesture) }),
    ReceivedSceneLifecycle: () => ({ model }),
  });

/**
 * A bowling lane. The ball and pins are dynamic bodies; the lane, gutters and pit are
 * fixed. What the Model learns comes back through sensors:
 *
 * - each pin's spot is a sensor collider at head height, named for the pin, so a pin's
 *   head leaving its spot says that pin is down (and reaching it, that it stands);
 * - a sensor named `pit` behind the pins says the ball has gone through;
 * - the ball reports contact forces above a threshold: how hard it hit.
 *
 * The scoreboard is a troika label whose panel is sized from its measured layout.
 */
import {
  body,
  box,
  capsule,
  cameraShake,
  capsuleCollider,
  circle,
  colorRange,
  contactShadows,
  cuboidCollider,
  directionalLight,
  environment,
  fixed,
  group,
  hemisphereLight,
  label,
  line,
  type LabelColorRange,
  mesh,
  physical,
  phong,
  physics,
  plane,
  renderSettings,
  scene,
  type SceneNode,
  sphere,
  spotLight,
  standard,
  torus,
  type Vec3,
} from '@opsydyn/effect-three';

import { paintColour } from '../palette';
import { type Block, type Model, pinIds } from './model';
import { frames, marks, score, strikes } from './score';
import { ballKey, pinKey, readyBallKey } from './update';

/** The lane: its top at y = 0, the foul line at z = 6, the head pin at z = −5. */
const lane = { width: 1.06, near: 6.2, far: -6.2 } as const;
const laneLength = lane.near - lane.far;
const laneMiddle = (lane.near + lane.far) / 2;

const ballRadius = 0.11;
const ballMass = 6.5;
const pinRadius = 0.06;
/** The pin's straight middle; with its rounded ends it stands 0.38 tall. */
const pinMiddle = 0.26;
const pinHeight = pinMiddle + pinRadius * 2;

/** Where each pin stands: four rows back from the head pin, 30 cm apart. */
const spotOf = (index: number): Vec3 => {
  const row = index < 1 ? 0 : index < 3 ? 1 : index < 6 ? 2 : 3;
  const first = [0, 1, 3, 6][row] ?? 0;
  const across = (index - first - row / 2) * 0.3;
  return [across, 0, -5 - row * 0.26];
};

const spots = pinIds.map((id, index) => ({ id, at: spotOf(index) }));

const wood = standard({ color: 0xd9a86c, roughness: 0.35, metalness: 0 });

const fixedBox = (key: string, position: Vec3, size: Vec3, material = wood): SceneNode =>
  mesh({
    key,
    position,
    geometry: box({ width: size[0], height: size[1], depth: size[2] }),
    material,
    receiveShadow: true,
    body: body({ type: 'fixed', friction: 0.25 }),
  });

const gutterMaterial = standard({ color: 0x3a3f4b, roughness: 0.4, metalness: 0.5 });
const sideMaterial = standard({ color: 0x23262e, roughness: 0.8 });

const alley: ReadonlyArray<SceneNode> = [
  fixedBox('lane', [0, -0.05, laneMiddle], [lane.width, 0.1, laneLength]),
  // Gutters either side, lower than the lane, and the walls beyond them.
  fixedBox(
    'gutter-left',
    [-lane.width / 2 - 0.12, -0.12, laneMiddle],
    [0.24, 0.04, laneLength],
    gutterMaterial,
  ),
  fixedBox(
    'gutter-right',
    [lane.width / 2 + 0.12, -0.12, laneMiddle],
    [0.24, 0.04, laneLength],
    gutterMaterial,
  ),
  fixedBox(
    'side-left',
    [-lane.width / 2 - 0.3, 0.1, laneMiddle],
    [0.12, 0.5, laneLength],
    sideMaterial,
  ),
  fixedBox(
    'side-right',
    [lane.width / 2 + 0.3, 0.1, laneMiddle],
    [0.12, 0.5, laneLength],
    sideMaterial,
  ),
  // The approach behind the foul line.
  fixedBox(
    'approach',
    [0, -0.05, lane.near + 1.4],
    [lane.width + 0.84, 0.1, 2.8],
    standard({ color: 0xc9975f, roughness: 0.5 }),
  ),
  // The pit behind the pins, and its back wall.
  fixedBox('pit-floor', [0, -0.6, lane.far - 0.8], [lane.width + 0.8, 0.1, 1.6], sideMaterial),
  fixedBox('pit-back', [0, 0.2, lane.far - 1.6], [lane.width + 0.8, 1.6, 0.1], sideMaterial),
];

/** A platform under the alley: something to stand on, on a dark page or a light one. */
const floor: SceneNode = mesh({
  key: 'floor',
  position: [0, -0.66, 0.2],
  rotation: fixed([-Math.PI / 2, 0, 0]),
  geometry: plane({ width: 3.4, height: 17 }),
  material: standard({ color: 0x15171d, roughness: 0.9 }),
  receiveShadow: true,
});

const markMaterial = standard({ color: 0x5a3b22, roughness: 0.5 });

/**
 * The lane's aiming marks, inlaid: seven arrows in a V four metres down, and a row of
 * dots near the foul line, as on a real lane.
 */
const laneMarks: ReadonlyArray<SceneNode> = [
  ...Array.from({ length: 7 }, (_, index) =>
    mesh({
      key: `arrow:${index}`,
      position: [(index - 3) * 0.13, 0.002, 1.6 + Math.abs(index - 3) * 0.16],
      // A three-sided circle is a triangle; turned flat, point down the lane.
      rotation: fixed([-Math.PI / 2, 0, Math.PI / 2]),
      geometry: circle({ radius: 0.05, segments: 3 }),
      material: markMaterial,
    }),
  ),
  ...Array.from({ length: 5 }, (_, index) =>
    mesh({
      key: `dot:${index}`,
      position: [(index - 2) * 0.18, 0.002, 4.6],
      rotation: fixed([-Math.PI / 2, 0, 0]),
      geometry: circle({ radius: 0.018, segments: 12 }),
      material: markMaterial,
    }),
  ),
];

/** Sensors: one at each pin's head, named for it, and the pit. */
const sensors: SceneNode = group({
  key: 'sensors',
  body: body({
    type: 'fixed',
    sensor: true,
    colliders: [
      ...spots.map(({ id, at }) =>
        cuboidCollider({
          name: `spot:${id}`,
          halfExtents: [0.04, 0.03, 0.04],
          position: [at[0], pinHeight - 0.07, at[2]],
        }),
      ),
      cuboidCollider({
        name: 'pit',
        halfExtents: [1, 0.3, 0.7],
        position: [0, -0.3, lane.far - 0.8],
      }),
    ],
  }),
  children: [],
});

const pinWhite = phong({ color: 0xf6f3ee, shininess: 90 });
const pinStripe = phong({ color: 0xd94a3d, shininess: 90 });

const pin = (model: Model, id: string, at: Vec3): SceneNode =>
  group({
    key: pinKey(model, id),
    position: [at[0], pinHeight / 2, at[2]],
    body: body({
      mass: 1.5,
      friction: 0.4,
      restitution: 0.3,
      colliders: [capsuleCollider({ halfHeight: pinMiddle / 2, radius: pinRadius })],
    }),
    children: [
      mesh({
        key: `${pinKey(model, id)}:body`,
        geometry: capsule({ radius: pinRadius, height: pinMiddle, radialSegments: 20 }),
        material: pinWhite,
        castShadow: true,
      }),
      mesh({
        key: `${pinKey(model, id)}:stripe`,
        position: [0, pinMiddle / 2 - 0.02, 0],
        rotation: fixed([Math.PI / 2, 0, 0]),
        geometry: torus({
          radius: pinRadius * 0.97,
          tube: 0.009,
          radialSegments: 8,
          tubularSegments: 24,
        }),
        material: pinStripe,
      }),
    ],
  });

/** The pins drawn: those standing, or while a roll is in play, all that stood when it began. */
const pinsShown = (model: Model): ReadonlyArray<SceneNode> => {
  const inPlay = model.phase === 'rolling' || model.phase === 'settling';
  const shown = inPlay ? model.before : model.standing;
  return spots.filter(({ id }) => shown.includes(id)).map(({ id, at }) => pin(model, id, at));
};

const ballGeometry = sphere({ radius: ballRadius, widthSegments: 32, heightSegments: 20 });
const ballMaterial = physical({
  color: paintColour.blue,
  roughness: 0.15,
  metalness: 0.1,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
});

/**
 * While aiming, a dashed line down the lane from the ball (Drei's `Line`): where it will
 * go, longer the faster it will leave.
 */
const aimGuide = (model: Model): ReadonlyArray<SceneNode> => {
  if (model.phase !== 'aiming') return [];
  const radians = (model.angle * Math.PI) / 180;
  const reach = 1.5 + model.speed * 0.6;
  const start: Vec3 = [model.aim, 0.006, lane.near - 0.5];
  const end: Vec3 = [
    start[0] + Math.sin(radians) * reach,
    0.006,
    start[2] - Math.cos(radians) * reach,
  ];
  return [
    line({
      key: 'aim-guide',
      points: [start, end],
      vertexColors: [paintColour.gold, 0xffffff],
      width: 3,
      dashed: true,
      dashSize: 0.25,
      gapSize: 0.15,
      worldUnits: false,
      transparent: true,
      opacity: 0.9,
    }),
  ];
};

/**
 * The ball at the foul line where the Model aims it. Waiting, it is only something to
 * look at; rolled, it is a fresh body made with its impulse, so the roll starts from the
 * same state however long the player took to aim (ADR-011).
 */
const ball = (model: Model): SceneNode => {
  const position: Vec3 = [model.aim, ballRadius + 0.002, lane.near - 0.5];
  if (model.phase !== 'rolling' && model.phase !== 'settling') {
    return mesh({
      key: readyBallKey(model),
      position,
      geometry: ballGeometry,
      material: ballMaterial,
      castShadow: true,
    });
  }
  const radians = (model.angle * Math.PI) / 180;
  const impulse: Vec3 = [
    Math.sin(radians) * model.speed * ballMass,
    0,
    -Math.cos(radians) * model.speed * ballMass,
  ];
  return mesh({
    key: ballKey(model),
    position,
    geometry: ballGeometry,
    material: ballMaterial,
    castShadow: true,
    body: body({
      collider: 'ball',
      mass: ballMass,
      friction: 0.12,
      restitution: 0.05,
      ccd: true,
      contactForces: 120,
      impulse: { id: model.shot, impulse },
    }),
  });
};

/** The scoresheet line: each frame's marks, strikes and spares in gold. */
/** The scoreboard's text, and the colour ranges that pick out strikes and spares. */
export type Sheet = { readonly text: string; readonly ranges: ReadonlyArray<LabelColorRange> };

export const sheet = (model: Model): Sheet => {
  const scored = frames(model.rolls);
  const cells = Array.from({ length: 10 }, (_, index) => {
    const frame = scored[index];
    return frame === undefined ? '·' : marks(frame);
  });
  const top = cells.join('  |  ');
  const text = `${top}\nSCORE ${score(model.rolls)}`;
  const ranges: Array<LabelColorRange> = [colorRange(0, 0xe6e3dc)];
  [...top].forEach((character, index) => {
    if (character === 'X' || character === '/') {
      ranges.push(colorRange(index, paintColour.gold), colorRange(index + 1, 0xe6e3dc));
    }
  });
  ranges.push(colorRange(top.length + 1, paintColour.periwinkle));
  return { text, ranges };
};

const scoreboardAt: Vec3 = [0, 1.75, lane.far - 1.5];

const scoreboard = (model: Model): ReadonlyArray<SceneNode> => {
  const { text, ranges } = sheet(model);
  const block: Block | undefined = model.layout ?? undefined;
  return [
    ...(block === undefined
      ? []
      : [
          mesh({
            key: 'scoreboard:panel',
            position: [
              scoreboardAt[0] + (block[0] + block[2]) / 2,
              scoreboardAt[1] + (block[1] + block[3]) / 2,
              scoreboardAt[2] - 0.02,
            ],
            geometry: plane({
              width: block[2] - block[0] + 0.5,
              height: block[3] - block[1] + 0.35,
            }),
            material: standard({
              color: 0x14161c,
              roughness: 0.6,
              emissive: 0x1d2433,
              emissiveIntensity: 1,
            }),
          }),
        ]),
    label({
      key: 'scoreboard',
      text,
      font: `${model.assetBase}inter-latin-400-normal.woff`,
      fontSize: 0.24,
      lineHeight: 1.5,
      textAlign: 'center',
      position: scoreboardAt,
      color: 0xe6e3dc,
      colorRanges: ranges,
    }),
  ];
};

/**
 * A jolt for each strike (Drei's `CameraShake`, decaying): the strike count is the
 * trigger, so every new strike shakes once and settles within a second.
 */
const strikeShake = (count: number) =>
  count === 0
    ? null
    : cameraShake({
        decay: true,
        intensity: 0.8,
        decayRate: 1,
        maxYaw: 0.012,
        maxPitch: 0.02,
        maxRoll: 0.015,
        yawFrequency: 7,
        pitchFrequency: 9,
        rollFrequency: 6,
        trigger: count,
      });

export const sceneFor = (model: Model) =>
  scene({
    camera: { ...model.camera, shake: strikeShake(strikes(model.rolls)) },
    gestures: 'scene',
    physics: physics(),
    measure: ['scoreboard'],
    environment: environment({ environmentIntensity: 0.5 }),
    contactShadows: contactShadows({
      position: [0, 0.003, -4.4],
      size: 3,
      far: 0.6,
      blur: 1.5,
      opacity: 0.5,
    }),
    render: renderSettings({ shadows: 'soft', toneMapping: 'aces', exposure: 1 }),
    children: [
      hemisphereLight({ key: 'sky', color: 0xdbe6ff, groundColor: 0x2a2018, intensity: 0.6 }),
      directionalLight({
        key: 'key',
        position: [2, 6, 3],
        intensity: 1.2,
        castShadow: true,
        shadowArea: 14,
      }),
      spotLight({
        key: 'pin-light',
        position: [0, 3.2, -3.4],
        target: [0, 0, -5.4],
        intensity: 30,
        angle: 0.6,
        penumbra: 0.6,
        decay: 2,
        castShadow: true,
      }),
      floor,
      ...alley,
      ...laneMarks,
      sensors,
      ...pinsShown(model),
      ball(model),
      ...aimGuide(model),
      ...scoreboard(model),
    ],
  });

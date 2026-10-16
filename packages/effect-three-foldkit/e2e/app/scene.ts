/** The test app's scene: plain data derived from the model. */
import {
  ambientLight,
  box,
  directionalLight,
  mesh,
  perspectiveCamera,
  scene,
  sharedGeometry,
  bloom,
  borrowed,
  type Camera,
  fixed,
  play,
  renderSettings,
  renderTexture,
  text,
  type SceneNode,
  spin,
  standard,
  vignette,
} from '@opsydyn/effect-three';

const glowing = renderSettings({
  effects: [bloom({ strength: 2, threshold: 0 }), vignette({ darkness: 1.4 })],
});
const plain = renderSettings();

const colours = { red: 0xd94040, blue: 0x3366ff } as const;
const edges = { small: 1, large: 1.5 } as const;

const motions = { spin: spin({ axis: 'y', radiansPerSecond: 1 }), still: fixed([0, 0.6, 0]) };

export type Colour = keyof typeof colours;
export type Motion = keyof typeof motions;
export type Size = keyof typeof edges;

/** Extras the asset test switches on: the loaded robot, and a texture on the cube. */
export type Extras = {
  readonly robot: boolean;
  readonly textured: boolean;
  readonly glow?: boolean;
  /** Shows a render texture on the cube: a small scene with a green background. */
  readonly screen?: boolean;
  /** A title in the loaded block font, above the cube. */
  readonly title?: boolean;
  /** An orbiting camera from the Model: the scene claims gestures while it is set. */
  readonly orbit?: Camera;
};

/** Where the camera starts, and where the orbit test starts it. */
export const homeCamera = perspectiveCamera({ position: [0, 0, 4] });

const noExtras: Extras = { robot: false, textured: false };

/** A render texture: its own little scene, drawn into a texture the cube uses as its map. */
const screen = renderTexture({
  id: 'screen',
  width: 128,
  height: 128,
  camera: perspectiveCamera({ position: [0, 0, 3] }),
  background: 0x20c040,
  children: [
    ambientLight({ key: 'screen-light', intensity: 1 }),
    mesh({
      key: 'screen-box',
      geometry: box({ width: 0.5, height: 0.5, depth: 0.5 }),
      material: standard({ color: 0xffffff }),
    }),
  ],
});

/** "HI" in the block font: empty until the font is lent, then drawn. */
const titleNode: ReadonlyArray<SceneNode> = [
  mesh({
    key: 'title',
    position: [0, 1.1, 0],
    geometry: text({ text: 'HI', font: 'block', size: 0.6, depth: 0.1, center: true }),
    material: standard({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 }),
  }),
];

const robotNode: ReadonlyArray<SceneNode> = [
  borrowed({
    key: 'robot',
    id: 'robot',
    position: [1.4, -1.2, 0],
    scale: [0.8, 0.8, 0.8],
    animation: play('wave'),
    interactive: true,
  }),
];

export const sceneFor = (
  colour: Colour,
  size: Size = 'small',
  motion: Motion = 'spin',
  extras: Extras = noExtras,
) =>
  scene({
    camera: extras.orbit ?? homeCamera,
    gestures: extras.orbit === undefined ? 'page' : 'scene',
    render: extras.glow === true ? glowing : plain,
    renderTextures: extras.screen === true ? [screen] : [],
    resources: {
      geometries: [
        {
          id: 'cube',
          geometry: box({ width: edges[size], height: edges[size], depth: edges[size] }),
        },
      ],
    },
    children: [
      ambientLight({ key: 'ambient', intensity: 0.4 }),
      directionalLight({ key: 'sun', intensity: 2, position: [2, 3, 4] }),
      mesh({
        key: 'cube',
        geometry: sharedGeometry('cube'),
        material: standard({
          color: extras.screen === true ? 0xffffff : colours[colour],
          roughness: 0.6,
          map: extras.screen === true ? 'screen' : extras.textured ? 'checker' : null,
        }),
        rotation: motions[motion],
        interactive: true,
      }),
      ...(extras.robot ? robotNode : []),
      ...(extras.title === true ? titleNode : []),
    ],
  });

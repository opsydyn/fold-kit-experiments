/**
 * The editor's scene: the document's nodes, picked and the selected ones lit, a marker
 * for each light so it can be picked and moved, the editor's own floor and lights, the
 * transform gizmo on the selection and the viewport gizmo in the HUD. Everything the
 * editor adds is keyed `editor:…` or `marker:…`, apart from what a file can hold.
 */
import {
  box,
  basic,
  moodStaging,
  fixed,
  type MaterialRef,
  mesh,
  renderSettings,
  scene,
  type SceneNode,
  shaderGrid,
  sphere,
  standard,
} from '@opsydyn/effect-three';
import { BoxSelect, TransformGizmo, ViewportGizmo } from '@opsydyn/effect-three-foldkit';
import { Array as Arr, Option } from 'effect';

import { markerKey, placementOf, selectableOf } from './document';
import type { Model } from './model';

const glow = 0x3d79fa;

/** A selected mesh's material, lit faintly where its kind can glow. */
const lit = (material: MaterialRef): MaterialRef => {
  if ('emissiveIntensity' in material)
    return { ...material, emissive: glow, emissiveIntensity: 0.4 };
  // Lambert and Phong glow without an intensity: a darker blue, as faint.
  if (!('emissive' in material)) return material;
  // SAFETY: `material` has `emissive`, so this is the same kind with only its colour changed.
  return { ...material, emissive: 0x18306a } as MaterialRef;
};

/** What is marked: what the selection box holds while drawn, else what is selected. */
const markedKeys = (model: Model): ReadonlyArray<string> =>
  BoxSelect.drawing(model.box)
    ? BoxSelect.inside(model.box, model.camera, selectableOf(model.nodes))
    : model.selected;

/** A document node as the editor shows it: picked, and lit when marked. */
const shown = (node: SceneNode, marked: boolean): SceneNode => {
  if (node._tag === 'Mesh') {
    return { ...node, interactive: true, material: marked ? lit(node.material) : node.material };
  }
  if (!('interactive' in node)) return node;
  // SAFETY: `node` has `interactive`, so this is the same kind with only that changed.
  return { ...node, interactive: true } as SceneNode;
};

/** A light's marker: a small ball where it is, in its colour, for picking it. */
const markerFor = (node: SceneNode, marked: boolean): ReadonlyArray<SceneNode> =>
  node._tag === 'PointLight' || node._tag === 'SpotLight' || node._tag === 'DirectionalLight'
    ? [
        mesh({
          key: markerKey(node.key),
          position: placementOf(node).position,
          geometry: sphere({ radius: 0.12, widthSegments: 16, heightSegments: 8 }),
          material: basic({ color: marked ? glow : node.color }),
          interactive: true,
        }),
      ]
    : [];

const gizmoFor = (model: Model): ReadonlyArray<SceneNode> =>
  Option.match(
    Option.flatMap(Arr.head(model.selected), (key) =>
      Arr.findFirst(model.nodes, (node) => node.key === key),
    ),
    {
      onNone: () => [],
      onSome: (node) => [TransformGizmo.nodes(model.gizmo, placementOf(node), model.camera)],
    },
  );

export const sceneFor = (model: Model) => {
  const marked = markedKeys(model);
  const staging = moodStaging(model.mood, 'editor');
  return scene({
    camera: model.camera,
    gestures: 'scene',
    hud: ViewportGizmo.hud(model.view, model.camera),
    environment: staging.environment,
    sky: staging.sky,
    render: renderSettings({ shadows: 'soft', toneMapping: 'aces' }),
    resources: model.resources,
    children: [
      ...staging.lights,
      mesh({
        key: 'editor:floor',
        position: [0, -0.02, 0],
        rotation: fixed([-Math.PI / 2, 0, 0]),
        geometry: box({ width: 12, height: 12, depth: 0.02 }),
        material: standard({ color: 0xd9d6cf, roughness: 0.95 }),
        receiveShadow: true,
      }),
      shaderGrid({
        key: 'editor:grid',
        size: [12, 12],
        cellSize: 0.25,
        sectionSize: 1,
        fadeDistance: 18,
      }),
      ...model.nodes.map((node) => shown(node, marked.includes(node.key))),
      ...model.nodes.flatMap((node) => markerFor(node, marked.includes(node.key))),
      ...gizmoFor(model),
    ],
  });
};

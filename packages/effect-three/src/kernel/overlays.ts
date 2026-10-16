/**
 * Where each overlay's point is on the canvas, worked out for every frame the scene draws.
 *
 * Behavioural reference: Drei `src/web/Html.tsx` at `bf6f4ad`, without `transform`:
 * `defaultCalculatePosition` (project to CSS pixels), `isObjectBehindCamera`,
 * `isObjectVisible` (raycast occlusion against the scene), `objectScale` with
 * `distanceFactor`, and `objectZIndex` over `zIndexRange`.
 *
 * @module
 */
import {
  type Camera,
  type Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Vector2,
  Vector3,
} from 'three';

import type { Overlay } from './description.ts';
import type { HostedView, SceneGraph } from './sceneGraph.ts';

/** Where to show one overlay's HTML, in CSS pixels from the canvas's top left. */
export type OverlayPlacement = {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  /** 1, or the distance scale when the overlay has a `distanceFactor`. */
  readonly scale: number;
  readonly zIndex: number;
  /** False behind the camera, or behind a mesh when the overlay occludes. */
  readonly visible: boolean;
  readonly center: boolean;
};

const point = new Vector3();
const cameraPosition = new Vector3();
const direction = new Vector3();
const toPoint = new Vector3();
const ndc = new Vector2();
const raycaster = new Raycaster();

/** The camera and area an overlay is shown through. */
type Lens = {
  readonly camera: Camera;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const lensFor = (graph: SceneGraph, overlay: Overlay): Lens => {
  const views = graph.views();
  const view: HostedView | undefined =
    overlay.view === null ? views[0] : views.find((candidate) => candidate.key === overlay.view);
  if (view !== undefined) return { camera: view.camera, ...view.area };
  const { width, height } = graph.viewport();
  return { camera: graph.camera, x: 0, y: 0, width, height };
};

/** The overlay's point in world space: relative to its node, or as given. */
const worldPoint = (graph: SceneGraph, overlay: Overlay): Vector3 => {
  point.fromArray(overlay.position);
  const node: Object3D | undefined = overlay.node === null ? undefined : graph.object(overlay.node);
  return node === undefined ? point : node.localToWorld(point);
};

/** Drei's `isObjectBehindCamera`: more than 90° from where the camera looks. */
const behind = (camera: Camera, at: Vector3): boolean => {
  cameraPosition.setFromMatrixPosition(camera.matrixWorld);
  toPoint.copy(at).sub(cameraPosition);
  return toPoint.angleTo(camera.getWorldDirection(direction)) > Math.PI / 2;
};

/** Drei's `isObjectVisible`: nothing in the scene is hit before the point. */
const unoccluded = (graph: SceneGraph, camera: Camera, at: Vector3): boolean => {
  toPoint.copy(at).project(camera);
  ndc.set(toPoint.x, toPoint.y);
  raycaster.setFromCamera(ndc, camera);
  const [nearest] = raycaster.intersectObjects(graph.scene.children, true);
  return nearest === undefined || at.distanceTo(raycaster.ray.origin) < nearest.distance;
};

/** Drei's `objectScale`: one over the height of the view at the point's distance. */
const objectScale = (camera: Camera, at: Vector3): number => {
  if (camera instanceof OrthographicCamera) return camera.zoom;
  if (!(camera instanceof PerspectiveCamera)) return 1;
  cameraPosition.setFromMatrixPosition(camera.matrixWorld);
  const height = 2 * Math.tan((camera.fov * Math.PI) / 360) * at.distanceTo(cameraPosition);
  return 1 / height;
};

/** Drei's `objectZIndex`: linear in distance from near (`range[0]`) to far (`range[1]`). */
const zIndexOf = (camera: Camera, at: Vector3, range: readonly [number, number]): number => {
  if (!(camera instanceof PerspectiveCamera || camera instanceof OrthographicCamera)) return 0;
  cameraPosition.setFromMatrixPosition(camera.matrixWorld);
  const slope = (range[1] - range[0]) / (camera.far - camera.near);
  const offset = range[1] - slope * camera.far;
  return Math.round(slope * at.distanceTo(cameraPosition) + offset);
};

const place = (graph: SceneGraph, overlay: Overlay): OverlayPlacement => {
  const lens = lensFor(graph, overlay);
  lens.camera.updateMatrixWorld();
  const at = worldPoint(graph, overlay);
  const visible =
    !behind(lens.camera, at) && (!overlay.occlude || unoccluded(graph, lens.camera, at));
  const scale =
    overlay.distanceFactor === null ? 1 : objectScale(lens.camera, at) * overlay.distanceFactor;
  const zIndex = zIndexOf(lens.camera, at, overlay.zIndexRange);
  toPoint.copy(at).project(lens.camera);
  return {
    key: overlay.key,
    x: lens.x + ((toPoint.x + 1) / 2) * lens.width,
    y: lens.y + ((1 - toPoint.y) / 2) * lens.height,
    scale,
    zIndex,
    visible,
    center: overlay.center,
  };
};

/** Places every overlay of the graph's scene, after its world matrices are current. */
export const placeOverlays = (graph: SceneGraph): ReadonlyArray<OverlayPlacement> => {
  const overlays = graph.overlays();
  if (overlays.length === 0) return [];
  graph.scene.updateMatrixWorld();
  return overlays.map((overlay) => place(graph, overlay));
};

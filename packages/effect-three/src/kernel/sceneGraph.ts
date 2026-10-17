/**
 * The hosted three.js scene graph: applies diff operations to real three.js objects.
 *
 * `reconcile` is atomic: an invalid description is rejected before anything changes.
 * Objects keep their identity across updates; only a change of node kind replaces one.
 *
 * @module
 */
import {
  AmbientLight,
  Color,
  AnimationClip,
  AnimationMixer,
  type BufferGeometry,
  DirectionalLight,
  Group,
  GridHelper,
  HemisphereLight,
  Mesh,
  type Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PointLight,
  Scene,
  SpotLight,
  Vector3,
} from 'three';
import { Sky as SkyMesh } from 'three/addons/objects/Sky.js';

import { clipRunning, clipTime } from './animation.ts';
import { writeRotation } from './behaviours.ts';
import { type BodiedMesh, createBodyHost } from './bodies.ts';
import { renderSettings, scene as describeScene } from './build.ts';
import { createCameraMotion } from './cameraMotion.ts';
import type {
  AmbientLightNode,
  BorrowedNode,
  DirectionalLightNode,
  GridNode,
  HemisphereLightNode,
  GroupNode,
  Instance,
  InstancesNode,
  MeshNode,
  Camera as CameraDescription,
  PointLightNode,
  RenderSettings,
  SceneDescription,
  SceneNode,
  SpotLightNode,
  ContactShadows,
  Environment,
  Gestures,
  Overlay,
  Sky,
  Xr,
  RenderTexture,
  Vec3,
  View,
  ViewRect,
} from './description.ts';
import { diff, type Field, type Op } from './diff.ts';
import { contactShadowsEquals, environmentEquals, overlaysEqual, skyEquals } from './equality.ts';
import { createInstances, fits, type HostInstances, writeInstances } from './instances.ts';
import type { HostMaterial } from './materials.ts';
import {
  type Behaviour,
  type BehaviourPose,
  builtinBehaviours,
  createPose,
  resetPose,
} from './motion.ts';
import type { Collision, PhysicsEngine } from './physics.ts';
import { createResourceStore, type ResourceStore } from './resources.ts';
import {
  type DescriptionError,
  emptyIndex,
  indexScene,
  type ParentKey,
  type SceneIndex,
} from './sceneIndex.ts';
import { applyTween, startTween, type Tween } from './tween.ts';

/** The mesh type the kernel hosts. */
export type HostMesh = Mesh<BufferGeometry, HostMaterial>;

type Entry =
  | { readonly _tag: 'Group'; node: GroupNode; readonly object: Group }
  | { readonly _tag: 'Mesh'; node: MeshNode; readonly object: HostMesh }
  // Mutable: growing past capacity swaps in a larger InstancedMesh under the same entry.
  | { readonly _tag: 'Instances'; node: InstancesNode; object: HostInstances }
  // `shown` is the lent object (or a clone of it) inside the wrapper, when one is lent.
  | {
      readonly _tag: 'Borrowed';
      node: BorrowedNode;
      readonly object: Group;
      shown: Object3D | undefined;
      player: Player | undefined;
    }
  | { readonly _tag: 'AmbientLight'; node: AmbientLightNode; readonly object: AmbientLight }
  | {
      readonly _tag: 'DirectionalLight';
      node: DirectionalLightNode;
      readonly object: DirectionalLight;
    }
  | { readonly _tag: 'PointLight'; node: PointLightNode; readonly object: PointLight }
  | { readonly _tag: 'SpotLight'; node: SpotLightNode; readonly object: SpotLight }
  | {
      readonly _tag: 'Grid';
      node: GridNode;
      /** Positions the grid; the lines inside are rebuilt when their shape changes. */
      readonly object: Group;
      helper: GridHelper;
    }
  | {
      readonly _tag: 'HemisphereLight';
      node: HemisphereLightNode;
      readonly object: HemisphereLight;
    };

/** Entries with a transform: position, rotation, scale and transitions. */
/** A clip playing on a borrowed object: its mixer, length and scene-time start. */
type Borrowing = Extract<Entry, { readonly _tag: 'Borrowed' }>;

type Player = {
  readonly mixer: AnimationMixer;
  readonly duration: number;
  readonly startedAt: number;
};

/** Descriptions with a transform. */
type PlacedNode = GroupNode | MeshNode | InstancesNode | BorrowedNode;

type Placed = Extract<Entry, { readonly _tag: 'Group' | 'Mesh' | 'Instances' | 'Borrowed' }>;

/** Entries drawing a geometry with a material. */
type Surfaced = Extract<Entry, { readonly _tag: 'Mesh' | 'Instances' }>;

const isPlaced = (entry: Entry): entry is Placed =>
  entry._tag === 'Group' ||
  entry._tag === 'Mesh' ||
  entry._tag === 'Instances' ||
  entry._tag === 'Borrowed';

const isSurfaced = (entry: Entry): entry is Surfaced =>
  entry._tag === 'Mesh' || entry._tag === 'Instances';

/** A render texture as hosted: its id, size and the nested graph that draws it. */
export type HostedTexture = {
  readonly id: string;
  readonly graph: SceneGraph;
  readonly width: number;
  readonly height: number;
};

/** A view as hosted: its key, its camera and its rectangle in CSS pixels from the top left. */
export type HostedView = {
  readonly key: string;
  readonly camera: HostCamera;
  readonly area: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
};

export type ReconcileResult =
  | { readonly _tag: 'Applied'; readonly ops: ReadonlyArray<Op> }
  | { readonly _tag: 'Invalid'; readonly error: DescriptionError };

export type SceneGraphOptions = {
  /** A store shared with other graphs. When omitted the graph owns a private store. */
  readonly store?: ResourceStore;
  /** Behaviours nodes may name, in addition to the built-in ones (`float`). */
  readonly behaviours?: Readonly<Record<string, Behaviour>>;
  /** Simulates meshes with a `body` when the scene has `physics`; without it they stay put. */
  readonly physics?: PhysicsEngine | undefined;
};

export type SceneGraph = {
  readonly scene: Scene;
  /** The active camera. Changing the description's camera kind replaces it. */
  readonly camera: HostCamera;
  /** The scene's views, fitted to the viewport; empty when `camera` fills the canvas. */
  readonly views: () => ReadonlyArray<HostedView>;
  /** Render textures, each a nested graph to draw into its texture (by the frame loop). */
  readonly renderTextures: () => ReadonlyArray<HostedTexture>;
  /** Whether the scene claims the pointer's gestures from the page. */
  readonly gestures: () => Gestures;
  /** Points to show HTML at; the frame loop places them after drawing. */
  readonly overlays: () => ReadonlyArray<Overlay>;
  /** Image-based lighting and background; the frame loop applies it. */
  readonly environment: () => Environment | null;
  /** Soft ground shadows; the frame loop draws them. */
  readonly contactShadows: () => ContactShadows | null;
  /** Collisions between bodies since the last call, for the frame loop to report. */
  readonly collisions: () => ReadonlyArray<Collision>;
  /** How the scene is presented immersively, for the host; `null` if it never is. */
  readonly xr: () => Xr | null;
  /** Keys of the nodes whose bounds the frame loop reports. */
  readonly measured: () => ReadonlyArray<string>;
  readonly store: ResourceStore;
  /** Diffs against the last applied description and applies the result. */
  readonly reconcile: (next: SceneDescription) => ReconcileResult;
  /** Advances behaviours to `elapsedSeconds` of scene time. Allocation-free. */
  readonly tick: (elapsedSeconds: number) => void;
  /** Scene time of the last `tick`. */
  readonly elapsedSeconds: () => number;
  /**
   * The scene's current render settings. A new value (by reference) means they changed,
   * so the frame loop can reconfigure the renderer without comparing fields.
   */
  readonly renderSettings: () => RenderSettings;
  /**
   * While not animating (reduced motion, a paused debugger), transitions land at once and
   * any in flight finish, because frozen scene time would otherwise strand them mid-way.
   */
  readonly setAnimating: (animating: boolean) => void;
  /**
   * Whether the next frame would draw something new: after any change (reconcile, resize,
   * animation toggle, a shared resource changed elsewhere) or while something animates.
   */
  readonly needsFrame: () => boolean;
  /** Marks the current state as drawn. The frame loop calls it after each render. */
  readonly drawn: () => void;
  /** Calls `listener` whenever the graph changes in a way that needs a frame. */
  readonly onInvalidated: (listener: () => void) => () => void;
  /** The hosted object for a key. */
  readonly object: (key: string) => Object3D | undefined;
  /** The key of a hosted object. */
  readonly keyOf: (object: Object3D) => string | undefined;
  /** The key of instance `instanceId` of a hosted instances node, if it has one. */
  readonly instanceKeyOf: (object: Object3D, instanceId: number) => string | undefined;
  /**
   * Hosted objects of interactive meshes and groups (picking descends into groups). The
   * array is cached until the set changes and is mutable only because three's
   * `Raycaster.intersectObjects` requires it: don't modify it.
   */
  readonly interactiveObjects: () => Array<Object3D>;
  /** Fits the camera to a viewport of `width` by `height` CSS pixels. */
  readonly resize: (width: number, height: number) => void;
  /** The last `resize`, in CSS pixels. `1 × 1` until the first resize. */
  readonly viewport: () => { readonly width: number; readonly height: number };
  /** Removes every node and releases its resources. Disposes the store if the graph owns it. */
  readonly dispose: () => void;
};

const writeVec3 = (
  target: { set: (x: number, y: number, z: number) => unknown },
  v: Vec3,
): void => {
  target.set(v[0], v[1], v[2]);
};

type ShadowFields = {
  readonly castShadow: boolean;
  readonly shadowMapSize: number;
  readonly shadowBias: number;
};

/** Writes a light's shadow settings. A new map size drops the old map so three reallocates it. */
const writeShadow = (
  light: DirectionalLight | PointLight | SpotLight,
  fields: ShadowFields,
): void => {
  light.castShadow = fields.castShadow;
  light.shadow.bias = fields.shadowBias;
  if (light.shadow.mapSize.x !== fields.shadowMapSize) {
    light.shadow.mapSize.set(fields.shadowMapSize, fields.shadowMapSize);
    light.shadow.map?.dispose();
    light.shadow.map = null;
  }
};

const writeDirectionalLight = (light: DirectionalLight, node: DirectionalLightNode): void => {
  light.color.setHex(node.color);
  light.intensity = node.intensity;
  writeVec3(light.position, node.position);
  writeShadow(light, node);
  const camera = light.shadow.camera;
  if (camera.right !== node.shadowArea) {
    camera.left = -node.shadowArea;
    camera.right = node.shadowArea;
    camera.top = node.shadowArea;
    camera.bottom = -node.shadowArea;
    camera.updateProjectionMatrix();
  }
};

// Lights are cheap to write in full, so an update rewrites every field from the node.
const writePointLight = (light: PointLight, node: PointLightNode): void => {
  light.color.setHex(node.color);
  light.intensity = node.intensity;
  writeVec3(light.position, node.position);
  light.distance = node.distance;
  light.decay = node.decay;
  writeShadow(light, node);
};

const writeSpotLight = (light: SpotLight, node: SpotLightNode): void => {
  light.color.setHex(node.color);
  light.intensity = node.intensity;
  writeVec3(light.position, node.position);
  light.distance = node.distance;
  light.angle = node.angle;
  light.penumbra = node.penumbra;
  light.decay = node.decay;
  writeShadow(light, node);
  // The target is not in the scene graph (it is world space), so three never updates its
  // matrix: do it here, once per change.
  writeVec3(light.target.position, node.target);
  light.target.updateMatrixWorld();
};

/** Lines for a grid node: three.js's `GridHelper` takes its shape when constructed. */
const gridLines = (node: GridNode): GridHelper =>
  new GridHelper(node.size, node.divisions, node.centerColor, node.color);

const disposeGridLines = (lines: GridHelper): void => {
  lines.removeFromParent();
  lines.dispose();
};

const writeHemisphereLight = (light: HemisphereLight, node: HemisphereLightNode): void => {
  light.color.setHex(node.color);
  light.groundColor.setHex(node.groundColor);
  light.intensity = node.intensity;
  writeVec3(light.position, node.position);
};

/** The three.js camera kinds the kernel hosts. */
export type HostCamera = PerspectiveCamera | OrthographicCamera;

type Viewport = { readonly width: number; readonly height: number };

/**
 * Fits a camera's projection to the viewport. Perspective cameras take its aspect ratio;
 * orthographic frustums span it in CSS pixels, scaled by `zoom` (as React Three Fiber's
 * `updateCamera` in `core/utils.tsx` at `d74622e`).
 */
const fitCamera = (camera: HostCamera, viewport: Viewport): void => {
  if (camera instanceof OrthographicCamera) {
    camera.left = viewport.width / -2;
    camera.right = viewport.width / 2;
    camera.top = viewport.height / 2;
    camera.bottom = viewport.height / -2;
  } else {
    camera.aspect = viewport.width / viewport.height;
  }
  camera.updateProjectionMatrix();
};

/** A camera of the description's kind: `current` when it already is one, else a new one. */
const cameraFor = (current: HostCamera, description: CameraDescription): HostCamera => {
  if (description._tag === 'Perspective') {
    return current instanceof PerspectiveCamera ? current : new PerspectiveCamera();
  }
  return current instanceof OrthographicCamera ? current : new OrthographicCamera();
};

/** Applies the lens: field of view, near and far. Position, aim and zoom are the pose. */
const applyLens = (camera: HostCamera, description: CameraDescription): void => {
  if (camera instanceof PerspectiveCamera && description._tag === 'Perspective') {
    camera.fov = description.fov;
  }
  camera.near = description.near;
  camera.far = description.far;
};

/** Applies a description at once: lens and pose. */
const applyCamera = (camera: HostCamera, description: CameraDescription): void => {
  applyLens(camera, description);
  if (camera instanceof OrthographicCamera && description._tag === 'Orthographic') {
    camera.zoom = description.zoom;
  }
  writeVec3(camera.position, description.position);
  camera.lookAt(description.lookAt[0], description.lookAt[1], description.lookAt[2]);
};

const noInstances: ReadonlyArray<Instance> = [];

const emptyScene = describeScene({});

/** Creates an empty scene graph. */
export const createSceneGraph = (options: SceneGraphOptions = {}): SceneGraph => {
  const store = options.store ?? createResourceStore();
  const ownsStore = options.store === undefined;
  const scene = new Scene();
  let camera: HostCamera = new PerspectiveCamera();
  let views: ReadonlyArray<HostedView> = [];
  const textureGraphs = new Map<
    string,
    { readonly graph: SceneGraph; description: RenderTexture }
  >();
  let textureList: ReadonlyArray<HostedTexture> = [];
  let viewDescriptions: ReadonlyArray<View> = [];
  let gestures: Gestures = emptyScene.gestures;
  let overlayList: ReadonlyArray<Overlay> = emptyScene.overlays;
  let environmentDescription: Environment | null = emptyScene.environment;
  let skyDescription: Sky | null = emptyScene.sky;
  let contactDescription: ContactShadows | null = emptyScene.contactShadows;
  let xrDescription: Xr | null = emptyScene.xr;
  let measured: ReadonlyArray<string> = emptyScene.measure;
  let skyMesh: SkyMesh | undefined;

  /** Shows, updates or removes the sky. It belongs to the scene, so it is never picked. */
  const applySky = (description: Sky | null): void => {
    if (description === null) {
      removeSky();
      return;
    }
    if (skyMesh === undefined) {
      skyMesh = new SkyMesh();
      skyMesh.raycast = () => undefined;
      scene.add(skyMesh);
    }
    const { uniforms } = skyMesh.material;
    const set = (name: string, value: unknown): void => {
      const uniform = uniforms[name];
      if (uniform !== undefined) uniform.value = value;
    };
    set('turbidity', description.turbidity);
    set('rayleigh', description.rayleigh);
    set('mieCoefficient', description.mieCoefficient);
    set('mieDirectionalG', description.mieDirectionalG);
    set('cloudCoverage', description.clouds);
    set('sunPosition', new Vector3().fromArray(description.sunPosition));
    skyMesh.scale.setScalar(description.distance);
  };

  function removeSky(): void {
    if (skyMesh === undefined) return;
    skyMesh.removeFromParent();
    skyMesh.geometry.dispose();
    skyMesh.material.dispose();
    skyMesh = undefined;
  }
  const cameraMotion = createCameraMotion();
  const bodyHost = createBodyHost(options.physics, scene);

  /** Every hosted mesh, for the body host to find those with bodies. */
  function* hostedMeshes(): Generator<BodiedMesh> {
    for (const [key, entry] of entries) {
      if (entry._tag === 'Mesh') yield { key, node: entry.node, object: entry.object };
    }
  }

  /** The view's rectangle in CSS pixels, from its fractional rect and the viewport. */
  const areaOf = (rect: ViewRect): HostedView['area'] => ({
    x: rect.x * viewport.width,
    y: rect.y * viewport.height,
    width: Math.max(1, rect.width * viewport.width),
    height: Math.max(1, rect.height * viewport.height),
  });

  /** Hosts one described view, reusing `previous` when its kind is unchanged. */
  const hostView = (description: View, previous: HostCamera | undefined): HostedView => {
    const hostedCamera = cameraFor(previous ?? new PerspectiveCamera(), description.camera);
    applyCamera(hostedCamera, description.camera);
    const area = areaOf(description.rect);
    fitCamera(hostedCamera, area);
    return { key: description.key, camera: hostedCamera, area };
  };

  /** Hosts the described views, reusing each key's camera when its kind is unchanged. */
  const hostViews = (described: ReadonlyArray<View>): void => {
    const previous = new Map(views.map((hosted) => [hosted.key, hosted.camera]));
    viewDescriptions = described;
    views = described.map((description) => hostView(description, previous.get(description.key)));
  };
  const entries = new Map<string, Entry>();
  const keys = new WeakMap<Object3D, string>();
  const spinning = new Set<Entry>();
  const playing = new Set<Borrowing>();
  const registry: Readonly<Record<string, Behaviour>> = {
    ...builtinBehaviours,
    ...options.behaviours,
  };
  const knownBehaviours: ReadonlySet<string> = new Set(Object.keys(registry));
  // Each behaving entry keeps the pose last applied, so it can be taken off again.
  const behaving = new Map<
    Placed,
    { readonly behaviour: Behaviour; readonly pose: BehaviourPose }
  >();
  const moving = new Map<Entry, Tween>();
  const reparented = new Set<Entry>();
  const worldPosition = new Vector3();
  const interactive = new Set<Object3D>();
  let interactiveList: Array<Object3D> | undefined;
  let index: SceneIndex = emptyIndex;
  let elapsed = 0;
  let animating = true;
  let dirty = true;
  const invalidationListeners = new Set<() => void>();
  const invalidate = (): void => {
    dirty = true;
    for (const listener of invalidationListeners) listener();
  };
  let settings: RenderSettings = renderSettings();
  let viewport = { width: 1, height: 1 };

  const unsubscribeGeometry = store.onGeometryReplaced(({ previous, next }) => {
    for (const entry of entries.values()) {
      if (isSurfaced(entry) && entry.object.geometry === previous) entry.object.geometry = next;
    }
  });
  const unsubscribeShared = store.onSharedChanged(invalidate);
  const unsubscribeMaterial = store.onMaterialReplaced(({ previous, next }) => {
    for (const entry of entries.values()) {
      if (isSurfaced(entry) && entry.object.material === previous) entry.object.material = next;
    }
  });

  const trackInteractive = (object: Object3D, enabled: boolean): void => {
    const changed = enabled ? !interactive.has(object) : interactive.has(object);
    if (!changed) return;
    if (enabled) interactive.add(object);
    else interactive.delete(object);
    interactiveList = undefined;
  };

  const trackRotation = (entry: Entry, node: PlacedNode): void => {
    writeRotation(entry.object.rotation, node.rotation, elapsed);
    if (node.rotation._tag === 'Spin') spinning.add(entry);
    else spinning.delete(entry);
  };

  const build = (node: SceneNode): Entry => {
    switch (node._tag) {
      case 'Group': {
        const entry: Entry = { _tag: 'Group', node, object: new Group() };
        writeVec3(entry.object.position, node.position);
        writeVec3(entry.object.scale, node.scale);
        trackRotation(entry, node);
        trackBehaviour(entry, node);
        trackInteractive(entry.object, node.interactive);
        return entry;
      }
      case 'Mesh': {
        const object: HostMesh = new Mesh(
          store.acquireGeometry(node.geometry),
          store.acquireMaterial(node.material),
        );
        const entry: Entry = { _tag: 'Mesh', node, object };
        writeVec3(object.position, node.position);
        writeVec3(object.scale, node.scale);
        trackRotation(entry, node);
        trackBehaviour(entry, node);
        trackInteractive(object, node.interactive);
        object.castShadow = node.castShadow;
        object.receiveShadow = node.receiveShadow;
        return entry;
      }
      case 'Instances': {
        const object = createInstances(
          store.acquireGeometry(node.geometry),
          store.acquireMaterial(node.material),
          node.instances.length,
        );
        writeInstances(object, noInstances, node.instances);
        const entry: Entry = { _tag: 'Instances', node, object };
        writeVec3(object.position, node.position);
        writeVec3(object.scale, node.scale);
        trackRotation(entry, node);
        trackBehaviour(entry, node);
        trackInteractive(object, node.interactive);
        object.castShadow = node.castShadow;
        object.receiveShadow = node.receiveShadow;
        return entry;
      }
      case 'Borrowed': {
        const entry: Borrowing = {
          _tag: 'Borrowed',
          node,
          object: new Group(),
          shown: undefined,
          player: undefined,
        };
        writeVec3(entry.object.position, node.position);
        writeVec3(entry.object.scale, node.scale);
        trackRotation(entry, node);
        trackBehaviour(entry, node);
        trackInteractive(entry.object, node.interactive);
        showLoan(entry);
        return entry;
      }
      case 'AmbientLight':
        return { _tag: 'AmbientLight', node, object: new AmbientLight(node.color, node.intensity) };
      case 'DirectionalLight': {
        const object = new DirectionalLight();
        writeDirectionalLight(object, node);
        return { _tag: 'DirectionalLight', node, object };
      }
      case 'PointLight': {
        const object = new PointLight();
        writePointLight(object, node);
        return { _tag: 'PointLight', node, object };
      }
      case 'SpotLight': {
        const object = new SpotLight();
        writeSpotLight(object, node);
        return { _tag: 'SpotLight', node, object };
      }
      case 'Grid': {
        const object = new Group();
        const helper = gridLines(node);
        object.add(helper);
        writeVec3(object.position, node.position);
        return { _tag: 'Grid', node, object, helper };
      }
      case 'HemisphereLight': {
        const object = new HemisphereLight();
        writeHemisphereLight(object, node);
        return { _tag: 'HemisphereLight', node, object };
      }
    }
  };

  /**
   * Shows what is lent under the entry's id: the object itself, or a clone when another
   * borrowed node already shows it (an object can have only one parent).
   */
  const showLoan = (entry: Borrowing): void => {
    stopPlayer(entry);
    entry.shown?.removeFromParent();
    entry.shown = undefined;
    const lent = store.lent(entry.node.id);
    if (lent === undefined) return;
    const shown = lent.parent === null ? lent : lent.clone();
    entry.object.add(shown);
    entry.shown = shown;
    startPlayer(entry);
  };

  const stopPlayer = (entry: Borrowing): void => {
    if (entry.player === undefined) return;
    entry.player.mixer.stopAllAction();
    if (entry.shown !== undefined) entry.player.mixer.uncacheRoot(entry.shown);
    entry.player = undefined;
    playing.delete(entry);
  };

  /** Starts the node's clip on what it shows, from now in scene time, if both exist. */
  const startPlayer = (entry: Borrowing): void => {
    stopPlayer(entry);
    const animation = entry.node.animation;
    const shown = entry.shown;
    if (animation === null || shown === undefined) return;
    const clip = AnimationClip.findByName(shown.animations, animation.clip);
    if (clip === null) return;
    const mixer = new AnimationMixer(shown);
    mixer.clipAction(clip).play();
    entry.player = { mixer, duration: clip.duration, startedAt: elapsed };
    playing.add(entry);
    pose(entry);
  };

  /** Shows the clip's pose for the current scene time. */
  const pose = (entry: Borrowing): void => {
    const animation = entry.node.animation;
    if (entry.player === undefined || animation === null) return;
    const since = elapsed - entry.player.startedAt;
    entry.player.mixer.setTime(clipTime(animation, entry.player.duration, since));
  };

  /** Whether any clip still changes its pose, so frames are needed. */
  const clipsRunning = (): boolean => {
    for (const entry of playing) {
      const animation = entry.node.animation;
      if (entry.player === undefined || animation === null) continue;
      const since = elapsed - entry.player.startedAt;
      if (clipRunning(animation, entry.player.duration, since)) return true;
    }
    return false;
  };

  /** Re-applies owned materials that use a texture whose loan changed. */
  const refreshTexture = (id: string): void => {
    for (const entry of entries.values()) {
      if (!isSurfaced(entry)) continue;
      const material = entry.node.material;
      if (material._tag !== 'SharedMaterial' && 'map' in material && material.map === id) {
        store.updateOwnedMaterial(entry.object.material, material);
      }
    }
  };

  /** Rebuilds owned text whose font's loan changed; shared text the store rebuilds. */
  const refreshFont = (id: string): void => {
    for (const entry of entries.values()) {
      if (!isSurfaced(entry)) continue;
      const geometry = entry.node.geometry;
      if (geometry._tag === 'Text' && geometry.font === id) {
        store.releaseGeometry(geometry, entry.object.geometry);
        entry.object.geometry = store.acquireGeometry(geometry);
      }
    }
  };

  const unsubscribeLoans = store.onLoanChanged((loan) => {
    if (loan.kind === 'texture') refreshTexture(loan.id);
    else if (loan.kind === 'font') refreshFont(loan.id);
    else {
      for (const entry of entries.values()) {
        if (entry._tag === 'Borrowed' && entry.node.id === loan.id) showLoan(entry);
      }
    }
    invalidate();
  });

  /** Removes the last behaviour pose from the object, leaving its base transform. */
  const liftPose = (entry: Entry): void => {
    const motion = isPlaced(entry) ? behaving.get(entry) : undefined;
    if (motion === undefined) return;
    entry.object.position.sub(motion.pose.offset);
    const { x, y, z } = motion.pose.scale;
    if (x !== 0 && y !== 0 && z !== 0) entry.object.scale.divide(motion.pose.scale);
    resetPose(motion.pose);
  };

  /** Starts, changes or stops the node's behaviour. */
  const trackBehaviour = (entry: Placed, node: PlacedNode): void => {
    liftPose(entry);
    behaving.delete(entry);
    if (node.behaviour === null) {
      trackRotation(entry, node);
      return;
    }
    const behaviour = registry[node.behaviour.name];
    if (behaviour !== undefined) behaving.set(entry, { behaviour, pose: createPose() });
  };

  /** Composes the node's behaviour pose on top of its base transform for this frame. */
  const applyBehaviour = (
    motion: { readonly behaviour: Behaviour; readonly pose: BehaviourPose },
    entry: Placed,
  ): void => {
    const node = entry.node;
    if (node.behaviour === null) return;
    const object = entry.object;
    // Tweens have written this frame's base already; otherwise the base is the target.
    if (!moving.has(entry)) {
      writeVec3(object.position, node.position);
      writeVec3(object.scale, node.scale);
    }
    writeRotation(object.rotation, node.rotation, elapsed);
    resetPose(motion.pose);
    motion.behaviour(motion.pose, elapsed, node.behaviour.params);
    object.position.add(motion.pose.offset);
    object.scale.multiply(motion.pose.scale);
    object.rotation.x += motion.pose.rotation.x;
    object.rotation.y += motion.pose.rotation.y;
    object.rotation.z += motion.pose.rotation.z;
  };

  const release = (entry: Entry): void => {
    if (isPlaced(entry)) behaving.delete(entry);
    spinning.delete(entry);
    moving.delete(entry);
    reparented.delete(entry);
    trackInteractive(entry.object, false);
    if (isSurfaced(entry)) {
      store.releaseGeometry(entry.node.geometry, entry.object.geometry);
      store.releaseMaterial(entry.node.material, entry.object.material);
    }
    // Frees the instance buffers on the GPU; geometry and material belong to the store.
    if (entry._tag === 'Instances') entry.object.dispose();
    // A grid's lines are its own.
    if (entry._tag === 'Grid') disposeGridLines(entry.helper);
    // A borrowed object belongs to the application: detach it, never dispose it.
    if (entry._tag === 'Borrowed') {
      stopPlayer(entry);
      entry.shown?.removeFromParent();
      entry.shown = undefined;
    }
  };

  /**
   * Moves an instances entry into a larger InstancedMesh: same place in the tree, same
   * transform and key, geometry and material carried over, every slot rewritten.
   */
  const growInstances = (
    entry: Extract<Entry, { readonly _tag: 'Instances' }>,
    next: InstancesNode,
  ): void => {
    const old = entry.object;
    const grown = createInstances(old.geometry, old.material, next.instances.length);
    grown.position.copy(old.position);
    grown.quaternion.copy(old.quaternion);
    grown.scale.copy(old.scale);
    grown.castShadow = old.castShadow;
    grown.receiveShadow = old.receiveShadow;
    grown.name = old.name;
    const parent = old.parent;
    if (parent !== null) {
      const slot = parent.children.indexOf(old);
      old.removeFromParent();
      parent.add(grown);
      parent.children.pop();
      parent.children.splice(slot, 0, grown);
    }
    const key = keys.get(old);
    keys.delete(old);
    if (key !== undefined) keys.set(grown, key);
    const wasInteractive = interactive.has(old);
    trackInteractive(old, false);
    trackInteractive(grown, wasInteractive);
    old.dispose();
    entry.object = grown;
    writeInstances(grown, noInstances, next.instances);
  };

  /**
   * Moves the object towards a new position and scale: at once for `Instant` or while not
   * animating, otherwise by restarting the tween from the current rendered pose at the last
   * frame's time.
   */
  const retarget = (entry: Entry, node: PlacedNode): void => {
    liftPose(entry);
    if (!animating || node.transition._tag === 'Instant') {
      moving.delete(entry);
      writeVec3(entry.object.position, node.position);
      writeVec3(entry.object.scale, node.scale);
      return;
    }
    moving.set(entry, startTween(entry.object, node, elapsed, node.transition));
  };

  const movesTransform = (entry: Entry, fields: ReadonlyArray<Field>): boolean =>
    fields.includes('position') ||
    fields.includes('scale') ||
    (fields.includes('transition') && moving.has(entry));

  const update = (entry: Entry, next: SceneNode, fields: ReadonlyArray<Field>): void => {
    if (entry._tag === 'Instances' && next._tag === 'Instances' && fields.includes('instances')) {
      if (fits(entry.object, next.instances.length)) {
        writeInstances(entry.object, entry.node.instances, next.instances);
      } else {
        growInstances(entry, next);
      }
    }
    if (
      (entry._tag === 'Mesh' && next._tag === 'Mesh') ||
      (entry._tag === 'Instances' && next._tag === 'Instances')
    ) {
      const prev = entry.node;
      const mesh = entry.object;
      for (const field of fields) {
        if (field === 'geometry') {
          store.releaseGeometry(prev.geometry, mesh.geometry);
          mesh.geometry = store.acquireGeometry(next.geometry);
        } else if (field === 'material') {
          const updatedInPlace =
            prev.material._tag !== 'SharedMaterial' &&
            next.material._tag !== 'SharedMaterial' &&
            store.updateOwnedMaterial(mesh.material, next.material);
          if (!updatedInPlace) {
            store.releaseMaterial(prev.material, mesh.material);
            mesh.material = store.acquireMaterial(next.material);
          }
        }
      }
      entry.node = next;
      if (movesTransform(entry, fields)) retarget(entry, next);
      if (fields.includes('rotation')) trackRotation(entry, next);
      if (fields.includes('behaviour')) trackBehaviour(entry, next);
      if (fields.includes('interactive')) trackInteractive(mesh, next.interactive);
      mesh.castShadow = next.castShadow;
      mesh.receiveShadow = next.receiveShadow;
      return;
    }
    if (entry._tag === 'Borrowed' && next._tag === 'Borrowed') {
      entry.node = next;
      if (movesTransform(entry, fields)) retarget(entry, next);
      if (fields.includes('rotation')) trackRotation(entry, next);
      if (fields.includes('behaviour')) trackBehaviour(entry, next);
      if (fields.includes('interactive')) trackInteractive(entry.object, next.interactive);
      if (fields.includes('id')) showLoan(entry);
      else if (fields.includes('animation')) startPlayer(entry);
      return;
    }
    if (entry._tag === 'Group' && next._tag === 'Group') {
      entry.node = next;
      if (movesTransform(entry, fields)) retarget(entry, next);
      if (fields.includes('rotation')) trackRotation(entry, next);
      if (fields.includes('behaviour')) trackBehaviour(entry, next);
      if (fields.includes('interactive')) trackInteractive(entry.object, next.interactive);
      return;
    }
    if (entry._tag === 'AmbientLight' && next._tag === 'AmbientLight') {
      entry.object.color.setHex(next.color);
      entry.object.intensity = next.intensity;
      entry.node = next;
      return;
    }
    if (entry._tag === 'DirectionalLight' && next._tag === 'DirectionalLight') {
      writeDirectionalLight(entry.object, next);
      entry.node = next;
      return;
    }
    if (entry._tag === 'PointLight' && next._tag === 'PointLight') {
      writePointLight(entry.object, next);
      entry.node = next;
      return;
    }
    if (entry._tag === 'SpotLight' && next._tag === 'SpotLight') {
      writeSpotLight(entry.object, next);
      entry.node = next;
      return;
    }
    if (entry._tag === 'HemisphereLight' && next._tag === 'HemisphereLight') {
      writeHemisphereLight(entry.object, next);
      entry.node = next;
      return;
    }
    if (entry._tag === 'Grid' && next._tag === 'Grid') {
      writeVec3(entry.object.position, next.position);
      if (fields.some((field) => field !== 'position')) {
        disposeGridLines(entry.helper);
        entry.helper = gridLines(next);
        entry.object.add(entry.helper);
      }
      entry.node = next;
      return;
    }
    throw new Error(`effect-three: update kind mismatch for "${next.key}"`);
  };

  const parentObject = (parent: ParentKey): Object3D => {
    if (parent === null) return scene;
    const entry = entries.get(parent);
    if (entry === undefined) throw new Error(`effect-three: missing parent "${parent}"`);
    return entry.object;
  };

  const register = (key: string, entry: Entry): void => {
    entries.set(key, entry);
    entry.object.name = key;
    keys.set(entry.object, key);
  };

  const apply = (op: Op): void => {
    switch (op._tag) {
      case 'SetCamera': {
        const previous = camera;
        camera = cameraFor(camera, op.camera);
        applyLens(camera, op.camera);
        // A new kind of camera has nothing on screen to travel from.
        cameraMotion.aim(camera, op.camera, elapsed, camera !== previous || !animating);
        fitCamera(camera, viewport);
        return;
      }
      case 'SetRenderSettings':
        settings = op.settings;
        return;
      case 'SetViews':
        hostViews(op.views);
        return;
      case 'DefineResources':
        store.define(op.resources);
        return;
      case 'Create': {
        const entry = build(op.node);
        register(op.node.key, entry);
        parentObject(op.parent).add(entry.object);
        return;
      }
      case 'Replace': {
        const old = entries.get(op.node.key);
        if (old === undefined) throw new Error(`effect-three: missing node "${op.node.key}"`);
        const entry = build(op.node);
        const target = parentObject(op.parent);
        // Children follow their parent key. Later Move/Remove ops settle any that leave.
        // Copy first: add() removes each child from the array being iterated.
        for (const child of old.object.children.slice()) entry.object.add(child);
        const position = old.object.parent === target ? target.children.indexOf(old.object) : -1;
        old.object.removeFromParent();
        target.add(entry.object);
        if (position >= 0) {
          target.children.pop();
          target.children.splice(position, 0, entry.object);
        }
        release(old);
        keys.delete(old.object);
        register(op.node.key, entry);
        return;
      }
      case 'Move': {
        const entry = entries.get(op.key);
        if (entry === undefined) throw new Error(`effect-three: missing node "${op.key}"`);
        const target = parentObject(op.parent);
        if (isPlaced(entry)) {
          // Keep the world position across the move; settle() then takes the node to its
          // new local position, instantly or along its transition.
          entry.object.getWorldPosition(worldPosition);
          target.add(entry.object);
          target.updateWorldMatrix(true, false);
          entry.object.position.copy(target.worldToLocal(worldPosition));
          reparented.add(entry);
        } else {
          target.add(entry.object);
        }
        return;
      }
      case 'Update': {
        const entry = entries.get(op.node.key);
        if (entry === undefined) throw new Error(`effect-three: missing node "${op.node.key}"`);
        update(entry, op.node, op.fields);
        return;
      }
      case 'Remove': {
        const entry = entries.get(op.key);
        if (entry === undefined) return;
        entry.object.removeFromParent();
        release(entry);
        entries.delete(op.key);
        keys.delete(entry.object);
        return;
      }
      case 'Order': {
        const parent = parentObject(op.parent);
        const ordered: Array<Object3D> = [];
        for (const key of op.keys) {
          const entry = entries.get(key);
          if (entry !== undefined) ordered.push(entry.object);
        }
        const managed = new Set(ordered);
        const unmanaged = parent.children.filter((child) => !managed.has(child));
        parent.children.splice(0, parent.children.length, ...ordered, ...unmanaged);
        return;
      }
    }
  };

  /** The scene a render texture draws: its camera and nodes, with the parent's resources. */
  const textureScene = (texture: RenderTexture, parent: SceneDescription): SceneDescription => ({
    camera: texture.camera,
    gestures: 'page',
    views: [],
    renderTextures: [],
    overlays: [],
    environment: null,
    sky: null,
    contactShadows: null,
    physics: null,
    xr: null,
    measure: [],
    render: parent.render,
    resources: parent.resources,
    children: texture.children,
  });

  /** A hosted render texture as the loop sees it; none if it is not hosted. */
  function hostedTexture(texture: RenderTexture): ReadonlyArray<HostedTexture> {
    const hosted = textureGraphs.get(texture.id);
    if (hosted === undefined) return [];
    return [{ id: texture.id, graph: hosted.graph, width: texture.width, height: texture.height }];
  }

  /**
   * Brings the hosted render textures in line with the description: nested graphs on the
   * same store, created, reconciled or disposed. Returns their operations.
   */
  const syncTextures = (next: SceneDescription): ReadonlyArray<Op> => {
    const ops: Array<Op> = [];
    const kept = new Set<string>();
    for (const texture of next.renderTextures) {
      kept.add(texture.id);
      const existing = textureGraphs.get(texture.id);
      const hosted = existing ?? {
        graph: createSceneGraph({
          store,
          ...(options.behaviours === undefined ? {} : { behaviours: options.behaviours }),
        }),
        description: texture,
      };
      const result = hosted.graph.reconcile(textureScene(texture, next));
      const reframed =
        existing === undefined ||
        existing.description.width !== texture.width ||
        existing.description.height !== texture.height ||
        existing.description.background !== texture.background;
      if (reframed) {
        hosted.graph.resize(texture.width, texture.height);
        hosted.graph.scene.background =
          texture.background === null ? null : new Color(texture.background);
      }
      hosted.description = texture;
      textureGraphs.set(texture.id, hosted);
      const subOps = result._tag === 'Applied' ? result.ops : [];
      if (reframed || subOps.length > 0) {
        ops.push({ _tag: 'UpdateRenderTexture', id: texture.id, ops: subOps });
      }
    }
    for (const [id, hosted] of textureGraphs) {
      if (kept.has(id)) continue;
      hosted.graph.dispose();
      textureGraphs.delete(id);
      ops.push({ _tag: 'RemoveRenderTexture', id });
    }
    // In the description's order, so a host draws them in the order they were written.
    // In the description's order, so a host draws them in the order they were written.
    textureList = next.renderTextures.flatMap((texture) => hostedTexture(texture));
    return ops;
  };

  const reconcile = (next: SceneDescription): ReconcileResult => {
    // Validate every render texture's scene first, so a bad one changes nothing at all.
    for (const texture of next.renderTextures) {
      const checked = indexScene(textureScene(texture, next), knownBehaviours);
      if (checked._tag === 'Invalid') return checked;
    }
    const result = diff(index, next, knownBehaviours);
    if (result._tag === 'Invalid') return result;
    for (const op of result.ops) apply(op);
    for (const entry of reparented) {
      if (isPlaced(entry)) retarget(entry, entry.node);
    }
    reparented.clear();
    index = result.index;
    // Gestures change how input is read, not what is drawn: no operation, no frame.
    gestures = next.gestures;
    // Overlays are placed when a frame is drawn: a change needs one, but no operation.
    if (!overlaysEqual(overlayList, next.overlays)) invalidate();
    overlayList = next.overlays;
    // The frame loop applies the environment, which may need the renderer: ask for a frame.
    if (!environmentEquals(environmentDescription, next.environment)) invalidate();
    environmentDescription = next.environment;
    if (!skyEquals(skyDescription, next.sky)) {
      applySky(next.sky);
      invalidate();
    }
    skyDescription = next.sky;
    // The frame loop draws contact shadows with the renderer: a change needs a frame.
    if (!contactShadowsEquals(contactDescription, next.contactShadows)) invalidate();
    contactDescription = next.contactShadows;
    bodyHost.sync(next.physics, hostedMeshes());
    // Read by the host when it presents the scene immersively: no operation, no frame.
    xrDescription = next.xr;
    // Measured after the next drawn frame; a new list needs one.
    if (next.measure.join('\u0000') !== measured.join('\u0000')) invalidate();
    measured = next.measure;
    const ops = [...result.ops, ...syncTextures(next)];
    if (ops.length > 0) invalidate();
    return { _tag: 'Applied', ops };
  };

  // Defined once so ticking allocates nothing; deleting during Map.forEach is safe.
  const stepTween = (tween: Tween, entry: Entry): void => {
    if (applyTween(entry.object, tween, elapsed)) moving.delete(entry);
  };

  const tick = (elapsedSeconds: number): void => {
    elapsed = elapsedSeconds;
    for (const texture of textureList) texture.graph.tick(elapsedSeconds);
    for (const entry of spinning) {
      if (isPlaced(entry)) {
        writeRotation(entry.object.rotation, entry.node.rotation, elapsed);
      }
    }
    moving.forEach(stepTween);
    for (const entry of playing) pose(entry);
    behaving.forEach(applyBehaviour);
    cameraMotion.step(camera, elapsed);
    // Last: a dynamic body's pose is the simulation's, whatever else moved the mesh.
    bodyHost.tick(elapsed, animating);
  };

  const finishTween = (tween: Tween, entry: Entry): void => {
    applyTween(entry.object, tween, Number.POSITIVE_INFINITY);
  };

  const setAnimating = (next: boolean): void => {
    if (next !== animating) invalidate();
    for (const texture of textureList) texture.graph.setAnimating(next);
    animating = next;
    if (next) return;
    moving.forEach(finishTween);
    moving.clear();
    cameraMotion.settle(camera);
  };

  const dispose = (): void => {
    removeSky();
    bodyHost.dispose();
    for (const texture of textureList) texture.graph.dispose();
    textureGraphs.clear();
    textureList = [];
    for (const entry of entries.values()) {
      entry.object.removeFromParent();
      release(entry);
    }
    entries.clear();
    index = emptyIndex;
    unsubscribeGeometry();
    unsubscribeMaterial();
    unsubscribeShared();
    unsubscribeLoans();
    invalidationListeners.clear();
    if (ownsStore) store.dispose();
  };

  return {
    scene,
    get camera() {
      return camera;
    },
    views: () => views,
    renderTextures: () => textureList,
    gestures: () => gestures,
    overlays: () => overlayList,
    environment: () => environmentDescription,
    contactShadows: () => contactDescription,
    collisions: bodyHost.drainCollisions,
    xr: () => xrDescription,
    measured: () => measured,
    store,
    reconcile,
    tick,
    elapsedSeconds: () => elapsed,
    renderSettings: () => settings,
    needsFrame: () =>
      dirty ||
      textureList.some((texture) => texture.graph.needsFrame()) ||
      (animating &&
        (spinning.size > 0 ||
          moving.size > 0 ||
          behaving.size > 0 ||
          clipsRunning() ||
          cameraMotion.moving() ||
          bodyHost.needsFrame())),
    drawn: () => {
      dirty = false;
    },
    onInvalidated: (listener) => {
      invalidationListeners.add(listener);
      return () => {
        invalidationListeners.delete(listener);
      };
    },
    setAnimating,
    object: (key) => entries.get(key)?.object,
    keyOf: (object) => keys.get(object),
    instanceKeyOf: (object, instanceId) => {
      const key = keys.get(object);
      const entry = key === undefined ? undefined : entries.get(key);
      return entry?._tag === 'Instances' ? entry.node.instances[instanceId]?.key : undefined;
    },
    interactiveObjects: () => {
      interactiveList ??= [...interactive];
      return interactiveList;
    },
    viewport: () => viewport,
    resize: (width, height) => {
      viewport = { width, height };
      fitCamera(camera, viewport);
      hostViews(viewDescriptions);
      invalidate();
    },
    dispose,
  };
};

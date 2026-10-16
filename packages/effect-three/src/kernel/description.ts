/**
 * Scene descriptions: plain, immutable data with no closures and no three.js objects.
 *
 * Descriptions are fully specified (normalised). Defaults are filled in by the public
 * constructors and the runtime Schema, so the kernel can diff without guessing.
 *
 * @module
 */

/** A three-component vector `[x, y, z]`. */
export type Vec3 = readonly [x: number, y: number, z: number];

/** A rotation axis for behaviours. */
export type Axis = 'x' | 'y' | 'z';

/** A colour as a 24-bit RGB integer, for example `0x3366ff`. */
export type Rgb = number;

/**
 * Rotation is owned by exactly one source (ADR: D4).
 *
 * - `Fixed`: the model owns the Euler angles.
 * - `Spin`: a behaviour owns them. The angle is a pure function of elapsed scene time:
 *   `phase + radiansPerSecond * elapsedSeconds` about `axis`, other axes zero.
 */
export type Rotation =
  | { readonly _tag: 'Fixed'; readonly euler: Vec3 }
  | {
      readonly _tag: 'Spin';
      readonly axis: Axis;
      readonly radiansPerSecond: number;
      readonly phase: number;
    };

/** Box geometry parameters. */
export type BoxGeometry = {
  readonly _tag: 'Box';
  readonly width: number;
  readonly height: number;
  readonly depth: number;
};

/** UV sphere geometry parameters. */
export type SphereGeometry = {
  readonly _tag: 'Sphere';
  readonly radius: number;
  readonly widthSegments: number;
  readonly heightSegments: number;
};

/** A flat rectangle in the XY plane, facing +Z. */
export type PlaneGeometry = {
  readonly _tag: 'Plane';
  readonly width: number;
  readonly height: number;
};

/** Cylinder (or cone, with one radius zero) along the Y axis. */
export type CylinderGeometry = {
  readonly _tag: 'Cylinder';
  readonly radiusTop: number;
  readonly radiusBottom: number;
  readonly height: number;
  readonly radialSegments: number;
};

/** A torus (ring doughnut) in the XY plane, around the Z axis. */
export type TorusGeometry = {
  readonly _tag: 'Torus';
  readonly radius: number;
  readonly tube: number;
  readonly radialSegments: number;
  readonly tubularSegments: number;
};

/** A cone along the Y axis, point up. */
export type ConeGeometry = {
  readonly _tag: 'Cone';
  readonly radius: number;
  readonly height: number;
  readonly radialSegments: number;
};

/** A capsule along the Y axis: a cylinder of `height` with hemispherical caps. */
export type CapsuleGeometry = {
  readonly _tag: 'Capsule';
  readonly radius: number;
  readonly height: number;
  readonly capSegments: number;
  readonly radialSegments: number;
};

/** A flat ring (annulus) in the XY plane, facing +Z. */
export type RingGeometry = {
  readonly _tag: 'Ring';
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly thetaSegments: number;
};

/** A flat disc in the XY plane, facing +Z. */
export type CircleGeometry = {
  readonly _tag: 'Circle';
  readonly radius: number;
  readonly segments: number;
};

/** Any geometry shape the kernel can build. */
export type ShapeGeometry =
  | BoxGeometry
  | SphereGeometry
  | PlaneGeometry
  | CylinderGeometry
  | TorusGeometry
  | ConeGeometry
  | CapsuleGeometry
  | RingGeometry
  | CircleGeometry;

/** Which faces a material draws. */
export type MaterialSide = 'front' | 'back' | 'double';

/** An unlit material: flat colour, unaffected by lights. */
export type BasicMaterial = {
  readonly _tag: 'Basic';
  readonly color: Rgb;
  /** Id of a texture lent to the store for the colour map, or `null` for none. */
  readonly map: string | null;
  readonly opacity: number;
  readonly transparent: boolean;
  readonly side: MaterialSide;
  readonly wireframe: boolean;
};

/** A matte (Lambertian) material: cheap per-vertex lighting, no highlights. */
export type LambertMaterial = {
  readonly _tag: 'Lambert';
  readonly color: Rgb;
  /** Id of a texture lent to the store for the colour map, or `null` for none. */
  readonly map: string | null;
  readonly emissive: Rgb;
  readonly opacity: number;
  readonly transparent: boolean;
  readonly side: MaterialSide;
  readonly wireframe: boolean;
  readonly flatShading: boolean;
};

/** A shiny (Blinn-Phong) material with specular highlights. */
export type PhongMaterial = {
  readonly _tag: 'Phong';
  readonly color: Rgb;
  /** Id of a texture lent to the store for the colour map, or `null` for none. */
  readonly map: string | null;
  readonly emissive: Rgb;
  readonly specular: Rgb;
  readonly shininess: number;
  readonly opacity: number;
  readonly transparent: boolean;
  readonly side: MaterialSide;
  readonly wireframe: boolean;
  readonly flatShading: boolean;
};

/** A physically based (metallic-roughness) material. */
export type StandardMaterial = {
  readonly _tag: 'Standard';
  readonly color: Rgb;
  /** Id of a texture lent to the store for the colour map, or `null` for none. */
  readonly map: string | null;
  readonly roughness: number;
  readonly metalness: number;
  readonly emissive: Rgb;
  readonly emissiveIntensity: number;
  readonly opacity: number;
  readonly transparent: boolean;
  readonly side: MaterialSide;
  readonly wireframe: boolean;
  readonly flatShading: boolean;
};

/** A standard material plus clearcoat, transmission (glass-like) and index of refraction. */
export type PhysicalMaterial = {
  readonly _tag: 'Physical';
  readonly color: Rgb;
  /** Id of a texture lent to the store for the colour map, or `null` for none. */
  readonly map: string | null;
  readonly roughness: number;
  readonly metalness: number;
  readonly emissive: Rgb;
  readonly emissiveIntensity: number;
  readonly clearcoat: number;
  readonly clearcoatRoughness: number;
  readonly transmission: number;
  readonly ior: number;
  readonly opacity: number;
  readonly transparent: boolean;
  readonly side: MaterialSide;
  readonly wireframe: boolean;
  readonly flatShading: boolean;
};

/** Colours each face by its normal: useful for debugging geometry. */
export type NormalMaterial = {
  readonly _tag: 'Normal';
  readonly opacity: number;
  readonly transparent: boolean;
  readonly side: MaterialSide;
  readonly wireframe: boolean;
  readonly flatShading: boolean;
};

/** Any material the kernel can build. */
export type SurfaceMaterial =
  | BasicMaterial
  | LambertMaterial
  | PhongMaterial
  | StandardMaterial
  | PhysicalMaterial
  | NormalMaterial;

/** A geometry owned by one mesh (a shape) or shared by id (`SharedGeometry`). */
export type GeometryRef = ShapeGeometry | { readonly _tag: 'SharedGeometry'; readonly id: string };

/** A material owned by one mesh, or shared by id (`SharedMaterial`). */
export type MaterialRef =
  | SurfaceMaterial
  | { readonly _tag: 'SharedMaterial'; readonly id: string };

/** A shared geometry definition. */
export type GeometryDefinition = { readonly id: string; readonly geometry: ShapeGeometry };

/** A shared material definition. */
export type MaterialDefinition = { readonly id: string; readonly material: SurfaceMaterial };

/** Shared resource definitions referenced by `SharedGeometry` and `SharedMaterial`. */
export type ResourceDefinitions = {
  readonly geometries: ReadonlyArray<GeometryDefinition>;
  readonly materials: ReadonlyArray<MaterialDefinition>;
};

/**
 * Names a behaviour registered with the scene, with its numeric parameters: React Three
 * Fiber's `useFrame` animation, as data. The behaviour is a pure function of scene time
 * and these parameters, adding a position offset, a rotation and a scale factor on top
 * of the node's own transform (eased or not), as Drei's `Float` does with an inner group.
 */
export type Behave = {
  readonly name: string;
  readonly params: Readonly<Record<string, number>>;
};

/** How a transition progresses from 0 to 1. */
export type Easing = 'linear' | 'easeInOutCubic' | 'easeOutCubic' | 'easeOutBack';

/**
 * How `position` and `scale` reach new values. The Model always owns the target; a
 * transition only decides how the rendered value travels there.
 *
 * - `Instant`: jump to the new value.
 * - `Ease`: travel over `seconds` of scene time. A new target mid-flight restarts the
 *   transition from the pose at the last frame, so nothing jumps.
 */
export type Transition =
  | { readonly _tag: 'Instant' }
  | { readonly _tag: 'Ease'; readonly seconds: number; readonly easing: Easing };

/** A transform node that may contain children. */
export type GroupNode = {
  readonly _tag: 'Group';
  readonly key: string;
  readonly position: Vec3;
  readonly rotation: Rotation;
  readonly scale: Vec3;
  readonly transition: Transition;
  /** A registered behaviour moving the node on top of its transform, or `null`. */
  readonly behaviour: Behave | null;
  /**
   * Makes every mesh inside the group pickable, interactive or not. Events still report
   * the mesh hit; its `path` names this group, so one handler can serve the whole group.
   */
  readonly interactive: boolean;
  readonly children: ReadonlyArray<SceneNode>;
};

/** A renderable mesh. `interactive` meshes take part in pointer hit testing. */
export type MeshNode = {
  readonly _tag: 'Mesh';
  readonly key: string;
  readonly position: Vec3;
  readonly rotation: Rotation;
  readonly scale: Vec3;
  readonly transition: Transition;
  /** A registered behaviour moving the node on top of its transform, or `null`. */
  readonly behaviour: Behave | null;
  readonly geometry: GeometryRef;
  readonly material: MaterialRef;
  readonly interactive: boolean;
  /** Casts shadows from lights with `castShadow`, when the scene enables shadows. */
  readonly castShadow: boolean;
  /** Receives shadows, when the scene enables shadows. */
  readonly receiveShadow: boolean;
};

/**
 * One copy of an instanced mesh. `key` is unique within its `instances` node and comes
 * back in hit events. `color` multiplies the material's colour, so use a white material
 * for exact per-instance colours. Rotation is fixed Euler angles: instances have no
 * behaviours or transitions of their own.
 */
export type Instance = {
  readonly key: string;
  readonly position: Vec3;
  readonly rotation: Vec3;
  readonly scale: Vec3;
  readonly color: Rgb;
};

/**
 * Many copies of one geometry and material in a single draw call (three.js's
 * `InstancedMesh`). The node itself is placed like a mesh; its instances are placed
 * inside it. Changing instances rewrites only the slots that changed.
 */
export type InstancesNode = {
  readonly _tag: 'Instances';
  readonly key: string;
  readonly position: Vec3;
  readonly rotation: Rotation;
  readonly scale: Vec3;
  readonly transition: Transition;
  /** A registered behaviour moving the node on top of its transform, or `null`. */
  readonly behaviour: Behave | null;
  readonly geometry: GeometryRef;
  readonly material: MaterialRef;
  readonly interactive: boolean;
  readonly castShadow: boolean;
  readonly receiveShadow: boolean;
  readonly instances: ReadonlyArray<Instance>;
};

/**
 * Shows a three.js object the application lent to the resource store under `id`: React
 * Three Fiber's `<primitive>`, by reference rather than by value, so descriptions stay
 * plain data. The node's transform applies to a wrapper, leaving the object's own as the
 * application set it. The object is never disposed. Until something is lent under `id`
 * the node is empty, so a description can name a model that is still loading.
 */
export type BorrowedNode = {
  readonly _tag: 'Borrowed';
  readonly key: string;
  readonly id: string;
  readonly position: Vec3;
  readonly rotation: Rotation;
  readonly scale: Vec3;
  readonly transition: Transition;
  /** A registered behaviour moving the node on top of its transform, or `null`. */
  readonly behaviour: Behave | null;
  /** Makes every mesh inside the object pickable; hits name the part by its `name`. */
  readonly interactive: boolean;
  /** An animation clip of the lent object to play, or `null` for none. */
  readonly animation: Animation | null;
};

/**
 * Plays the clip named `clip` from the borrowed object's `animations`. Playback is a
 * function of scene time, like `spin`: it pauses with the scene and rewinds with it.
 * `speed` scales time (negative plays backwards); `loop: false` holds the last frame.
 * Changing the animation restarts it from the current scene time; removing it returns
 * the object to its rest pose.
 */
export type Animation = {
  readonly clip: string;
  readonly speed: number;
  readonly loop: boolean;
};

/** Uniform ambient light. */
export type AmbientLightNode = {
  readonly _tag: 'AmbientLight';
  readonly key: string;
  readonly color: Rgb;
  readonly intensity: number;
};

/** Directional light shining from `position` towards the origin. */
export type DirectionalLightNode = {
  readonly _tag: 'DirectionalLight';
  readonly key: string;
  readonly color: Rgb;
  readonly intensity: number;
  readonly position: Vec3;
  /** Renders a shadow map from this light, when the scene enables shadows. */
  readonly castShadow: boolean;
  /** Shadow map width and height in texels: a power of two. */
  readonly shadowMapSize: number;
  /** Depth offset that removes shadow acne; usually a small negative number. */
  readonly shadowBias: number;
  /** Half the width and height, in world units, of the area the shadow covers. */
  readonly shadowArea: number;
};

/**
 * A light shining in every direction from `position`. `distance` 0 means no cut-off;
 * `decay` 2 is physically correct.
 */
export type PointLightNode = {
  readonly _tag: 'PointLight';
  readonly key: string;
  readonly color: Rgb;
  readonly intensity: number;
  readonly position: Vec3;
  readonly distance: number;
  readonly decay: number /** Renders a shadow map from this light, when the scene enables shadows. */;
  readonly castShadow: boolean;
  /** Shadow map width and height in texels: a power of two. */
  readonly shadowMapSize: number;
  /** Depth offset that removes shadow acne; usually a small negative number. */
  readonly shadowBias: number;
};

/**
 * A cone of light from `position` towards `target`, both in world space. `angle` is the
 * cone's half-angle in radians; `penumbra` (0 to 1) softens its edge.
 */
export type SpotLightNode = {
  readonly _tag: 'SpotLight';
  readonly key: string;
  readonly color: Rgb;
  readonly intensity: number;
  readonly position: Vec3;
  readonly target: Vec3;
  readonly distance: number;
  readonly angle: number;
  readonly penumbra: number;
  readonly decay: number /** Renders a shadow map from this light, when the scene enables shadows. */;
  readonly castShadow: boolean;
  /** Shadow map width and height in texels: a power of two. */
  readonly shadowMapSize: number;
  /** Depth offset that removes shadow acne; usually a small negative number. */
  readonly shadowBias: number;
};

/** Sky-to-ground gradient light: `color` from above `position`, `groundColor` from below. */
export type HemisphereLightNode = {
  readonly _tag: 'HemisphereLight';
  readonly key: string;
  readonly color: Rgb;
  readonly groundColor: Rgb;
  readonly intensity: number;
  readonly position: Vec3;
};

/** Any node in a scene. Keys are unique across the whole scene. */
export type SceneNode =
  | GroupNode
  | MeshNode
  | InstancesNode
  | BorrowedNode
  | AmbientLightNode
  | DirectionalLightNode
  | PointLightNode
  | SpotLightNode
  | HemisphereLightNode;

/** The node kinds the kernel knows how to host. */
export type NodeKind = SceneNode['_tag'];

/** A perspective camera: `fov` is the vertical field of view in degrees. */
export type PerspectiveCamera = {
  readonly _tag: 'Perspective';
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  readonly position: Vec3;
  readonly lookAt: Vec3;
};

/**
 * An orthographic camera. As in React Three Fiber, the frustum follows the viewport in
 * CSS pixels and `zoom` is CSS pixels per world unit, so objects keep their on-screen
 * size when the viewport resizes.
 */
export type OrthographicCamera = {
  readonly _tag: 'Orthographic';
  readonly zoom: number;
  readonly near: number;
  readonly far: number;
  readonly position: Vec3;
  readonly lookAt: Vec3;
};

/** The single active camera. */
export type Camera = PerspectiveCamera | OrthographicCamera;

/**
 * Shadow map filtering, as React Three Fiber names it: `basic` (hard), `percentage` (PCF),
 * `soft` (PCF soft) or `variance` (VSM). `off` disables shadows.
 */
export type ShadowMode = 'off' | 'basic' | 'percentage' | 'soft' | 'variance';

/** How the renderer maps scene light to screen colour. */
export type ToneMapping = 'none' | 'linear' | 'reinhard' | 'cineon' | 'aces' | 'agx' | 'neutral';

/**
 * When frames render, as React Three Fiber's `frameloop`: `always` every display frame,
 * `demand` only when something changed or is animating, `never` only on `advance`.
 */
export type FrameMode = 'always' | 'demand' | 'never';

/** Scene-wide rendering settings, changeable at any time. */
export type RenderSettings = {
  readonly frames: FrameMode;
  /**
   * Scales the drawing buffer's pixel ratio, from just above 0 to 1. Lower it when
   * frames are slow (see `PerformanceChanged`), as Drei's `AdaptiveDpr` does.
   */
  readonly resolution: number;
  readonly shadows: ShadowMode;
  readonly toneMapping: ToneMapping;
  /** Exposure for tone mapping. Ignored when `toneMapping` is `none`. */
  readonly exposure: number;
  /** The output colour space: `srgb` for displays, `linear` to skip the conversion. */
  readonly colorSpace: 'srgb' | 'linear';
};

/** A complete scene: camera, render settings, shared resources and root nodes. */
export type SceneDescription = {
  readonly camera: Camera;
  readonly render: RenderSettings;
  readonly resources: ResourceDefinitions;
  readonly children: ReadonlyArray<SceneNode>;
};

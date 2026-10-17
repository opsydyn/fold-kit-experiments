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
/** A bevel on extruded text, as three.js's `TextGeometry` options. */
export type TextBevel = {
  readonly thickness: number;
  readonly size: number;
  readonly offset: number;
  readonly segments: number;
};

/**
 * Text drawn from a typeface font lent to the store under `font`, as Drei's `Text3D`
 * (three.js's `TextGeometry`). Flat (`ShapeGeometry`) when `depth` is 0 with no bevel.
 * Until the font is lent the geometry is empty; lending it builds the text.
 */
export type TextGeometry = {
  readonly _tag: 'Text';
  readonly text: string;
  readonly font: string;
  readonly size: number;
  readonly depth: number;
  readonly curveSegments: number;
  readonly bevel: TextBevel | null;
  /** Centre the text on its origin, as `geometry.center()`; otherwise it starts there. */
  readonly center: boolean;
  /** Extra space after each letter, in ems (multiples of `size`). */
  readonly letterSpacing: number;
  /** Line spacing as a multiple of the font's own. */
  readonly lineHeight: number;
  /** Where each line sits within the widest. */
  readonly align: TextAlign;
};

/** Where each line of text sits within the widest: troika's `textAlign`. */
export type TextAlign = 'left' | 'center' | 'right';

export type ShapeGeometry =
  | TextGeometry
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

/**
 * Draws only the shadows falling on it, transparent elsewhere: three.js's
 * `ShadowMaterial`, for grounding objects on a floor that is not drawn.
 */
export type ShadowMaterial = {
  readonly _tag: 'Shadow';
  readonly color: Rgb;
  readonly opacity: number;
};

/** Any material the kernel can build. */
export type SurfaceMaterial =
  | ShadowMaterial
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
  /** A rigid body whose colliders are every mesh inside the group, or `null`. */
  readonly body: Body | null;
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
  /** A rigid body simulating the mesh, when the scene has `physics`; `null` for none. */
  readonly body: Body | null;
};

/**
 * How a body moves, as react-three-rapier's `RigidBody` `type`:
 *
 * - `dynamic`: the simulation owns its pose from its starting transform.
 * - `fixed`: it never moves; other bodies hit it.
 * - `kinematic`: it follows the node's own transform (with its transition and behaviour),
 *   pushing dynamic bodies out of the way.
 */
export type BodyType = 'dynamic' | 'fixed' | 'kinematic';

/**
 * The collider made from the mesh's geometry (react-three-rapier's `colliders`):
 * `cuboid` its bounding box, `ball` its bounding sphere, `hull` the convex hull of its
 * vertices, `trimesh` its triangles (for fixed bodies).
 */
export type BodyCollider = 'cuboid' | 'ball' | 'hull' | 'trimesh';

/**
 * A rigid body (react-three-rapier `RigidBody` at `ae5c3fe`). The node's transform is
 * where a dynamic body starts; changing its position or rotation later teleports it there
 * at rest. An `impulse` is applied once, when its `id` is new.
 */
export type Body = {
  readonly type: BodyType;
  readonly collider: BodyCollider;
  /** Total mass; `null` for density 1 over the collider's volume (Rapier's default). */
  readonly mass: number | null;
  readonly friction: number;
  readonly restitution: number;
  readonly linearDamping: number;
  readonly angularDamping: number;
  readonly gravityScale: number;
  /** Continuous collision detection, for fast small bodies. */
  readonly ccd: boolean;
  /** Reports overlaps as collisions without pushing anything. */
  readonly sensor: boolean;
  /** Velocities it starts with. */
  readonly linearVelocity: Vec3;
  readonly angularVelocity: Vec3;
  readonly impulse: { readonly id: number; readonly impulse: Vec3 } | null;
};

/**
 * The scene's physics world (react-three-rapier `Physics`): gravity, pausing, and the
 * fixed step it advances by, interpolating poses between steps.
 */
export type Physics = {
  readonly gravity: Vec3;
  readonly paused: boolean;
  readonly timeStep: number;
  readonly interpolate: boolean;
  /** Joints between bodies, each active while both its bodies exist. */
  readonly joints: ReadonlyArray<Joint>;
};

/** A body a joint holds: a node's, or one instance's of an instances node. */
export type BodyRef = { readonly key: string; readonly instance: string | null };

/** A joint's range of motion, `[min, max]`: radians for a revolute joint, units for a prismatic one. */
export type JointLimits = readonly [min: number, max: number];

/**
 * How a joint holds its two bodies: Rapier's impulse joints, as react-three-rapier's
 * `useFixedJoint`, `useSphericalJoint`, `useRevoluteJoint`, `usePrismaticJoint`,
 * `useRopeJoint` and `useSpringJoint` make them (`ae5c3fe`, `src/hooks/joints.ts`).
 */
export type JointKind =
  /** No relative motion: each body's frame (Euler angles) at its anchor coincide. */
  | { readonly _tag: 'Fixed'; readonly frameA: Vec3; readonly frameB: Vec3 }
  /** The anchors coincide; any rotation about them (a ball and socket). */
  | { readonly _tag: 'Spherical' }
  /** The anchors coincide; rotation about `axis` only (a hinge). */
  | { readonly _tag: 'Revolute'; readonly axis: Vec3; readonly limits: JointLimits | null }
  /** Sliding along `axis` only. */
  | { readonly _tag: 'Prismatic'; readonly axis: Vec3; readonly limits: JointLimits | null }
  /** The anchors at most `length` apart. */
  | { readonly _tag: 'Rope'; readonly length: number }
  /** A force pulling the anchors towards `restLength` apart. */
  | {
      readonly _tag: 'Spring';
      readonly restLength: number;
      readonly stiffness: number;
      readonly damping: number;
    };

/**
 * A joint between bodies `a` and `b`. Each anchor is in its body's own space: from the
 * node's origin, turned with it, unscaled.
 */
export type Joint = {
  readonly key: string;
  readonly a: BodyRef;
  readonly b: BodyRef;
  readonly anchorA: Vec3;
  readonly anchorB: Vec3;
  readonly kind: JointKind;
  /** Whether the two bodies still collide with each other (Rapier's default: they do). */
  readonly contacts: boolean;
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
  /**
   * A rigid body for every instance, all with these settings, or `null`: react-three-rapier's
   * `InstancedRigidBodies`. Each instance's collider is the geometry at its scale.
   */
  readonly body: Body | null;
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
  /** A rigid body whose colliders are the model's meshes, once it is lent; or `null`. */
  readonly body: Body | null;
};

/** Where a label's origin is along its width: an edge, the middle, or a fraction of it. */
export type LabelAnchorX = 'left' | 'center' | 'right' | number;

/** Where a label's origin is along its height: an edge, a baseline, the middle, or a fraction. */
export type LabelAnchorY =
  | 'top'
  | 'top-baseline'
  | 'middle'
  | 'bottom-baseline'
  | 'bottom'
  | number;

/** How a label's lines line up within its block. */
export type LabelAlign = 'left' | 'right' | 'center' | 'justify';

/**
 * Crisp text at any size, drawn from glyph distance fields: Drei's `Text` (troika's
 * `Text`, `bf6f4ad` `src/core/Text.tsx`). `font` is the URL of a TTF, OTF or WOFF file,
 * or `null` for troika's default. A label is drawn by the scene graph's label engine (in
 * Foldkit, the environment's); without one it is empty. Fonts load and glyphs build in the
 * background, and the scene redraws when they are ready.
 */
export type LabelNode = {
  readonly _tag: 'Label';
  readonly key: string;
  readonly position: Vec3;
  readonly rotation: Rotation;
  readonly scale: Vec3;
  readonly transition: Transition;
  readonly behaviour: Behave | null;
  /** Makes the label pickable, over its glyphs' bounds. */
  readonly interactive: boolean;
  readonly text: string;
  readonly font: string | null;
  /** The em height, in scene units. */
  readonly fontSize: number;
  readonly color: Rgb;
  readonly fillOpacity: number;
  readonly anchorX: LabelAnchorX;
  readonly anchorY: LabelAnchorY;
  /** Wraps lines longer than this, in scene units; `null` never wraps. */
  readonly maxWidth: number | null;
  /** Line spacing as a multiple of `fontSize`; `null` for the font's own ("normal"). */
  readonly lineHeight: number | null;
  /** Extra space between letters, in ems. */
  readonly letterSpacing: number;
  readonly textAlign: LabelAlign;
  /** An outline around the glyphs, in scene units (0 for none), and its look. */
  readonly outlineWidth: number;
  readonly outlineColor: Rgb;
  readonly outlineOpacity: number;
  readonly outlineBlur: number;
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

/**
 * A square grid of lines on the XZ plane, three.js's `GridHelper`: `size` across, cut
 * into `divisions` cells, with the two middle lines in `centerColor`. (Drei's `Grid` is a
 * fading shader grid; this is the plain helper.)
 */
export type GridNode = {
  readonly _tag: 'Grid';
  readonly key: string;
  readonly position: Vec3;
  readonly size: number;
  readonly divisions: number;
  readonly color: Rgb;
  readonly centerColor: Rgb;
};

/**
 * Drei's `Grid`: a plane whose shader draws cell lines and section lines on the XZ plane,
 * fading with distance from the camera's foot on it. `size` is the plane's
 * `[width, height]`; `infinite` stretches it as far as the fade reaches, and
 * `followCamera` slides it under the camera. `fadeFrom` 1 fades from the camera, 0 from
 * the grid's origin. Its rotation is fixed Euler angles.
 */
export type ShaderGridNode = {
  readonly _tag: 'ShaderGrid';
  readonly key: string;
  readonly position: Vec3;
  readonly rotation: Vec3;
  readonly size: readonly [width: number, height: number];
  readonly cellSize: number;
  readonly cellThickness: number;
  readonly cellColor: Rgb;
  readonly sectionSize: number;
  readonly sectionThickness: number;
  readonly sectionColor: Rgb;
  readonly infinite: boolean;
  readonly followCamera: boolean;
  readonly fadeDistance: number;
  readonly fadeStrength: number;
  readonly fadeFrom: number;
  readonly side: MaterialSide;
};

/** Any node in a scene. Keys are unique across the whole scene. */
export type SceneNode =
  | GridNode
  | ShaderGridNode
  | GroupNode
  | MeshNode
  | InstancesNode
  | BorrowedNode
  | LabelNode
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
  readonly lookAt: Vec3 /**
   * How the rendered camera follows a new position, `lookAt` or zoom: 0 (the default)
   * jumps; above 0 eases there round the target, closing that fraction of the remaining
   * way every sixtieth of a second, as three.js's `OrbitControls.dampingFactor` (Drei's
   * default is 0.05). Field of view, near and far always apply at once.
   */;
  readonly damping: number;
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
  readonly lookAt: Vec3 /** As on `PerspectiveCamera`. */;
  readonly damping: number;
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

/**
 * A post-processing effect, applied in order after the scene renders (three.js's
 * `EffectComposer` passes).
 *
 * - `Bloom`: bright areas glow (`UnrealBloomPass`): `strength`, `radius`, and the
 *   luminance `threshold` above which pixels bloom.
 * - `Vignette`: darkens the edges (`VignetteShader`): `offset` and `darkness`.
 * - `Film`: animated grain (`FilmPass`): `intensity`, optionally `grayscale`.
 */
export type PostEffect =
  | {
      readonly _tag: 'Bloom';
      readonly strength: number;
      readonly radius: number;
      readonly threshold: number;
    }
  | { readonly _tag: 'Vignette'; readonly offset: number; readonly darkness: number }
  | { readonly _tag: 'Film'; readonly intensity: number; readonly grayscale: boolean };

/** Scene-wide rendering settings, changeable at any time. */
export type RenderSettings = {
  /** Post-processing, in order. Empty renders straight to the screen. */
  readonly effects: ReadonlyArray<PostEffect>;
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

/** Part of the canvas, as fractions (0 to 1) of its width and height from the top left. */
export type ViewRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * Another camera drawing the scene into part of the canvas: Drei's `View` and R3F's
 * split-screen portals, as data. Views draw in order, later ones on top.
 */
export type View = { readonly key: string; readonly camera: Camera; readonly rect: ViewRect };

/**
 * A small scene rendered into a texture that materials use as `map: id`: Drei's
 * `RenderTexture`, as data. Its nodes have their own key namespace and may use the
 * scene's shared resources. It redraws only when it changes or animates.
 */
export type RenderTexture = {
  readonly id: string;
  /** Texture size in pixels. */
  readonly width: number;
  readonly height: number;
  readonly camera: Camera;
  /** A clear colour, or `null` for transparent. */
  readonly background: Rgb | null;
  readonly children: ReadonlyArray<SceneNode>;
};

/** A complete scene: camera, render settings, shared resources and root nodes. */
/**
 * Who owns the pointer's gestures on the canvas.
 *
 * - `'page'` (the default): the wheel scrolls the page, touch pans it, the right button
 *   opens the browser's menu, and the scene reports only events on interactive meshes.
 * - `'scene'`: the scene claims them, as three.js's `OrbitControls` does when connected,
 *   and reports every drag, wheel and pinch on the canvas as a `Gesture`, for controls
 *   such as `orbit` to turn into a new camera.
 */
export type Gestures = 'page' | 'scene';

/**
 * A point the application shows HTML at, as Drei's `Html` (`src/web/Html.tsx` at
 * `bf6f4ad`, without `transform`). The scene works out where the point is on the canvas
 * each frame it draws; the host moves the application's HTML there.
 */
export type Overlay = {
  readonly key: string;
  /** The node the position is relative to, moving with it; `null` for world space. */
  readonly node: string | null;
  readonly position: Vec3;
  /** Centre the HTML on the point (Drei's `center`); otherwise its top left is there. */
  readonly center: boolean;
  /**
   * Scale the HTML with distance, as Drei's `distanceFactor`: at a distance where the
   * view is `distanceFactor` units tall it shows at its own size. `null` keeps its size.
   */
  readonly distanceFactor: number | null;
  /** Hide the HTML while a mesh is in front of the point (Drei's `occlude`). */
  readonly occlude: boolean;
  /** z-index for points at the camera's near and far planes (Drei's `zIndexRange`). */
  readonly zIndexRange: readonly [near: number, far: number];
  /** With views: the view it is shown in. `null`: the camera, or the first view. */
  readonly view: string | null;
};

/**
 * Image-based lighting and background, as Drei's `Environment` (`src/core/Environment.tsx`
 * at `bf6f4ad`, `setEnvProps`). `map` names an equirectangular texture lent to the store;
 * `null` uses three.js's `RoomEnvironment`, a neutral studio built in code (no files).
 */
export type Environment = {
  readonly map: string | null;
  /** Drei's `background`: `false` lights only, `true` also shows it, `'only'` only shows it. */
  readonly background: boolean | 'only';
  readonly backgroundBlurriness: number;
  readonly backgroundIntensity: number;
  readonly environmentIntensity: number;
};

/**
 * A physically based daylight sky, three.js's `Sky` (Preetham), as Drei's `Sky`
 * (`src/core/Sky.tsx` at `bf6f4ad`). Drawn at the camera's far plane, never picked.
 */
export type Sky = {
  readonly sunPosition: Vec3;
  readonly turbidity: number;
  readonly rayleigh: number;
  readonly mieCoefficient: number;
  readonly mieDirectionalG: number;
  /** three.js 0.186's cloud cover, 0 to 1. Clouds hold still: scene time does not move them. */
  readonly clouds: number;
  /** The size of the sky box (Drei's `distance`). */
  readonly distance: number;
};

/**
 * Soft shadows on the ground under everything, as Drei's `ContactShadows`
 * (`src/core/ContactShadows.tsx` at `bf6f4ad`, after three.js's `webgl_shadow_contact`
 * example): the scene's depth seen from below, blurred, on a plane. Redrawn with every
 * frame the scene draws; needs no lights or shadow maps.
 */
export type ContactShadows = {
  /** The middle of the shadow plane; it lies flat, facing up. */
  readonly position: Vec3;
  /** Width and depth of the plane, in world units (Drei's `width × scale`, `height × scale`). */
  readonly size: readonly [width: number, depth: number];
  /**
   * Where the shadow camera starts seeing, above the plane (Drei's `near`). Negative takes
   * in faces just below it, such as the flat bottoms of objects resting on the plane.
   */
  readonly near: number;
  /** How far above the plane objects still cast a shadow (Drei's `far`). */
  readonly far: number;
  readonly blur: number;
  /** A second, finer blur pass (Drei's `smooth`). */
  readonly smooth: boolean;
  readonly opacity: number;
  readonly color: Rgb;
  /** Texels across the shadow texture. */
  readonly resolution: number;
};

/**
 * Immersive presentation (WebXR), as `@react-three/xr`'s store and `XROrigin`
 * (pmndrs/xr at `0e1acd8`). Data only: an application enters a session from a user
 * gesture through its host (the Foldkit environment's `xr.enter`), and the scene that
 * describes `xr` is the one presented.
 */
export type Xr = {
  /** Where the player stands: the reference space's origin in the scene, on the floor. */
  readonly origin: Vec3;
  /** Which way the player faces at the origin: radians about +y (0 looks down −z). */
  readonly heading: number;
  /** The reference space requested (pmndrs/xr's default is `local-floor`). */
  readonly referenceSpace: 'local-floor' | 'local' | 'bounded-floor';
  /** Framebuffer scale relative to the device's default (1); lower is faster. */
  readonly framebufferScale: number;
};

export type SceneDescription = {
  readonly camera: Camera;
  /** Whether the scene claims the pointer's gestures from the page. */
  readonly gestures: Gestures;
  /**
   * Views to draw instead of `camera` filling the canvas. Empty (the default) draws one
   * full view with `camera`.
   */
  readonly views: ReadonlyArray<View>;
  /** Scenes rendered into textures for materials to use. */
  readonly renderTextures: ReadonlyArray<RenderTexture>;
  /** Points to show HTML at, placed every frame the scene draws. */
  readonly overlays: ReadonlyArray<Overlay>;
  /** Image-based lighting and background, or `null` for none. */
  readonly environment: Environment | null;
  /** A daylight sky behind everything, or `null` for none. */
  readonly sky: Sky | null;
  /** Soft shadows on the ground, or `null` for none. */
  readonly contactShadows: ContactShadows | null;
  /** A physics world for meshes with a `body`, or `null` for none. */
  readonly physics: Physics | null;
  /** How the scene is presented in an immersive session, or `null` if it never is. */
  readonly xr: Xr | null;
  /**
   * Nodes whose world bounding box the scene reports (`Measured` events) whenever it
   * changes: what Drei's `Bounds` measures, for `fitCamera`. Loaded models included.
   */
  readonly measure: ReadonlyArray<string>;
  readonly render: RenderSettings;
  readonly resources: ResourceDefinitions;
  readonly children: ReadonlyArray<SceneNode>;
};

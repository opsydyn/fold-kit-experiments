# ADR-016: A still of a scene, as SVG, drawn without a browser

- Status: Accepted (2026-10-20).
- Evidence: `packages/effect-three/test/preview.test.ts` (the size, centring and
  background asked for; the same scene making the same picture; an invalid description
  answered with why; a floor painted before the cube standing on it, and a wall before
  what is in front of it; ambient light of intensity π showing a lit material's own
  colour, a directional light lighting only the faces turned to it, a point light falling
  off with distance, a spot lighting nothing outside its cone; each instance in its own
  colour; a sphere around the camera, cut by its near plane, leaving no stray points;
  scene time posing the still; lent lines, dashes, points, sprites and see-through faces;
  and the paint order of facets far to near whichever order they come in); every example
  scene drawn by a script (the city's 10,000 buildings in under 2 s, about 3 MB; the
  others in under 0.6 s) and rasterised in Chromium to look at; and the promo's docs page,
  whose two previews are drawn by an Astro endpoint when the site is built.
- References: three.js 0.186.1 `examples/jsm/renderers/SVGRenderer.js` and `Projector.js`
  (projection, back-face culling and frustum culling, one path a face with consecutive
  paths of one style merged, edges widened half a pixel); the shader chunks
  `lights_pars_begin.glsl.js` (`getDistanceAttenuation`, `getSpotAttenuation`,
  `getHemisphereLightIrradiance`), `lights_physical_pars_fragment.glsl.js` and
  `common.glsl.js` (`BRDF_Lambert`); Fuchs, Kedem and Naylor, "On visible surface
  generation by a priori tree structures" (SIGGRAPH 1980).

## Context

Roadmap 6 asks for server rendering of a `SceneDescription` for previews: a thumbnail in
a pull request, a gallery card or a placeholder before WebGL starts, made where there is
no browser and no GPU. The kernel already builds a scene graph headless (the tests do);
what is missing is a picture of it.

## Decision

- **`previewSvg(description, { width, height, at?, background?, store?, behaviours?,
precision? })`** in the kernel returns `{ _tag: 'Preview', svg }` or `{ _tag: 'Invalid',
error }`. It reconciles a scene graph, sizes its camera, ticks it to `at` seconds of
  scene time, and disposes it after.
- **Projection as `SVGRenderer`:** each drawn object (each instance of an instanced mesh
  standing in as a mesh of its own) is projected by three's `Projector`, which culls back
  faces and what is outside the frustum. Faces are flat paths, lines strokes (dashed for
  dashed materials) and points and sprites squares; consecutive paths of one paint are
  merged, and faces are widened half a pixel and outlined in their colour so the pieces
  of a face show no seams. Faces are cut at the near plane.
- **Light as three's diffuse term:** ambient and hemisphere irradiance, then directional,
  point and spot light by the face's normal with three's distance and cone falloff, times
  the diffuse colour over π, plus emission. Point and spot light is taken at the object's
  centre, so a flat side is one colour. Basic materials show their colour and normal
  materials their normals. A metal is lit as if matte (without the environment it
  reflects, three draws it nearly black).
- **Order by a binary space partition, not by depth.** `SVGRenderer` sorts faces by the
  depth of their centres, which paints a floor's near half over what stands on it (it
  did, on every example with a floor). `paintOrder` partitions objects by the planes of
  their faces and paints far to near from the eye, which is exact for any scene without
  intersecting faces (crossing faces are split). An object none of whose faces can hide
  another (any convex solid, back faces culled) is painted as it is; objects are placed
  either side of a plane by their bounding spheres before their faces are looked at; and
  each plane is the one of a few candidates that cuts fewest objects and divides them
  most evenly, so the city's 10,000 buildings take under 2 s rather than minutes.
- **`bun run scene:preview scene.json preview.svg`** draws a saved scene file, with
  `--width`, `--height`, `--at` and `--background`.

## Consequences

- A preview is not the picture: no textures, shadows, specular highlights, fog,
  environment lighting, tone mapping, post-processing, views, HUD, render-kit parts (sky,
  shader grids, wide lines) or labels, and skinned models stand in their rest pose.
  Borrowed models and text show when `store` lends them; nothing is lent without one.
- Its size grows with what is seen: a few kilobytes for a handful of shapes, hundreds for
  a furnished room or a smooth model, megabytes for thousands of objects.
- It runs anywhere three runs, browsers included, so an editor could show one too; the
  output is the same for the same description, options and three version.

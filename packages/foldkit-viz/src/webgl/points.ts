import type { FacetGeometry, Graphic, PlotGeometry } from '../plot/types.js';

/**
 * Dense dot marks drawn on the GPU (ADR 0037). A layer uploads each packed
 * graphic's positions, radii, colour indices and palette once; a highlight
 * then uploads one byte per point and redraws, so brushing a million points
 * repaints within a frame. Everything else (grid, axes, text, other marks)
 * stays on a 2D canvas beneath, painted by canvas/plot with `points: false`.
 *
 * Framework-free and listener-free: the caller owns the canvas, its size
 * (the plot's size times the pixel ratio) and when to draw. Every point
 * blends over those beneath, as sparse dots do, so overlaps shade by density;
 * canvas/plot and SVG fill each colour group in a few paths, where overlaps
 * stack less.
 */

/** Opaque WebGL objects. */
export interface GlShader {}
export interface GlProgram {}
export interface GlBuffer {}
export interface GlTexture {}
export interface GlUniformLocation {}

/** The slice of a WebGL (1 or 2) context the layer uses, so foldkit-viz needs no DOM types. */
export type PointsGl = Readonly<{
  ARRAY_BUFFER: number;
  STATIC_DRAW: number;
  DYNAMIC_DRAW: number;
  FLOAT: number;
  UNSIGNED_BYTE: number;
  UNSIGNED_SHORT: number;
  POINTS: number;
  VERTEX_SHADER: number;
  FRAGMENT_SHADER: number;
  COMPILE_STATUS: number;
  LINK_STATUS: number;
  BLEND: number;
  SCISSOR_TEST: number;
  ONE: number;
  ONE_MINUS_SRC_ALPHA: number;
  COLOR_BUFFER_BIT: number;
  TEXTURE_2D: number;
  TEXTURE0: number;
  RGBA: number;
  NEAREST: number;
  CLAMP_TO_EDGE: number;
  TEXTURE_MIN_FILTER: number;
  TEXTURE_MAG_FILTER: number;
  TEXTURE_WRAP_S: number;
  TEXTURE_WRAP_T: number;
}> & {
  createShader(type: number): GlShader | null;
  shaderSource(shader: GlShader, source: string): void;
  compileShader(shader: GlShader): void;
  /** COMPILE_STATUS, a boolean. */
  getShaderParameter(shader: GlShader, name: number): boolean;
  getShaderInfoLog(shader: GlShader): string | null;
  deleteShader(shader: GlShader | null): void;
  createProgram(): GlProgram | null;
  attachShader(program: GlProgram, shader: GlShader): void;
  linkProgram(program: GlProgram): void;
  /** LINK_STATUS, a boolean. */
  getProgramParameter(program: GlProgram, name: number): boolean;
  getProgramInfoLog(program: GlProgram): string | null;
  useProgram(program: GlProgram | null): void;
  deleteProgram(program: GlProgram | null): void;
  createBuffer(): GlBuffer | null;
  bindBuffer(target: number, buffer: GlBuffer | null): void;
  bufferData(target: number, data: Float32Array | Uint16Array | Uint8Array, usage: number): void;
  bufferSubData(target: number, offset: number, data: Uint8Array): void;
  deleteBuffer(buffer: GlBuffer | null): void;
  getAttribLocation(program: GlProgram, name: string): number;
  enableVertexAttribArray(index: number): void;
  disableVertexAttribArray(index: number): void;
  vertexAttribPointer(
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
  ): void;
  vertexAttrib1f(index: number, value: number): void;
  getUniformLocation(program: GlProgram, name: string): GlUniformLocation | null;
  uniform1f(location: GlUniformLocation | null, x: number): void;
  uniform1i(location: GlUniformLocation | null, x: number): void;
  uniform2f(location: GlUniformLocation | null, x: number, y: number): void;
  createTexture(): GlTexture | null;
  bindTexture(target: number, texture: GlTexture | null): void;
  activeTexture(unit: number): void;
  texParameteri(target: number, name: number, value: number): void;
  texImage2D(
    target: number,
    level: number,
    internalFormat: number,
    width: number,
    height: number,
    border: number,
    format: number,
    type: number,
    pixels: Uint8Array | null,
  ): void;
  deleteTexture(texture: GlTexture | null): void;
  viewport(x: number, y: number, width: number, height: number): void;
  clearColor(r: number, g: number, b: number, a: number): void;
  clear(mask: number): void;
  enable(capability: number): void;
  disable(capability: number): void;
  blendFunc(source: number, destination: number): void;
  scissor(x: number, y: number, width: number, height: number): void;
  drawArrays(mode: number, first: number, count: number): void;
};

export type PointsLayerOptions = Readonly<{
  /** Device pixels per CSS pixel. The canvas must be the plot's size times this. Default 1. */
  pixelRatio?: number;
  /** The colour for points painted `currentColor`: a GPU layer has no page colour. */
  current?: string;
}>;

export type PointsLayer = Readonly<{
  /**
   * Uploads the dimmed flags of geometry restyled by highlightPoints from the
   * geometry this layer was made with; no highlight clears them. Call draw after.
   */
  highlight: (geometry: PlotGeometry) => void;
  /** Clears the canvas and draws every point: dimmed ones first, highlighted on top. */
  draw: () => void;
  /** Releases the buffers, textures and program. */
  dispose: () => void;
}>;

type Points = Extract<Graphic, { kind: 'points' }>;

const VERTEX = `
attribute vec2 a_position;
attribute float a_radius;
attribute float a_paint;
attribute float a_dimmed;
uniform vec2 u_size;
uniform float u_ratio;
uniform float u_pass;
varying float v_paint;
varying float v_dimmed;
varying float v_round;
void main() {
  // Pass 0 draws dimmed points, pass 1 the rest, so highlighted points land on top.
  bool shown = (u_pass < 0.5) == (a_dimmed > 0.5);
  vec2 clip = a_position / u_size * 2.0 - 1.0;
  gl_Position = shown ? vec4(clip.x, -clip.y, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = shown ? 2.0 * a_radius * u_ratio : 0.0;
  v_paint = a_paint;
  v_dimmed = a_dimmed;
  // As canvas/plot does, points of radius 1.5 or less are squares.
  v_round = a_radius > 1.5 ? 1.0 : 0.0;
}`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_palette;
uniform float u_paletteSize;
uniform float u_opacity;
varying float v_paint;
varying float v_dimmed;
varying float v_round;
void main() {
  if (v_round > 0.5 && length(gl_PointCoord - 0.5) > 0.5) discard;
  vec4 colour = texture2D(u_palette, vec2((v_paint + 0.5) / u_paletteSize, 0.5));
  float alpha = colour.a * u_opacity * (v_dimmed > 0.5 ? 0.15 : 1.0);
  gl_FragColor = vec4(colour.rgb * alpha, alpha);
}`;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

/** A colour as 0–255 RGBA, from hex, rgb() or rgba(): what a GPU palette needs, read without a DOM. */
export function parseColour(colour: string): readonly [number, number, number, number] {
  const hex = HEX.exec(colour)?.[1];
  if (hex !== undefined) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    const channel = (at: number) => Number.parseInt(full.slice(at, at + 2), 16);
    return [channel(0), channel(2), channel(4), 255];
  }
  const rgb = RGB.exec(colour);
  if (rgb !== null)
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Math.round(Number(rgb[4] ?? 1) * 255)];
  throw new RangeError(`webgl/points reads hex, rgb() and rgba() colours, not "${colour}"`);
}

function compile(gl: PointsGl, type: number, source: string): GlShader {
  const shader = gl.createShader(type);
  if (shader === null) throw new RangeError('webgl/points: the context made no shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '';
    gl.deleteShader(shader);
    throw new RangeError(`webgl/points: shader did not compile: ${log}`);
  }
  return shader;
}

function link(gl: PointsGl): GlProgram {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (program === null) throw new RangeError('webgl/points: the context made no program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? '';
    gl.deleteProgram(program);
    throw new RangeError(`webgl/points: program did not link: ${log}`);
  }
  return program;
}

type Uploaded = Readonly<{
  points: Points;
  facet: FacetGeometry;
  position: GlBuffer;
  radius: GlBuffer | null;
  paint: GlBuffer;
  dimmed: GlBuffer;
  palette: GlTexture;
}>;

const packedPoints = (geometry: PlotGeometry): ReadonlyArray<readonly [Points, FacetGeometry]> =>
  geometry.facets.flatMap((facet) =>
    facet.marks.flatMap((mark) =>
      mark.graphics.flatMap((g) => (g.kind === 'points' ? [[g, facet] as const] : [])),
    ),
  );

export function pointsLayer(
  gl: PointsGl,
  geometry: PlotGeometry,
  options: PointsLayerOptions = {},
): PointsLayer {
  const ratio = options.pixelRatio ?? 1;
  const packed = packedPoints(geometry);
  if (packed.length === 0) throw new RangeError('webgl/points draws dense dot marks only');
  const program = link(gl);
  const buffer = (data: Float32Array | Uint16Array | Uint8Array, usage: number): GlBuffer => {
    const made = gl.createBuffer();
    if (made === null) throw new RangeError('webgl/points: the context made no buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, made);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    return made;
  };
  const colourOf = (paint: string): string => {
    if (paint !== 'currentColor') return paint;
    if (options.current === undefined)
      throw new RangeError(
        'webgl/points: a point is painted currentColor; pass the colour as `current`',
      );
    return options.current;
  };
  const uploaded: ReadonlyArray<Uploaded> = packed.map(([points, facet]) => {
    const xy = new Float32Array(points.count * 2);
    for (let i = 0; i < points.count; i += 1) {
      xy[i * 2] = points.xs[i] ?? 0;
      xy[i * 2 + 1] = points.ys[i] ?? 0;
    }
    const swatches = new Uint8Array(points.palette.length * 4);
    points.palette.forEach((paint, i) => swatches.set(parseColour(colourOf(paint)), i * 4));
    const palette = gl.createTexture();
    if (palette === null) throw new RangeError('webgl/points: the context made no texture');
    gl.bindTexture(gl.TEXTURE_2D, palette);
    for (const [name, value] of [
      [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
      [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
    ] as const)
      gl.texParameteri(gl.TEXTURE_2D, name, value);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      points.palette.length,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      swatches,
    );
    return {
      points,
      facet,
      position: buffer(xy, gl.STATIC_DRAW),
      radius:
        points.radius instanceof Float64Array
          ? buffer(Float32Array.from(points.radius), gl.STATIC_DRAW)
          : null,
      paint: buffer(points.paint, gl.STATIC_DRAW),
      dimmed: buffer(points.dimmed ?? new Uint8Array(points.count), gl.DYNAMIC_DRAW),
      palette,
    };
  });

  const attribute = (name: string) => gl.getAttribLocation(program, name);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const [aPosition, aRadius, aPaint, aDimmed] = [
    'a_position',
    'a_radius',
    'a_paint',
    'a_dimmed',
  ].map(attribute);
  const bind = (location: number | undefined, data: GlBuffer, size: number, type: number) => {
    if (location === undefined || location < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, data);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, type, false, 0, 0);
  };

  return {
    highlight: (restyled) => {
      const next = packedPoints(restyled);
      const same =
        next.length === uploaded.length &&
        next.every(
          ([points], i) =>
            points.key === uploaded[i]?.points.key && points.count === uploaded[i]?.points.count,
        );
      if (!same) throw new RangeError('highlight: geometry has different points from the layer’s');
      next.forEach(([points], i) => {
        const target = uploaded[i];
        if (target === undefined) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, target.dimmed);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, points.dimmed ?? new Uint8Array(points.count));
      });
    },
    draw: () => {
      gl.viewport(0, 0, geometry.width * ratio, geometry.height * ratio);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      // Premultiplied alpha, as a canvas composites.
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);
      gl.uniform2f(uniform('u_size'), geometry.width, geometry.height);
      gl.uniform1f(uniform('u_ratio'), ratio);
      gl.uniform1i(uniform('u_palette'), 0);
      gl.activeTexture(gl.TEXTURE0);
      for (const layer of uploaded) {
        const { points, facet } = layer;
        if (geometry.clip) {
          // Scissor rectangles count device pixels up from the bottom.
          gl.enable(gl.SCISSOR_TEST);
          gl.scissor(
            facet.plot.left * ratio,
            (geometry.height - facet.plot.bottom) * ratio,
            facet.plot.width * ratio,
            facet.plot.height * ratio,
          );
        } else gl.disable(gl.SCISSOR_TEST);
        bind(aPosition, layer.position, 2, gl.FLOAT);
        bind(aPaint, layer.paint, 1, gl.UNSIGNED_SHORT);
        bind(aDimmed, layer.dimmed, 1, gl.UNSIGNED_BYTE);
        if (layer.radius !== null) bind(aRadius, layer.radius, 1, gl.FLOAT);
        else if (
          aRadius !== undefined &&
          aRadius >= 0 &&
          !(points.radius instanceof Float64Array)
        ) {
          gl.disableVertexAttribArray(aRadius);
          gl.vertexAttrib1f(aRadius, points.radius);
        }
        gl.bindTexture(gl.TEXTURE_2D, layer.palette);
        gl.uniform1f(uniform('u_paletteSize'), points.palette.length);
        gl.uniform1f(uniform('u_opacity'), points.opacity);
        for (const pass of [0, 1]) {
          gl.uniform1f(uniform('u_pass'), pass);
          gl.drawArrays(gl.POINTS, 0, points.count);
        }
      }
      gl.disable(gl.SCISSOR_TEST);
    },
    dispose: () => {
      for (const layer of uploaded) {
        for (const made of [layer.position, layer.radius, layer.paint, layer.dimmed])
          if (made !== null) gl.deleteBuffer(made);
        gl.deleteTexture(layer.palette);
      }
      gl.deleteProgram(program);
    },
  };
}

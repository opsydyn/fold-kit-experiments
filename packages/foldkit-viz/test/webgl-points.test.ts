import { describe, expect, it } from 'bun:test';

import { paintPlot } from '../src/canvas/plot.js';
import { appendPoints, columnTable, compilePlot, highlightPoints } from '../src/plot/index.js';
import type { PlotSpec } from '../src/plot/index.js';
import { parseColour, pointsLayer } from '../src/webgl/points.js';
import type { PointsGl } from '../src/webgl/points.js';
import { canvasCalls } from './canvas-recorder.js';

/** A WebGL context that records calls, hands out numbered objects and compiles every shader. */
function fakeGl(options: Readonly<{ compiles?: boolean }> = {}) {
  const calls: Array<readonly [string, ...unknown[]]> = [];
  let next = 0;
  const handle =
    (name: string) =>
    (...args: unknown[]) => {
      next += 1;
      calls.push([name, ...args]);
      return { id: next };
    };
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      calls.push([name, ...args]);
    };
  const gl: PointsGl = {
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    DYNAMIC_DRAW: 35048,
    FLOAT: 5126,
    UNSIGNED_BYTE: 5121,
    UNSIGNED_SHORT: 5123,
    POINTS: 0,
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    BLEND: 3042,
    SCISSOR_TEST: 3089,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 771,
    COLOR_BUFFER_BIT: 16384,
    TEXTURE_2D: 3553,
    TEXTURE0: 33984,
    RGBA: 6408,
    NEAREST: 9728,
    CLAMP_TO_EDGE: 33071,
    TEXTURE_MIN_FILTER: 10241,
    TEXTURE_MAG_FILTER: 10240,
    TEXTURE_WRAP_S: 10242,
    TEXTURE_WRAP_T: 10243,
    createShader: handle('createShader'),
    shaderSource: record('shaderSource'),
    compileShader: record('compileShader'),
    getShaderParameter: () => options.compiles ?? true,
    getShaderInfoLog: () => 'ERROR: 0:1: syntax error',
    deleteShader: record('deleteShader'),
    createProgram: handle('createProgram'),
    attachShader: record('attachShader'),
    linkProgram: record('linkProgram'),
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    useProgram: record('useProgram'),
    deleteProgram: record('deleteProgram'),
    createBuffer: handle('createBuffer'),
    bindBuffer: record('bindBuffer'),
    bufferData: record('bufferData'),
    bufferSubData: record('bufferSubData'),
    deleteBuffer: record('deleteBuffer'),
    getAttribLocation: (_program, name) =>
      ['a_position', 'a_radius', 'a_paint', 'a_dimmed'].indexOf(name),
    enableVertexAttribArray: record('enableVertexAttribArray'),
    disableVertexAttribArray: record('disableVertexAttribArray'),
    vertexAttribPointer: record('vertexAttribPointer'),
    vertexAttrib1f: record('vertexAttrib1f'),
    getUniformLocation: (_program, name) => ({ uniform: name }),
    uniform1f: record('uniform1f'),
    uniform1i: record('uniform1i'),
    uniform2f: record('uniform2f'),
    createTexture: handle('createTexture'),
    bindTexture: record('bindTexture'),
    activeTexture: record('activeTexture'),
    texParameteri: record('texParameteri'),
    texImage2D: record('texImage2D'),
    deleteTexture: record('deleteTexture'),
    viewport: record('viewport'),
    clearColor: record('clearColor'),
    clear: record('clear'),
    enable: record('enable'),
    disable: record('disable'),
    blendFunc: record('blendFunc'),
    scissor: record('scissor'),
    drawArrays: record('drawArrays'),
  };
  const named = (name: string) => calls.filter(([n]) => n === name);
  return { gl, calls, named };
}

const rows = Array.from({ length: 1000 }, (_, i) => ({
  x: i,
  y: (i * 37) % 101,
  g: i % 3 === 0 ? 'a' : 'b',
}));
const spec = {
  width: 400,
  height: 300,
  clip: true,
  data: rows,
  marks: [{ mark: 'dot' as const, x: 'x', y: 'y', fill: 'g', dense: true }],
};
const geometry = compilePlot(spec);

describe('parseColour', () => {
  it('reads hex and rgb() colours as 0-255 RGBA', () => {
    expect(parseColour('#6aa7e8')).toEqual([106, 167, 232, 255]);
    expect(parseColour('#fff')).toEqual([255, 255, 255, 255]);
    expect(parseColour('rgb(1, 2, 3)')).toEqual([1, 2, 3, 255]);
    expect(parseColour('rgba(1,2,3,0.5)')).toEqual([1, 2, 3, 128]);
  });

  it('refuses a colour it cannot read without a DOM', () => {
    expect(() => parseColour('rebeccapurple')).toThrow(
      'webgl/points reads hex, rgb() and rgba() colours, not "rebeccapurple"',
    );
  });
});

describe('pointsLayer', () => {
  it('uploads each packed-points graphic once: positions, radius, colour index, dimmed flags and a palette texture', () => {
    const { gl, named } = fakeGl();
    pointsLayer(gl, geometry, { pixelRatio: 2 }).draw();
    const uploads = named('bufferData').map(([, , data]) => data);
    const positions = uploads.find(
      (d): d is Float32Array => d instanceof Float32Array && d.length === 2000,
    );
    if (positions === undefined) throw new Error('expected a positions upload');
    const points = geometry.facets[0]!.marks[0]!.graphics[0]!;
    if (points.kind !== 'points') throw new Error('expected packed points');
    expect([positions[0], positions[1]]).toEqual([
      Math.fround(points.xs[0]!),
      Math.fround(points.ys[0]!),
    ]);
    expect(uploads.some((d) => d instanceof Uint16Array && d.length === 1000)).toBe(true);
    expect(uploads.some((d) => d instanceof Uint8Array && d.length === 1000)).toBe(true);
    // A constant radius is one attribute value per draw, not a million.
    expect(named('vertexAttrib1f').map(([, , r]) => r)).toEqual([points.radius]);
    const [texture] = named('texImage2D');
    expect(texture?.slice(4, 6)).toEqual([points.palette.length, 1]);
  });

  it('draws dimmed points, then highlighted ones on top, inside the facet when the plot clips', () => {
    const { gl, calls, named } = fakeGl();
    pointsLayer(gl, geometry, { pixelRatio: 2 }).draw();
    expect(named('viewport')).toEqual([['viewport', 0, 0, 800, 600]]);
    const plot = geometry.facets[0]!.plot;
    expect(named('scissor')).toEqual([
      ['scissor', plot.left * 2, (300 - plot.bottom) * 2, plot.width * 2, plot.height * 2],
    ]);
    const passes = calls.filter(
      ([name, location]) =>
        name === 'uniform1f' && JSON.stringify(location) === JSON.stringify({ uniform: 'u_pass' }),
    );
    expect(passes.map(([, , pass]) => pass)).toEqual([0, 1]);
    expect(named('drawArrays')).toEqual([
      ['drawArrays', 0, 0, 1000],
      ['drawArrays', 0, 0, 1000],
    ]);
  });

  it("re-uploads only the dimmed flags when given a highlight's restyled geometry", () => {
    const { gl, named } = fakeGl();
    const layer = pointsLayer(gl, geometry);
    const before = named('bufferData').length;
    const restyled = highlightPoints(geometry, 0, rows, { field: 'x', range: [100, 199] });
    layer.highlight(restyled);
    expect(named('bufferData').length).toBe(before);
    const flagsOf = (call: number): Uint8Array => {
      const data = named('bufferSubData')[call]?.[3];
      if (!(data instanceof Uint8Array)) throw new Error('expected a flags upload');
      return data;
    };
    const flags = flagsOf(0);
    const points = restyled.facets[0]!.marks[0]!.graphics[0]!;
    if (points.kind !== 'points') throw new Error('expected packed points');
    expect<Uint8Array | undefined>(flags).toBe(points.dimmed);
    expect(flags.filter((f) => f === 0).length).toBe(100);
    layer.highlight(geometry);
    expect([...flagsOf(1)].every((f) => f === 0)).toBe(true);
  });

  it('refuses a highlight from different geometry', () => {
    const { gl } = fakeGl();
    const layer = pointsLayer(gl, geometry);
    const other = compilePlot({ ...spec, data: rows.slice(0, 10) });
    expect(() => layer.highlight(other)).toThrow('highlight: geometry has different points');
  });

  it('reports a shader that does not compile, with its log', () => {
    const { gl } = fakeGl({ compiles: false });
    expect(() => pointsLayer(gl, geometry)).toThrow(
      'webgl/points: shader did not compile: ERROR: 0:1: syntax error',
    );
  });

  it('releases everything it made on dispose', () => {
    const { gl, named } = fakeGl();
    pointsLayer(gl, geometry).dispose();
    expect(named('deleteBuffer').length).toBe(named('createBuffer').length);
    expect(named('deleteTexture').length).toBe(named('createTexture').length);
    expect(named('deleteProgram')).toHaveLength(1);
  });

  it('refuses geometry with no packed points, which belong on a canvas or SVG', () => {
    const { gl } = fakeGl();
    const sparse = compilePlot({ ...spec, marks: [{ mark: 'dot', x: 'x', y: 'y' }] });
    expect(() => pointsLayer(gl, sparse)).toThrow('webgl/points draws dense dot marks only');
  });
});

describe('pointsLayer.append', () => {
  const fixed = {
    width: 400,
    height: 300,
    x: { domain: [0, 1000] },
    y: { domain: [0, 101] },
    color: { domain: ['a', 'b', 'c'] },
    marks: [{ mark: 'dot', x: 'x', y: 'y', fill: 'g', dense: true }],
  } satisfies PlotSpec;
  const chunk = (from: number, count: number, kinds: ReadonlyArray<string> = ['a', 'b']) =>
    columnTable({
      x: Float64Array.from({ length: count }, (_, i) => from + i),
      y: Float64Array.from({ length: count }, (_, i) => ((from + i) * 37) % 101),
      g: Array.from({ length: count }, (_, i) => kinds[(from + i) % kinds.length] ?? 'a'),
    });
  const subData = (calls: ReadonlyArray<readonly [string, ...unknown[]]>) =>
    calls.flatMap(([name, , offset, data]) =>
      name === 'bufferSubData' && (data instanceof Float32Array || data instanceof Uint16Array)
        ? [[offset, data.length]]
        : [],
    );

  it('uploads only the new points while the buffers have room', () => {
    const first = compilePlot({ ...fixed, data: chunk(0, 100) });
    const { gl, calls, named } = fakeGl();
    const layer = pointsLayer(gl, first);
    // The first append outgrows buffers made at their exact size, and doubles them.
    const grown = appendPoints(first, fixed, chunk(100, 50), { rowOffset: 100 });
    layer.append(grown);
    calls.length = 0;
    layer.append(appendPoints(grown, fixed, chunk(150, 50), { rowOffset: 150 }));
    // Positions (two floats a point) and colour indices for points 150 to 199, at their offsets.
    expect(subData(calls)).toEqual([
      [150 * 2 * 4, 50 * 2],
      [150 * 2, 50],
    ]);
    expect(named('bufferData')).toHaveLength(1); // the dimmed flags, reset in full
    layer.draw();
    expect(named('drawArrays').at(-1)).toEqual(['drawArrays', 0, 0, 200]);
  });

  it('grows its buffers, doubling, when an append outruns them', () => {
    const first = compilePlot({ ...fixed, data: chunk(0, 100) });
    const { gl, calls } = fakeGl();
    const layer = pointsLayer(gl, first);
    calls.length = 0;
    layer.append(appendPoints(first, fixed, chunk(100, 300), { rowOffset: 100 }));
    const sizes = calls.flatMap(([name, , data]) =>
      name === 'bufferData' && data instanceof Float32Array ? [data.length] : [],
    );
    expect(sizes).toContain(800 * 2);
  });

  it('re-uploads the palette when a chunk brings a new colour', () => {
    const first = compilePlot({ ...fixed, data: chunk(0, 10, ['a']) });
    const { gl, calls } = fakeGl();
    const layer = pointsLayer(gl, first);
    calls.length = 0;
    layer.append(appendPoints(first, fixed, chunk(10, 10, ['b', 'c']), { rowOffset: 10 }));
    expect(calls.filter(([name]) => name === 'texImage2D').map((call) => call[4])).toEqual([3]);
  });

  it('refuses geometry that is not this layer grown', () => {
    const first = compilePlot({ ...fixed, data: chunk(0, 100) });
    const { gl } = fakeGl();
    const layer = pointsLayer(gl, first);
    expect(() => layer.append(compilePlot({ ...fixed, data: chunk(0, 50) }))).toThrow(
      'append: geometry has fewer points than the layer',
    );
  });
});

describe('paintPlot without points', () => {
  it('leaves packed points to the GPU layer, painting the rest', () => {
    const all = canvasCalls();
    paintPlot(all.ctx, geometry);
    const rest = canvasCalls();
    paintPlot(rest.ctx, geometry, { points: false });
    expect(all.count('arc')).toBe(1000);
    expect(rest.count('arc')).toBe(0);
    expect(rest.count('fillText')).toBe(all.count('fillText'));
  });
});

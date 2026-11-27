import { Mount, UiSchema } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { interpolateRgbBasis } from '@opsydyn/foldkit-viz/math/color';
import { linear } from '@opsydyn/foldkit-viz/math/scale';
import {
  constrainScale,
  identityMatrix,
  matrixToInverseString,
  matrixToString,
  scaleAt,
  setTranslate,
  type TransformMatrix,
} from '@opsydyn/foldkit-viz/math/zoom';
import { pointerToPlot } from '@opsydyn/foldkit-viz/plot';
import { Option, Schema, Stream } from 'effect';

import { svgRoot } from '../shared';

// MODEL

const W = 480;
const H = 300;
const CX = W / 2;
const CY = H / 2;
const DOT_COUNT = 1000;
const MAX_DOT_RADIUS = 128;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const RAINBOW_STOPS = [
  '#6e40aa',
  '#4c6edb',
  '#23abd8',
  '#1ddfa3',
  '#52f667',
  '#aff05b',
  '#e2b72f',
  '#ff7747',
  '#fe4b83',
  '#bf3caf',
  '#6e40aa',
];

const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.2;

export type PhyllotaxisDot = Readonly<{
  x: number;
  y: number;
  color: string;
  r: number;
}>;

const Matrix = Schema.Struct({
  scaleX: Schema.Number,
  scaleY: Schema.Number,
  translateX: Schema.Number,
  translateY: Schema.Number,
  skewX: Schema.Number,
  skewY: Schema.Number,
});

const Drag = Schema.Struct({ pointerId: Schema.Number, x: Schema.Number, y: Schema.Number });

export const Model = Schema.Struct({
  matrix: Matrix,
  drag: Schema.NullOr(Drag),
  showMiniMap: Schema.Boolean,
});
export type Model = typeof Model.Type;

function computeInitialMatrix(): TransformMatrix {
  return scaleAt(identityMatrix(), 1.27, 1.27, { x: CX, y: CY });
}

export const init: Model = { matrix: computeInitialMatrix(), drag: null, showMiniMap: true };

function calculateDots(): ReadonlyArray<PhyllotaxisDot> {
  const colorInterp = interpolateRgbBasis(RAINBOW_STOPS);
  const sizeScale = linear({ domain: [0, 600], range: [0.5, 8], clamp: true });
  return Array.from({ length: DOT_COUNT }, (_, i) => {
    const angle = i * GOLDEN_ANGLE;
    const radial = Math.sqrt(i / DOT_COUNT) * MAX_DOT_RADIUS;
    const x = Math.round((CX + radial * Math.cos(angle)) * 100) / 100;
    const y = Math.round((CY + radial * Math.sin(angle)) * 100) / 100;
    const color = colorInterp(i / DOT_COUNT);
    const r = Math.round(sizeScale(i > 500 ? DOT_COUNT - i : i) * 10) / 10;
    return { x, y, color, r };
  });
}

const dots = calculateDots();

export const Message = UiSchema.TaggedEnum({
  ClickedZoomIn: {},
  ClickedZoomOut: {},
  ClickedCenter: {},
  ClickedReset: {},
  ClickedClear: {},
  ToggledMiniMap: {},
  StartedDrag: Drag.fields,
  MovedDrag: Drag.fields,
  EndedDrag: { pointerId: Schema.Number },
});
export type Message = typeof Message.Type;

function zoom(model: Model, step: number): Model {
  const scale = scaleAt(model.matrix, step, step, { x: CX, y: CY });
  return { ...model, matrix: constrainScale(scale, model.matrix, MIN_SCALE, MAX_SCALE) };
}

export const update = (model: Model, message: Message): Model =>
  Message.match(message, {
    ClickedZoomIn: () => zoom(model, ZOOM_STEP),
    ClickedZoomOut: () => zoom(model, 1 / ZOOM_STEP),
    ClickedCenter: () => {
      const { scaleX, scaleY } = model.matrix;
      return {
        ...model,
        matrix: setTranslate(model.matrix, CX * (1 - scaleX), CY * (1 - scaleY)),
      };
    },
    ClickedReset: () => ({ ...model, matrix: computeInitialMatrix() }),
    ClickedClear: () => ({ ...model, matrix: identityMatrix() }),
    ToggledMiniMap: () => ({ ...model, showMiniMap: !model.showMiniMap }),
    StartedDrag: ({ pointerId, x, y }) =>
      model.drag === null ? { ...model, drag: { pointerId, x, y } } : model,
    MovedDrag: ({ pointerId, x, y }) => {
      const { drag } = model;
      if (drag?.pointerId !== pointerId) return model;
      return {
        ...model,
        matrix: setTranslate(
          model.matrix,
          model.matrix.translateX + x - drag.x,
          model.matrix.translateY + y - drag.y,
        ),
        drag: { pointerId, x, y },
      };
    },
    EndedDrag: ({ pointerId }) =>
      model.drag?.pointerId === pointerId ? { ...model, drag: null } : model,
  });

const TrackDrag = Mount.makeStream('TrackPhyllotaxisDrag', { args: {} }, (element: Element) => {
  const at = (event: PointerEvent) => ({
    pointerId: event.pointerId,
    ...pointerToPlot({ x: event.clientX, y: event.clientY }, element.getBoundingClientRect(), {
      width: W,
      height: H,
    }),
  });
  const pointer = (event: string) => Stream.fromEventListener<PointerEvent>(element, event);
  const started = pointer('pointerdown').pipe(
    Stream.filter(({ button }) => button === 0),
    Stream.map((event) => Message.StartedDrag(at(event))),
  );
  const moved = pointer('pointermove').pipe(Stream.map((event) => Message.MovedDrag(at(event))));
  const ended = ['pointerup', 'pointercancel', 'pointerleave'].map((event) =>
    pointer(event).pipe(Stream.map(({ pointerId }) => Message.EndedDrag({ pointerId }))),
  );
  return Stream.mergeAll<Message, never, never>([started, moved, ...ended], {
    concurrency: 'unbounded',
  });
});

// VIEW

const MINI_SCALE = 0.25;
const MINI_TX = W * 4 - W - 60;
const MINI_TY = H * 4 - H - 60;

const BG = '#0a0a0a';
const BTN_BG = '#2f2f2f';
const BTN_TEXT = '#888';

// button dimensions
const BTN_ICON_W = 26;
const BTN_ICON_H = 22;
const BTN_TEXT_W = 52;
const BTN_TEXT_H = 16;
const BTN_X = W - 14 - BTN_ICON_W;
const BTN_TEXT_X = W - 14 - BTN_TEXT_W;

const MINI_BTN_W = 100;
const MINI_BTN_H = 14;
const MINI_BTN_Y = H - 12 - MINI_BTN_H;

const decodeKey = Schema.decodeUnknownOption(
  Schema.Struct({ key: Schema.String, composing: Schema.Boolean }),
);
// Generic SVG events go through the keyboard payload decoder.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
const keyboardActivation = (message: Message) => (event: unknown) =>
  Option.getOrUndefined(
    decodeKey(event).pipe(
      Option.filter(({ key, composing }) => !composing && (key === 'Enter' || key === ' ')),
      Option.map(() => message),
    ),
  );

type Control = Readonly<{
  label: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: string;
  message: Message;
}>;

function control(
  h: Html.H<Message>,
  { label, text, x, y, width, height, fontSize, message }: Control,
) {
  return h
    .el('g')
    .attrs({
      role: 'button',
      tabindex: '0',
      'aria-label': label,
      style: 'cursor:pointer;user-select:none',
    })
    .on('click', message)
    .on('keydown', keyboardActivation(message), { preventDefault: true })
    .children(
      h.el('rect').attrs({
        x: String(x),
        y: String(y),
        width: String(width),
        height: String(height),
        fill: BTN_BG,
      }),
      h
        .el('text')
        .attrs({
          x: String(x + width / 2),
          y: String(y + height / 2 + 1),
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          'font-size': fontSize,
          'pointer-events': 'none',
          fill: BTN_TEXT,
        })
        .children(text ?? label),
    );
}

function renderDots(h: Html.H<Message>) {
  return dots.map((dot) =>
    h
      .el('circle')
      .attrs({ cx: String(dot.x), cy: String(dot.y), r: String(dot.r), fill: dot.color }),
  );
}

export function view(h: Html.H<Message>, { matrix, drag, showMiniMap }: Model, ariaLabel: string) {
  const icon = (label: string, text: string, y: number, message: Message) =>
    control(h, {
      label,
      text,
      x: BTN_X,
      y,
      width: BTN_ICON_W,
      height: BTN_ICON_H,
      fontSize: '1.2rem',
      message,
    });
  const text = (label: string, y: number, message: Message) =>
    control(h, {
      label,
      x: BTN_TEXT_X,
      y,
      width: BTN_TEXT_W,
      height: BTN_TEXT_H,
      fontSize: '0.65rem',
      message,
    });
  const miniMapLabel = showMiniMap ? 'Hide Mini Map' : 'Show Mini Map';
  const miniMapX = Math.round(MINI_TX * MINI_SCALE);
  const miniMapW = Math.round(W * MINI_SCALE);

  const zoomInY = 10;
  const zoomOutY = zoomInY + BTN_ICON_H + 3;
  const centerY = zoomOutY + BTN_ICON_H + 8;
  const resetY = centerY + BTN_TEXT_H + 2;
  const clearY = resetY + BTN_TEXT_H + 2;
  const ground = { x: '0', y: '0', width: String(W), height: String(H) };

  return svgRoot(h, { width: W, height: H, ariaLabel, role: 'group' }, [
    h
      .el('defs')
      .children(h.el('clipPath').attr('id', 'ph-clip').children(h.el('rect').attrs(ground))),
    h.el('rect').attrs({ ...ground, rx: '14', fill: BG }),
    h
      .el('g')
      .attrs({
        transform: matrixToString(matrix),
        'data-phyllotaxis-spiral': '',
        'aria-hidden': 'true',
      })
      .children(renderDots(h)),
    h
      .el('rect')
      .attrs({
        ...ground,
        fill: 'transparent',
        style: `cursor:${drag === null ? 'grab' : 'grabbing'};touch-action:none`,
      })
      .onMount(Mount.map(TrackDrag(), (message) => message)),
    showMiniMap
      ? h
          .el('g')
          .attrs({
            'clip-path': 'url(#ph-clip)',
            transform: `scale(${MINI_SCALE}) translate(${MINI_TX}, ${MINI_TY})`,
            'aria-hidden': 'true',
          })
          .children(
            h.el('rect').attrs({ ...ground, fill: '#1a1a1a' }),
            renderDots(h),
            h.el('rect').attrs({
              ...ground,
              'data-phyllotaxis-viewport': '',
              fill: 'var(--page-text,#e8e8ff)',
              'fill-opacity': '0.1',
              stroke: 'var(--page-text,#e8e8ff)',
              'stroke-width': '4',
              transform: matrixToInverseString(matrix),
            }),
          )
      : undefined,
    icon('Zoom in', '+', zoomInY, Message.ClickedZoomIn()),
    icon('Zoom out', '−', zoomOutY, Message.ClickedZoomOut()),
    text('Center', centerY, Message.ClickedCenter()),
    text('Reset', resetY, Message.ClickedReset()),
    text('Clear', clearY, Message.ClickedClear()),
    h
      .el('g')
      .attr('clip-path', 'url(#ph-clip)')
      .children(
        control(h, {
          label: miniMapLabel,
          x: miniMapX + miniMapW - MINI_BTN_W,
          y: MINI_BTN_Y,
          width: MINI_BTN_W,
          height: MINI_BTN_H,
          fontSize: '0.55rem',
          message: Message.ToggledMiniMap(),
        }),
      ),
  ]);
}

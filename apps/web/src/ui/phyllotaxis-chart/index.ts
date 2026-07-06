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
  translateBy,
} from '@opsydyn/foldkit-viz/math/zoom';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
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

export type Model = Readonly<{
  dots: ReadonlyArray<PhyllotaxisDot>;
  matrix: TransformMatrix;
  isDragging: boolean;
  dragStart: Readonly<{ x: number; y: number }>;
  showMiniMap: boolean;
}>;

function computeInitialMatrix(): TransformMatrix {
  return scaleAt(identityMatrix(), 1.27, 1.27, { x: CX, y: CY });
}

export function init(): readonly [Model, readonly []] {
  const colorInterp = interpolateRgbBasis(RAINBOW_STOPS);
  const sizeScale = linear({ domain: [0, 600], range: [0.5, 8], clamp: true });

  const dots: PhyllotaxisDot[] = Array.from({ length: DOT_COUNT }, (_, i) => {
    const angle = i * GOLDEN_ANGLE;
    const radial = Math.sqrt(i / DOT_COUNT) * MAX_DOT_RADIUS;
    const x = Math.round((CX + radial * Math.cos(angle)) * 100) / 100;
    const y = Math.round((CY + radial * Math.sin(angle)) * 100) / 100;
    const color = colorInterp(i / DOT_COUNT);
    const r = Math.round(sizeScale(i > 500 ? DOT_COUNT - i : i) * 10) / 10;
    return { x, y, color, r };
  });

  return [
    {
      dots,
      matrix: computeInitialMatrix(),
      isDragging: false,
      dragStart: { x: 0, y: 0 },
      showMiniMap: true,
    },
    [],
  ];
}

// MESSAGE

export const ClickedZoomIn = m('ClickedZoomIn', {});
export const ClickedZoomOut = m('ClickedZoomOut', {});
export const ClickedCenter = m('ClickedCenter', {});
export const ClickedReset = m('ClickedReset', {});
export const ClickedClear = m('ClickedClear', {});
export const ToggledMiniMap = m('ToggledMiniMap', {});
export const StartedDrag = m('StartedDrag', { screenX: Schema.Number, screenY: Schema.Number });
export const MovedDrag = m('MovedDrag', { screenX: Schema.Number, screenY: Schema.Number });
export const EndedDrag = m('EndedDrag', {});

export const Message = Schema.Union([
  ClickedZoomIn,
  ClickedZoomOut,
  ClickedCenter,
  ClickedReset,
  ClickedClear,
  ToggledMiniMap,
  StartedDrag,
  MovedDrag,
  EndedDrag,
]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      ClickedZoomIn: () => {
        const zoomed = scaleAt(model.matrix, ZOOM_STEP, ZOOM_STEP, { x: CX, y: CY });
        return [
          { ...model, matrix: constrainScale(zoomed, model.matrix, MIN_SCALE, MAX_SCALE) },
          [],
        ];
      },
      ClickedZoomOut: () => {
        const zoomed = scaleAt(model.matrix, 1 / ZOOM_STEP, 1 / ZOOM_STEP, { x: CX, y: CY });
        return [
          { ...model, matrix: constrainScale(zoomed, model.matrix, MIN_SCALE, MAX_SCALE) },
          [],
        ];
      },
      ClickedCenter: () => {
        const { scaleX, scaleY } = model.matrix;
        return [
          { ...model, matrix: setTranslate(model.matrix, CX * (1 - scaleX), CY * (1 - scaleY)) },
          [],
        ];
      },
      ClickedReset: () => [{ ...model, matrix: computeInitialMatrix() }, []],
      ClickedClear: () => [{ ...model, matrix: identityMatrix() }, []],
      ToggledMiniMap: () => [{ ...model, showMiniMap: !model.showMiniMap }, []],
      StartedDrag: ({ screenX, screenY }) => [
        { ...model, isDragging: true, dragStart: { x: screenX, y: screenY } },
        [],
      ],
      MovedDrag: ({ screenX, screenY }) => {
        if (!model.isDragging) {
          return [model, []];
        }
        const dx = screenX - model.dragStart.x;
        const dy = screenY - model.dragStart.y;
        return [
          {
            ...model,
            matrix: translateBy(model.matrix, dx, dy),
            dragStart: { x: screenX, y: screenY },
          },
          [],
        ];
      },
      EndedDrag: () => [{ ...model, isDragging: false }, []],
    }),
  );

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

function iconBtn<M>(
  h: ReturnType<typeof html<M>>,
  label: string,
  x: number,
  y: number,
  msg: M,
): Html {
  return h.g(
    [h.OnClick(msg), h.Style({ cursor: 'pointer', 'user-select': 'none' })],
    [
      h.rect(
        [
          h.X(String(x)),
          h.Y(String(y)),
          h.Width(String(BTN_ICON_W)),
          h.Height(String(BTN_ICON_H)),
          h.Fill(BTN_BG),
        ],
        [],
      ),
      h.text(
        [
          h.X(String(x + BTN_ICON_W / 2)),
          h.Y(String(y + BTN_ICON_H / 2 + 1)),
          h.Style({
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': '1.2rem',
            fill: BTN_TEXT,
            'pointer-events': 'none',
          }),
        ],
        [label],
      ),
    ],
  );
}

function textBtn<M>(
  h: ReturnType<typeof html<M>>,
  label: string,
  x: number,
  y: number,
  w: number,
  fontSize: string,
  msg: M,
): Html {
  return h.g(
    [h.OnClick(msg), h.Style({ cursor: 'pointer', 'user-select': 'none' })],
    [
      h.rect(
        [
          h.X(String(x)),
          h.Y(String(y)),
          h.Width(String(w)),
          h.Height(String(BTN_TEXT_H)),
          h.Fill(BTN_BG),
        ],
        [],
      ),
      h.text(
        [
          h.X(String(x + w / 2)),
          h.Y(String(y + BTN_TEXT_H / 2 + 1)),
          h.Style({
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': fontSize,
            fill: BTN_TEXT,
            'pointer-events': 'none',
          }),
        ],
        [label],
      ),
    ],
  );
}

function renderDots<M>(
  h: ReturnType<typeof html<M>>,
  dots: ReadonlyArray<PhyllotaxisDot>,
): ReadonlyArray<Html> {
  return dots.map((dot) =>
    h.circle([h.Cx(String(dot.x)), h.Cy(String(dot.y)), h.R(String(dot.r)), h.Fill(dot.color)], []),
  );
}

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Phyllotaxis zoom and pan' } = config;
  const { dots, matrix, isDragging, showMiniMap } = model;

  const handlePointerDown = (
    _pointerType: string,
    _button: number,
    screenX: number,
    screenY: number,
    _ts: number,
    _clientX: number,
  ): Option.Option<M> => Option.some(toParentMessage(StartedDrag({ screenX, screenY })));

  const handlePointerMove = (
    screenX: number,
    screenY: number,
    _pointerType: string,
  ): Option.Option<M> =>
    isDragging ? Option.some(toParentMessage(MovedDrag({ screenX, screenY }))) : Option.none();

  const handlePointerUp = (
    _screenX: number,
    _screenY: number,
    _pointerType: string,
    _ts: number,
  ): Option.Option<M> => Option.some(toParentMessage(EndedDrag()));

  const handlePointerLeave = (_pointerType: string): Option.Option<M> =>
    isDragging ? Option.some(toParentMessage(EndedDrag())) : Option.none();

  const miniMapLabel = showMiniMap ? 'Hide Mini Map' : 'Show Mini Map';

  const miniMapX = Math.round(MINI_TX * MINI_SCALE);
  const miniMapW = Math.round(W * MINI_SCALE);

  const miniMapBtnX = miniMapX + miniMapW - MINI_BTN_W;

  // button y positions (top-right)
  const zoomInY = 10;
  const zoomOutY = zoomInY + BTN_ICON_H + 3;
  const centerY = zoomOutY + BTN_ICON_H + 8;
  const resetY = centerY + BTN_TEXT_H + 2;
  const clearY = resetY + BTN_TEXT_H + 2;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.defs(
      [],
      [
        h.clipPath(
          [h.Attribute('id', 'ph-clip')],
          [h.rect([h.X('0'), h.Y('0'), h.Width(String(W)), h.Height(String(H))], [])],
        ),
      ],
    ),

    // Background
    h.rect(
      [
        h.X('0'),
        h.Y('0'),
        h.Width(String(W)),
        h.Height(String(H)),
        h.Attribute('rx', '14'),
        h.Fill(BG),
      ],
      [],
    ),

    // Zoomed dots
    h.g([h.Transform(matrixToString(matrix))], renderDots(h, dots)),

    // Drag overlay
    h.rect(
      [
        h.X('0'),
        h.Y('0'),
        h.Width(String(W)),
        h.Height(String(H)),
        h.Fill('transparent'),
        h.Style({ cursor: isDragging ? 'grabbing' : 'grab', 'touch-action': 'none' }),
        h.OnPointerDown(handlePointerDown),
        h.OnPointerMove(handlePointerMove),
        h.OnPointerUp(handlePointerUp),
        h.OnPointerLeave(handlePointerLeave),
      ],
      [],
    ),

    // Mini map
    ...(showMiniMap
      ? [
          h.g(
            [
              h.Attribute('clip-path', 'url(#ph-clip)'),
              h.Transform(`scale(${MINI_SCALE}) translate(${MINI_TX}, ${MINI_TY})`),
            ],
            [
              h.rect(
                [h.X('0'), h.Y('0'), h.Width(String(W)), h.Height(String(H)), h.Fill('#1a1a1a')],
                [],
              ),
              ...renderDots(h, dots),
              // Viewport indicator
              h.rect(
                [
                  h.X('0'),
                  h.Y('0'),
                  h.Width(String(W)),
                  h.Height(String(H)),
                  h.Fill('var(--page-text, #e8e8ff)'),
                  h.Attribute('fill-opacity', '0.1'),
                  h.Stroke('var(--page-text, #e8e8ff)'),
                  h.StrokeWidth('4'),
                  h.Transform(matrixToInverseString(matrix)),
                ],
                [],
              ),
            ],
          ),
        ]
      : []),

    // Controls (top-right)
    iconBtn(h, '+', BTN_X, zoomInY, toParentMessage(ClickedZoomIn())),
    iconBtn(h, '−', BTN_X, zoomOutY, toParentMessage(ClickedZoomOut())),
    textBtn(
      h,
      'Center',
      BTN_TEXT_X,
      centerY,
      BTN_TEXT_W,
      '0.65rem',
      toParentMessage(ClickedCenter()),
    ),
    textBtn(
      h,
      'Reset',
      BTN_TEXT_X,
      resetY,
      BTN_TEXT_W,
      '0.65rem',
      toParentMessage(ClickedReset()),
    ),
    textBtn(
      h,
      'Clear',
      BTN_TEXT_X,
      clearY,
      BTN_TEXT_W,
      '0.65rem',
      toParentMessage(ClickedClear()),
    ),

    // Mini map toggle (bottom-right, inside clip)
    h.g(
      [h.Attribute('clip-path', 'url(#ph-clip)')],
      [
        textBtn(
          h,
          miniMapLabel,
          miniMapBtnX,
          MINI_BTN_Y,
          MINI_BTN_W,
          '0.55rem',
          toParentMessage(ToggledMiniMap()),
        ),
      ],
    ),
  ]);
}

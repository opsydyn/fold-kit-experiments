/**
 * An interactive page as a Foldkit app (ADR 0110): its Flags are the page (prose, inputs,
 * chart specs and the rows those charts use), its Model adds each input's value, and a
 * reader changing an input, or clicking a chart's category (ADR 0116), sets one. The
 * build renders it to HTML; the page's script hydrates that HTML with the same `init`,
 * `update` and `view`. The inputs also live in the page's query string, so a link opens
 * the page as it was shared.
 * @module App
 */
import { plotChart, type PlotOverlay } from '@opsydyn/foldkit-viz/foldkit/plot';
import { chartCommandOf, targetAfter } from '@opsydyn/foldkit-viz/interaction/keyboard';
import { plotTable, pointerToPlot } from '@opsydyn/foldkit-viz/plot';
import { Effect, Option, Result, Schema } from 'effect';
import { Command, CustomElement, Mount, Navigation } from 'foldkit';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { Return } from 'foldkit/update';

import {
  choiceAt as pressedChoice,
  type Drawn,
  drawSpec,
  pointedAt,
  spanPixels,
  type Target,
  targetsOf,
  valueAtPixel,
} from './chart';
import {
  Choice,
  defaultsOf,
  type End,
  Input,
  InputValue,
  queryOf,
  Span,
  Values,
  valuesFromQuery,
} from './inputs';
import { JsonRecord, Rows } from './rows';

/** A part of a page: prose, an input, a chart, or a fence the build found broken. */
export const Section = Schema.Union([
  Schema.TaggedStruct('Prose', { html: Schema.String }),
  Schema.TaggedStruct('Control', { input: Input }),
  Schema.TaggedStruct('Chart', { line: Schema.Int, spec: JsonRecord }),
  Schema.TaggedStruct('Broken', { line: Schema.Int, message: Schema.String }),
]);
export type Section = typeof Section.Type;

/** The page, as the build hands it over: its parts in order, and its charts' rows by name. */
export const Flags = Schema.Struct({
  title: Schema.String,
  sections: Schema.Array(Section),
  data: Schema.Record(Schema.String, Rows),
});
export type Flags = typeof Flags.Type;

/** A chart key's command, as foldkit-viz's keyboard contract gives it. */
const ChartKey = Schema.Union([
  Schema.TaggedStruct('Step', { by: Schema.Int }),
  Schema.TaggedStruct('Jump', { to: Schema.Literals(['first', 'last']) }),
  Schema.TaggedStruct('Clear', {}),
  Schema.TaggedStruct('Select', {}),
  /** Shift with Down or Up: the next or previous series (ADR 0119). */
  Schema.TaggedStruct('Series', { by: Schema.Int }),
]);

/** The value a reader points at (ADR 0118): the chart, by its fence's line, and the target. */
const Pointed = Schema.NullOr(Schema.Struct({ line: Schema.Int, index: Schema.Int }));

/** A drag across a chart (ADR 0119): the chart, and where it started and is now, in pixels. */
const Drag = Schema.NullOr(
  Schema.Struct({ line: Schema.Int, from: Schema.Number, to: Schema.Number }),
);

export const Model = Schema.Struct({
  ...Flags.fields,
  values: Values,
  pointed: Pointed,
  drag: Drag,
  /** The chart that has keyboard focus, by its fence's line, so it can show its keys. */
  focused: Schema.NullOr(Schema.Int),
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  /** A reader chose a value for an input (`null`: a select's or radio's `all`). */
  ChangedInput: { name: Schema.String, value: InputValue },
  /** A reader clicked a chart's category, choosing it for the input the chart selects. */
  ClickedChart: { name: Schema.String, value: InputValue },
  /** The page's query string when it opened: the values a shared link carries. */
  OpenedWithQuery: { query: Schema.String },
  /** The query string now holds the inputs' values. */
  CompletedWriteQuery: {},
  /** A reader pointed at a chart's value, or away from every one (`index` null). */
  PointedChart: { line: Schema.Int, index: Schema.NullOr(Schema.Int) },
  /** A chart's pointer forwarding is in place. */
  CompletedForwardPointer: {},
  /** A reader pressed one of a chart's keys (ADR 0118). */
  PressedChartKey: { line: Schema.Int, command: ChartKey },
  /** A press, move or release while dragging across a chart, at an x in its pixels. */
  DraggedChart: {
    line: Schema.Int,
    phase: Schema.Literals(['down', 'move', 'up']),
    x: Schema.Number,
  },
  /** A chart took keyboard focus, or gave it up (`line` null). */
  FocusedChart: { line: Schema.NullOr(Schema.Int) },
});
export type Message = typeof Message.Type;

/** Reads the query string the page opened with. */
const ReadQuery = Command.define('ReadQuery', {
  messages: [Message.OpenedWithQuery],
  execute: Effect.sync(() => Message.OpenedWithQuery({ query: window.location.search })),
});

/** Puts the inputs' values in the query string, replacing the entry rather than adding one. */
const WriteQuery = Command.define('WriteQuery', {
  args: { query: Schema.String },
  messages: [Message.CompletedWriteQuery],
  execute: ({ query }) =>
    Effect.suspend(() =>
      Navigation.replaceUrl(`${window.location.pathname}${query}${window.location.hash}`),
    ).pipe(Effect.map(() => Message.CompletedWriteQuery())),
});

const isNumber = Schema.is(Schema.Finite);

const inputsOf = (sections: ReadonlyArray<Section>): ReadonlyArray<Input> =>
  sections.flatMap((section) => (section._tag === 'Control' ? [section.input] : []));

/** The page at its inputs' defaults, as the build rendered it; then the query is read. */
export const init = (flags: Flags): Return<Model, Message> => ({
  model: {
    ...flags,
    values: defaultsOf(inputsOf(flags.sections)),
    pointed: null,
    drag: null,
    focused: null,
  },
  commands: [ReadQuery()],
});

/** The model with one input set, and the query string written to match. */
const choose = (model: Model, name: string, value: InputValue): Return<Model, Message> => {
  const values = { ...model.values, [name]: value };
  return {
    model: { ...model, values },
    commands: [WriteQuery({ query: queryOf(inputsOf(model.sections), values) })],
  };
};

export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    ChangedInput: ({ name, value }) => choose(model, name, value),
    ClickedChart: ({ name, value }) => choose(model, name, value),
    OpenedWithQuery: ({ query }) => ({
      model: {
        ...model,
        values: { ...model.values, ...valuesFromQuery(inputsOf(model.sections), query) },
      },
    }),
    CompletedWriteQuery: () => ({ model }),
    PointedChart: ({ line, index }) => ({
      model: { ...model, pointed: index === null ? null : { line, index } },
    }),
    CompletedForwardPointer: () => ({ model }),
    PressedChartKey: ({ line, command }) => pressedKey(model, line, command),
    DraggedChart: ({ line, phase, x }) => dragged(model, line, phase, x),
    FocusedChart: ({ line }) => ({ model: { ...model, focused: line } }),
  });

/** A chart's drawing as the model draws it now, with its spec. */
const drawnAt = (model: Model, line: number) => {
  const section = model.sections.find((each) => each._tag === 'Chart' && each.line === line);
  if (section?._tag !== 'Chart') return undefined;
  const drawn = drawSpec(section.spec, new Map(Object.entries(model.data)), model.values);
  return Result.isSuccess(drawn) ? { drawn: drawn.success, spec: section.spec } : undefined;
};

/** How far, in pixels, a press must move to be a drag rather than a click. */
const dragSlop = 4;

/**
 * A drag across a chart that brushes (ADR 0119): a press starts it, moves stretch it, and
 * the release sets the `between` input to the span dragged across, its ends read from
 * the chart's `x` (rounded to the input's step, or to the day). A release where it
 * started, a click, sets the whole span back.
 */
const dragged = (
  model: Model,
  line: number,
  phase: 'down' | 'move' | 'up',
  x: number,
): Return<Model, Message> => {
  if (phase === 'down') return { model: { ...model, drag: { line, from: x, to: x } } };
  const drag = model.drag;
  if (drag === null || drag.line !== line) return { model };
  if (phase === 'move') return { model: { ...model, drag: { ...drag, to: x } } };
  const settled = { ...model, drag: null };
  const found = drawnAt(model, line);
  const input = inputsOf(model.sections).find((each) => each.name === found?.drawn.brushes);
  if (found === undefined || input?._tag !== 'Between') return { model: settled };
  if (Math.abs(x - drag.from) < dragSlop) {
    return choose(settled, input.name, { min: input.min, max: input.max });
  }
  const end = (px: number): End | undefined => {
    const at = Option.getOrUndefined(valueAtPixel(found.drawn, px));
    if (at === undefined) return undefined;
    const stepped = isNumber(at) ? Math.round(at / input.step) * input.step : at;
    return stepped < input.min ? input.min : stepped > input.max ? input.max : stepped;
  };
  const min = end(Math.min(drag.from, x));
  const max = end(Math.max(drag.from, x));
  return min === undefined || max === undefined
    ? { model: settled }
    : choose(settled, input.name, { min, max });
};

/**
 * A chart key, applied to the model as it is now (not as it was drawn), so keys pressed
 * faster than the page redraws each act on the one before: End then Enter chooses what
 * End pointed at.
 */
const pressedKey = (
  model: Model,
  line: number,
  command: typeof ChartKey.Type,
): Return<Model, Message> => {
  const section = model.sections.find((each) => each._tag === 'Chart' && each.line === line);
  if (section?._tag !== 'Chart') return { model };
  const drawn = drawSpec(section.spec, new Map(Object.entries(model.data)), model.values);
  if (Result.isFailure(drawn)) return { model };
  const targets = targetsOf(drawn.success, section.spec);
  const current = model.pointed?.line === line ? model.pointed.index : undefined;
  if (command._tag === 'Series') {
    // The first value of the next (or previous) series, round the ends.
    const names = [...new Set(targets.map((target) => target.series))];
    const here = current === undefined ? undefined : targets[current]?.series;
    const at = here === undefined ? (command.by > 0 ? -1 : 0) : names.indexOf(here);
    const name = names[(at + command.by + names.length) % Math.max(names.length, 1)];
    const index = targets.findIndex((target) => target.series === name);
    return { model: { ...model, pointed: index === -1 ? null : { line, index } } };
  }
  if (command._tag !== 'Select') {
    const next = targets.length === 0 ? undefined : targetAfter(targets.length, current, command);
    return { model: { ...model, pointed: next === undefined ? null : { line, index: next } } };
  }
  const target = current === undefined ? undefined : targets[current];
  const input = inputsOf(model.sections).find((each) => each.name === drawn.success.selects?.input);
  if (target?.choice == null || input?._tag !== 'Choose') return { model };
  const choice = input.choices.find((each) => String(each) === target.choice);
  if (choice === undefined) return { model };
  const now = model.values[input.name] ?? null;
  return choose(model, input.name, now === choice && input.all !== null ? null : choice);
};

/** A select's or radio's option value: the choice's index, `-1` for `all`. */
const indexOf = (input: Extract<Input, { readonly _tag: 'Choose' }>, value: InputValue): string =>
  value === null || isChoices(value) || isSpan(value) ? '-1' : String(input.choices.indexOf(value));

const isChoices = Schema.is(Schema.Array(Choice));
const isSpan = Schema.is(Span);

/**
 * A `between` input (ADR 0119): a from and a to, as date or number fields, and a button
 * back to the whole span. A change that would put from after to moves the other end.
 */
const betweenControl = (
  h: HtmlBuilder<Message>,
  input: Extract<Input, { readonly _tag: 'Between' }>,
  value: InputValue,
): Html => {
  const id = `input-${input.name}`;
  const span = isSpan(value) ? value : input.value;
  const read = (text: string): End =>
    input.kind === 'date' ? text : Number.isFinite(Number(text)) ? Number(text) : input.min;
  const end = (which: 'min' | 'max', text: string) => {
    const at = read(text);
    const next = which === 'min' ? { min: at, max: span.max } : { min: span.min, max: at };
    return changed(input.name, next.min > next.max ? { min: next.max, max: next.min } : next);
  };
  const whole = span.min === input.min && span.max === input.max;
  const field = (which: 'min' | 'max', word: string) =>
    h.label(
      [],
      [
        word,
        h.input([
          h.Id(`${id}-${which}`),
          h.Type(input.kind === 'date' ? 'date' : 'number'),
          h.Min(String(input.min)),
          h.Max(String(input.max)),
          ...(input.kind === 'number' ? [h.Step(String(input.step))] : []),
          h.Value(String(span[which])),
          h.OnChange((text) => end(which, text)),
        ]),
      ],
    );
  return h.fieldset(
    [h.Class('control')],
    [
      h.legend([], [input.label]),
      field('min', 'From'),
      field('max', 'to'),
      h.button(
        [
          h.Type('button'),
          h.Disabled(whole),
          h.OnClick(changed(input.name, { min: input.min, max: input.max })),
        ],
        ['All'],
      ),
    ],
  );
};

const choiceAt = (input: Extract<Input, { readonly _tag: 'Choose' }>, index: string): InputValue =>
  input.choices[Number(index)] ?? null;

const changed = (name: string, value: InputValue): Message => Message.ChangedInput({ name, value });

/** The choices, with `all` first when the input has one. */
const options = (input: Extract<Input, { readonly _tag: 'Choose' }>) => [
  ...(input.all === null ? [] : [{ index: '-1', text: input.all, value: null }]),
  ...input.choices.map((choice, i) => ({ index: String(i), text: String(choice), value: choice })),
];

const control = (h: HtmlBuilder<Message>, input: Input, value: InputValue): Html => {
  const id = `input-${input.name}`;
  if (input._tag === 'Between') return betweenControl(h, input, value);
  if (input._tag === 'Pick') {
    // A group of checkboxes (ADR 0117): ticking one adds it to the list, in the choices'
    // order; unticking removes it.
    const ticked = isChoices(value) ? value : [];
    return h.fieldset(
      [h.Class('control')],
      [
        h.legend([], [input.label]),
        ...input.choices.map((choice, i) => {
          const on = ticked.includes(choice);
          const next = input.choices.filter((each) =>
            each === choice ? !on : ticked.includes(each),
          );
          return h.label(
            [],
            [
              h.input([
                h.Type('checkbox'),
                h.Name(`${id}-${i}`),
                h.Checked(on),
                h.OnChange(() => changed(input.name, next)),
              ]),
              String(choice),
            ],
          );
        }),
      ],
    );
  }
  if (input._tag === 'Toggle') {
    const on = value === true;
    return h.div(
      [h.Class('control')],
      [
        h.input([
          h.Id(id),
          h.Type('checkbox'),
          h.Checked(on),
          h.OnChange(() => changed(input.name, !on)),
        ]),
        h.label([h.For(id)], [input.label]),
      ],
    );
  }
  if (input._tag === 'Range') {
    const at = isNumber(value) ? value : input.value;
    return h.div(
      [h.Class('control')],
      [
        h.label([h.For(id)], [input.label]),
        h.input([
          h.Id(id),
          h.Type('range'),
          h.Min(String(input.min)),
          h.Max(String(input.max)),
          h.Step(String(input.step)),
          h.Value(String(at)),
          h.OnInput((text) => changed(input.name, Number(text))),
        ]),
        h.output([h.For(id)], [String(at)]),
      ],
    );
  }
  if (input.style === 'select') {
    return h.div(
      [h.Class('control')],
      [
        h.label([h.For(id)], [input.label]),
        h.select(
          [h.Id(id), h.OnChange((index) => changed(input.name, choiceAt(input, index)))],
          options(input).map((option) =>
            h.option(
              [h.Value(option.index), h.Selected(option.index === indexOf(input, value))],
              [option.text],
            ),
          ),
        ),
      ],
    );
  }
  return h.fieldset(
    [h.Class('control')],
    [
      h.legend([], [input.label]),
      ...options(input).map((option) =>
        h.label(
          [],
          [
            h.input([
              h.Type('radio'),
              h.Name(id),
              h.Value(option.index),
              h.Checked(option.index === indexOf(input, value)),
              h.OnChange(() => changed(input.name, option.value)),
            ]),
            option.text,
          ],
        ),
      ),
    ],
  );
};

const note = (h: HtmlBuilder<Message>, line: number, message: string): Html =>
  h.p([h.Class('problem'), h.Role('note')], [`Chart at line ${line}: ${message}`]);

/** A pointer over a chart, already in the chart's own pixels. */
const PointerFact = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  phase: Schema.Literals(['down', 'move', 'up']),
});

const POINTER_EVENT = 'dash-chart-pointer';

/** The chart's own DOM event, so pointer moves reach the dispatcher as typed facts. */
const chartEvents = CustomElement.define({
  tag: 'foldkit-dash-chart',
  properties: {},
  events: { [POINTER_EVENT]: PointerFact },
});

/**
 * Forwards pointer moves over a chart as plot-pixel facts. A move carries only screen
 * positions in Foldkit's handlers, so this reads the client position and the drawing's
 * rendered size where the event happens, as the web app's plot panel does.
 */
const ForwardPointer = Mount.define('ForwardDashChartPointer', {
  args: { width: Schema.Number, height: Schema.Number },
  messages: [Message.CompletedForwardPointer],
  execute: ({ element, width, height }) => {
    const listen = Effect.sync(() => {
      const listener = (event: Event) => {
        if (!(event instanceof PointerEvent)) return;
        const drawn = element.querySelector('svg') ?? element;
        const point = pointerToPlot(
          { x: event.clientX, y: event.clientY },
          drawn.getBoundingClientRect(),
          { width, height },
        );
        const phase =
          event.type === 'pointerdown' ? 'down' : event.type === 'pointerup' ? 'up' : 'move';
        // Keep receiving moves while a drag goes outside the chart.
        if (phase === 'down' && element instanceof HTMLElement) {
          element.setPointerCapture?.(event.pointerId);
        }
        element.dispatchEvent(new CustomEvent(POINTER_EVENT, { detail: { ...point, phase } }));
      };
      for (const type of ['pointermove', 'pointerdown', 'pointerup']) {
        element.addEventListener(type, listener);
      }
      return listener;
    });
    return Effect.acquireRelease(listen, (listener) =>
      Effect.sync(() => {
        for (const type of ['pointermove', 'pointerdown', 'pointerup']) {
          element.removeEventListener(type, listener);
        }
      }),
    ).pipe(
      Effect.map(() => Message.CompletedForwardPointer()),
      Effect.withSpan('ForwardDashChartPointer'),
    );
  },
});

/**
 * A chart's keys (ADR 0118): arrows, Page Up and Down, Home and End step through its
 * values, Escape stops pointing, and Enter or Space chooses the value pointed at on a
 * chart that selects. Other keys keep their default. The update applies them.
 */
const chartKeys =
  (line: number) =>
  (key: string, modifiers: Parameters<typeof chartCommandOf>[1]): Option.Option<Message> => {
    const shifted = modifiers?.shiftKey === true;
    if (shifted && (key === 'ArrowDown' || key === 'ArrowUp')) {
      const by = key === 'ArrowDown' ? 1 : -1;
      return Option.some(Message.PressedChartKey({ line, command: { _tag: 'Series', by } }));
    }
    return Option.map(Option.fromUndefinedOr(chartCommandOf(key, modifiers)), (command) =>
      Message.PressedChartKey({ line, command }),
    );
  };

/**
 * The span a chart that brushes shows as a band (ADR 0119): the drag under way, or the
 * input's value when it is not the whole span; in the chart's pixels.
 */
const bandOf = (
  model: Model,
  drawn: Drawn,
  line: number,
): { readonly x0: number; readonly x1: number } | undefined => {
  if (drawn.brushes === null) return undefined;
  if (model.drag?.line === line) {
    return {
      x0: Math.min(model.drag.from, model.drag.to),
      x1: Math.max(model.drag.from, model.drag.to),
    };
  }
  const input = inputsOf(model.sections).find((each) => each.name === drawn.brushes);
  const value = model.values[drawn.brushes];
  if (input?._tag !== 'Between' || !isSpan(value)) return undefined;
  if (value.min === input.min && value.max === input.max) return undefined;
  return Option.getOrUndefined(Option.map(spanPixels(drawn, value), ([x0, x1]) => ({ x0, x1 })));
};

const chart = (
  h: HtmlBuilder<Message>,
  model: Model,
  data: ReadonlyMap<string, Rows>,
  section: Extract<Section, { readonly _tag: 'Chart' }>,
): Html =>
  Result.match(drawSpec(section.spec, data, model.values), {
    onFailure: (problem) => note(h, section.line, problem.message),
    onSuccess: (drawn) => {
      const events = chartEvents.withMessage(h);
      const targets = targetsOf(drawn, section.spec);
      const index = model.pointed?.line === section.line ? model.pointed.index : undefined;
      const target = index === undefined ? undefined : targets[index];
      const band = bandOf(model, drawn, section.line);
      const marked: PlotOverlay = {
        ...(target === undefined ? undefined : { ring: { x: target.x, y: target.y, r: 6 } }),
        ...(band === undefined ? undefined : { brush: band }),
      };
      const overlay = { overlay: marked };
      const dragging = model.drag?.line === section.line;
      const hint = [
        'Arrow keys read values',
        'Shift with Up or Down changes series',
        ...(drawn.selects === null ? [] : [`Enter chooses ${drawn.selects.input}`]),
        ...(drawn.brushes === null ? [] : [`drag across to choose ${drawn.brushes}`]),
      ].join('; ');
      const readout = target?.text ?? (model.focused === section.line ? `${hint}.` : '');
      return h.figure(
        [
          h.Class(
            [
              'chart',
              drawn.selects === null ? '' : 'selects',
              drawn.brushes === null ? '' : 'brushes',
            ]
              .filter((name) => name !== '')
              .join(' '),
          ),
          h.OnFocus(Message.FocusedChart({ line: section.line })),
          h.OnBlur(Message.FocusedChart({ line: null })),
          h.Tabindex(0),
          // Its name says what the chart answers; the drawing keeps its own summary.
          h.Attribute('aria-roledescription', 'interactive chart'),
          h.AriaLabel(`Chart: ${hint}`),
          h.OnMount(ForwardPointer({ width: drawn.geometry.width, height: drawn.geometry.height })),
          events.OnDashChartPointer(({ x, y, phase }) =>
            drawn.brushes !== null && (phase !== 'move' || dragging)
              ? Message.DraggedChart({ line: section.line, phase, x })
              : Message.PointedChart({
                  line: section.line,
                  index: pointedAt(drawn, targets, x, y) ?? null,
                }),
          ),
          h.OnPointerLeave(() =>
            Option.some(Message.PointedChart({ line: section.line, index: null })),
          ),
          h.OnKeyDownPreventDefault(chartKeys(section.line)),
          ...(drawn.selects === null ? [] : [h.OnPointerDown(clicked(model, drawn))]),
        ],
        [
          plotChart(h, drawn.geometry, {
            table: plotTable(drawn.plot),
            summary: true,
            ...overlay,
          }),
          h.p([h.Class('readout'), h.AriaLive('polite')], [readout]),
        ],
      );
    },
  });

/**
 * The category a press on a chart lands on, or the legend entry pressed (ADR 0118), as
 * the input it selects (ADR 0116): the
 * pointer in the chart's own pixels, then the band there. Pressing the chosen category
 * again goes back to `all` when the input has one. Off a band, or for another button,
 * nothing happens.
 */
const clicked =
  (model: Model, drawn: Drawn) =>
  (
    _pointerType: string,
    button: number,
    _screenX: number,
    _screenY: number,
    _timeStamp: number,
    clientX: number,
    clientY: number,
    _pointerId: number,
    target: EventTarget | null,
  ): Option.Option<Message> => {
    const { selects, geometry } = drawn;
    const svg =
      target instanceof Element ? target.closest('figure.chart')?.querySelector('svg') : null;
    const input = inputsOf(model.sections).find((each) => each.name === selects?.input);
    if (button !== 0 || selects === null || svg == null || input?._tag !== 'Choose') {
      return Option.none();
    }
    // A press on a legend entry chooses what it names (ADR 0118); elsewhere, what is
    // drawn under the pointer.
    const entry = target instanceof Element ? target.closest('.plot-legend li') : null;
    const point = pointerToPlot({ x: clientX, y: clientY }, svg.getBoundingClientRect(), geometry);
    const category =
      entry === null
        ? pressedChoice(drawn, point.x, point.y)
        : Option.some((entry.textContent ?? '').trim());
    const choice = Option.flatMap(category, (name) =>
      Option.fromUndefinedOr(input.choices.find((each) => String(each) === name)),
    );
    if (Option.isNone(choice)) return Option.none();
    const current = model.values[input.name] ?? null;
    const value = current === choice.value && input.all !== null ? null : choice.value;
    return Option.some(Message.ClickedChart({ name: input.name, value }));
  };

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const data = new Map(Object.entries(model.data));
  return {
    title: model.title,
    body: h.div(
      [h.Class('dash-app')],
      model.sections.map((section) => {
        if (section._tag === 'Prose')
          return h.div([h.Class('prose'), h.InnerHTML(section.html)], []);
        if (section._tag === 'Control') {
          return control(h, section.input, model.values[section.input.name] ?? null);
        }
        if (section._tag === 'Broken') return note(h, section.line, section.message);
        return chart(h, model, data, section);
      }),
    ),
  };
};

/**
 * An interactive page as a Foldkit app (ADR 0110): its Flags are the page (prose, inputs,
 * chart specs and the rows those charts use), its Model adds each input's value, and a
 * reader changing an input, or clicking a chart's category (ADR 0116), sets one. The
 * build renders it to HTML; the page's script hydrates that HTML with the same `init`,
 * `update` and `view`. The inputs also live in the page's query string, so a link opens
 * the page as it was shared.
 * @module App
 */
import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
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
  type Target,
  targetsOf,
} from './chart';
import { Choice, defaultsOf, Input, InputValue, queryOf, Values, valuesFromQuery } from './inputs';
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

/** The value a reader points at (ADR 0118): the chart, by its fence's line, and the target. */
const Pointed = Schema.NullOr(Schema.Struct({ line: Schema.Int, index: Schema.Int }));

export const Model = Schema.Struct({ ...Flags.fields, values: Values, pointed: Pointed });
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
  model: { ...flags, values: defaultsOf(inputsOf(flags.sections)), pointed: null },
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
  });

/** A select's or radio's option value: the choice's index, `-1` for `all`. */
const indexOf = (input: Extract<Input, { readonly _tag: 'Choose' }>, value: InputValue): string =>
  value === null || isChoices(value) ? '-1' : String(input.choices.indexOf(value));

const isChoices = Schema.is(Schema.Array(Choice));

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
const PointerFact = Schema.Struct({ x: Schema.Number, y: Schema.Number });

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
        element.dispatchEvent(new CustomEvent(POINTER_EVENT, { detail: point }));
      };
      element.addEventListener('pointermove', listener);
      return listener;
    });
    return Effect.acquireRelease(listen, (listener) =>
      Effect.sync(() => element.removeEventListener('pointermove', listener)),
    ).pipe(
      Effect.map(() => Message.CompletedForwardPointer()),
      Effect.withSpan('ForwardDashChartPointer'),
    );
  },
});

/** The message for choosing what a target picks, as a press on it would. */
const chooseTarget = (
  model: Model,
  drawn: Drawn,
  target: Target | undefined,
): Option.Option<Message> => {
  const input = inputsOf(model.sections).find((each) => each.name === drawn.selects?.input);
  if (target?.choice == null || input?._tag !== 'Choose') return Option.none();
  const choice = input.choices.find((each) => String(each) === target.choice);
  if (choice === undefined) return Option.none();
  const current = model.values[input.name] ?? null;
  const value = current === choice && input.all !== null ? null : choice;
  return Option.some(Message.ClickedChart({ name: input.name, value }));
};

/**
 * A chart's keys (ADR 0118): arrows, Page Up and Down, Home and End step through its
 * values, Escape stops pointing, and Enter or Space chooses the value pointed at on a
 * chart that selects. Other keys keep their default.
 */
const chartKeys =
  (model: Model, drawn: Drawn, line: number, targets: ReadonlyArray<Target>) =>
  (key: string, modifiers: Parameters<typeof chartCommandOf>[1]): Option.Option<Message> => {
    const command = chartCommandOf(key, modifiers);
    if (command === undefined || targets.length === 0) return Option.none();
    const current = model.pointed?.line === line ? model.pointed.index : undefined;
    if (command._tag === 'Select') {
      return current === undefined ? Option.none() : chooseTarget(model, drawn, targets[current]);
    }
    const next = targetAfter(targets.length, current, command);
    return Option.some(Message.PointedChart({ line, index: next ?? null }));
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
      const overlay =
        target === undefined ? {} : { overlay: { ring: { x: target.x, y: target.y, r: 6 } } };
      return h.figure(
        [
          h.Class(drawn.selects === null ? 'chart' : 'chart selects'),
          h.Tabindex(0),
          h.OnMount(ForwardPointer({ width: drawn.geometry.width, height: drawn.geometry.height })),
          events.OnDashChartPointer(({ x, y }) =>
            Message.PointedChart({
              line: section.line,
              index: pointedAt(drawn, targets, x, y) ?? null,
            }),
          ),
          h.OnPointerLeave(() =>
            Option.some(Message.PointedChart({ line: section.line, index: null })),
          ),
          h.OnKeyDownPreventDefault(chartKeys(model, drawn, section.line, targets)),
          ...(drawn.selects === null ? [] : [h.OnPointerDown(clicked(model, drawn))]),
        ],
        [
          plotChart(h, drawn.geometry, {
            table: plotTable(drawn.plot),
            summary: true,
            ...overlay,
          }),
          h.p([h.Class('readout'), h.AriaLive('polite')], [target?.text ?? '']),
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

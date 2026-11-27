/**
 * An interactive page as an Effect UI component (ADR 0110): its Flags are the page (prose, inputs,
 * chart specs and the rows those charts use), its Model adds each input's value, and a
 * reader changing an input, or clicking a chart's category (ADR 0116), sets one. The
 * build renders it to HTML; the page's script hydrates that HTML with the same `init`,
 * `update` and `view`. The inputs also live in the page's query string, so a link opens
 * the page as it was shared.
 * @module App
 */
import { Command, Mount, UiSchema, type View } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { plotChart } from '@opsydyn/foldkit-viz/effect-ui/plot';
import { chartCommandOf, targetAfter } from '@opsydyn/foldkit-viz/interaction/keyboard';
import { plotTables, pointerToPlot } from '@opsydyn/foldkit-viz/plot';
import { Effect, Option, Queue, Result, Schema, Stream } from 'effect';

import {
  choiceAt as pressedChoice,
  type Drawn,
  drawSpec,
  pointedAt,
  snappedAt,
  spanPixels,
  type Target,
  targetsOf,
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
import { Prose, renderProse } from './prose';
import { JsonRecord, Rows } from './rows';

/** A part of a page: prose, an input, a chart, or a fence the build found broken. */
export const Section = Schema.Union([
  Schema.TaggedStruct('Prose', { nodes: Schema.Array(Prose) }),
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

const Interaction = Schema.Struct({
  values: Values,
  pointed: Pointed,
  drag: Drag,
  /** The chart that has keyboard focus, by its fence's line, so it can show its keys. */
  focused: Schema.NullOr(Schema.Int),
  /** One end of a `between` input as typed so far, not yet applied (ADR 0119). */
  draft: Schema.NullOr(
    Schema.Struct({
      name: Schema.String,
      which: Schema.Literals(['min', 'max']),
      text: Schema.String,
    }),
  ),
});
export type Model = Flags & typeof Interaction.Type;

export const Message = UiSchema.TaggedEnum({
  /** A reader chose a value for an input (`null`: a select's or radio's `all`). */
  ChangedInput: { name: Schema.String, value: InputValue },
  OpenedWithQuery: { query: Schema.String },
  CompletedWriteQuery: {},
  LeftChart: {},
  ObservedPointer: {
    line: Schema.Int,
    phase: Schema.Literals(['down', 'move', 'up', 'cancel']),
    x: Schema.Number,
    y: Schema.Number,
    legend: Schema.NullOr(Schema.String),
  },
  /** A reader pressed one of a chart's keys (ADR 0118). */
  PressedChartKey: { line: Schema.Int, command: ChartKey },
  /** A chart took keyboard focus, or gave it up (`line` null). */
  FocusedChart: { line: Schema.NullOr(Schema.Int) },
  /** A reader typed into one end of a `between` input: a draft until committed. */
  EditedSpanEnd: {
    name: Schema.String,
    which: Schema.Literals(['min', 'max']),
    text: Schema.String,
  },
  /** The end being typed lost focus, or Enter was pressed: apply its draft. */
  CommittedSpanEnd: { name: Schema.String },
});
export type Message = typeof Message.Type;

/** Reads the query string the page opened with. */
const ReadQuery = Command.make('ReadQuery', { args: {} }, () =>
  Effect.sync(() => Message.OpenedWithQuery({ query: window.location.search })),
);

const WriteQuery = Command.make('WriteQuery', { args: { query: Schema.String } }, ({ query }) =>
  Effect.sync(() => {
    const url = new URL(window.location.href);
    url.search = query;
    window.history.replaceState(window.history.state, '', url);
    return Message.CompletedWriteQuery();
  }),
);

type Return<State, Event> = Readonly<{
  model: State;
  commands?: ReadonlyArray<Command.Command<Event>>;
}>;

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
    draft: null,
  },
  commands: [ReadQuery.make({})],
});

/** The model with one input set, and the query string written to match. */
const choose = (model: Model, name: string, value: InputValue): Return<Model, Message> => {
  const values = { ...model.values, [name]: value };
  return {
    model: { ...model, values },
    commands: [WriteQuery.make({ query: queryOf(inputsOf(model.sections), values) })],
  };
};

export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match({
    ChangedInput: ({ name, value }) => choose(model, name, value),
    OpenedWithQuery: ({ query }) => ({
      model: {
        ...model,
        values: { ...model.values, ...valuesFromQuery(inputsOf(model.sections), query) },
      },
    }),
    CompletedWriteQuery: () => ({ model }),
    LeftChart: () => ({ model: { ...model, pointed: null } }),
    ObservedPointer: (pointer) => pointerUpdated(model, pointer),
    PressedChartKey: ({ line, command }) => pressedKey(model, line, command),
    FocusedChart: ({ line }) => ({ model: { ...model, focused: line } }),
    EditedSpanEnd: (draft) => ({
      model: { ...model, draft: { name: draft.name, which: draft.which, text: draft.text } },
    }),
    CommittedSpanEnd: ({ name }) => committed(model, name),
  })(message);

/**
 * A typed end of a `between` input, applied (ADR 0119): a whole date or number within
 * the input's ends sets that end (swapping them if it passes the other); anything else
 * leaves the span as it was.
 */
const committed = (model: Model, name: string): Return<Model, Message> => {
  const draft = model.draft;
  const settled = { ...model, draft: null };
  const input = inputsOf(model.sections).find((each) => each.name === name);
  if (draft === null || draft.name !== name || input?._tag !== 'Between') {
    return { model: settled };
  }
  const value = model.values[name];
  const span = isSpan(value) ? value : input.value;
  const text = draft.text.trim();
  const at: End | undefined =
    input.kind === 'date'
      ? /^\d{4}-\d{2}-\d{2}$/.test(text)
        ? text
        : undefined
      : text !== '' && Number.isFinite(Number(text))
        ? Number(text)
        : undefined;
  if (at === undefined || at < input.min || at > input.max) return { model: settled };
  const next = draft.which === 'min' ? { min: at, max: span.max } : { min: span.min, max: at };
  return choose(settled, name, next.min > next.max ? { min: next.max, max: next.min } : next);
};

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
    const at = Option.getOrUndefined(snappedAt(found.drawn, px));
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
function betweenControl(
  h: Html.H<Message>,
  input: Extract<Input, { readonly _tag: 'Between' }>,
  value: InputValue,
  draft: Model['draft'],
) {
  const span = isSpan(value) ? value : input.value;
  const whole = span.min === input.min && span.max === input.max;
  const commit = Message.CommittedSpanEnd({ name: input.name });
  const field = (which: 'min' | 'max', label: string) =>
    h.label.children(
      label,
      h.input
        .id(`input-${input.name}-${which}`)
        .attr('type', input.kind)
        .attr('min', String(input.min))
        .attr('max', String(input.max))
        .attr('step', input.kind === 'number' ? String(input.step) : undefined)
        .value(
          draft?.name === input.name && draft.which === which ? draft.text : String(span[which]),
        )
        .on('input', ({ value: text }) => Message.EditedSpanEnd({ name: input.name, which, text }))
        .on('blur', commit)
        .on('keydown', ({ key }) => (key === 'Enter' ? commit : undefined), {
          preventDefault: true,
        }),
    );
  return h.fieldset.class('control').children(
    h.legend.children(input.label),
    field('min', 'From'),
    field('max', 'to'),
    h.button
      .attr('type', 'button')
      .disabled(whole)
      .on('click', changed(input.name, { min: input.min, max: input.max }))
      .children('All'),
  );
}

const changed = (name: string, value: InputValue): Message => Message.ChangedInput({ name, value });

const options = (input: Extract<Input, { readonly _tag: 'Choose' }>) => [
  ...(input.all === null ? [] : [{ index: '-1', text: input.all, value: null }]),
  ...input.choices.map((choice, i) => ({ index: String(i), text: String(choice), value: choice })),
];

function control(
  h: Html.H<Message>,
  input: Input,
  value: InputValue,
  draft: Model['draft'],
): View.Content<Message> {
  const id = `input-${input.name}`;
  if (input._tag === 'Between') return betweenControl(h, input, value, draft);
  if (input._tag === 'Pick') {
    const ticked = isChoices(value) ? value : [];
    return h.fieldset.class('control').children(
      h.legend.children(input.label),
      input.choices.map((choice, index) =>
        h.label.children(
          h.input
            .attr('type', 'checkbox')
            .attr('name', `${id}-${index}`)
            .checked(ticked.includes(choice))
            .on('change', ({ checked }) =>
              changed(
                input.name,
                input.choices.filter((item) => (item === choice ? checked : ticked.includes(item))),
              ),
            ),
          String(choice),
        ),
      ),
    );
  }
  if (input._tag === 'Toggle') {
    return h.div.class('control').children(
      h.input
        .id(id)
        .attr('type', 'checkbox')
        .checked(value === true)
        .on('change', ({ checked }) => changed(input.name, checked)),
      h.label.attr('for', id).children(input.label),
    );
  }
  if (input._tag === 'Range') {
    const at = isNumber(value) ? value : input.value;
    return h.div.class('control').children(
      h.label.attr('for', id).children(input.label),
      h.input
        .id(id)
        .attrs({
          type: 'range',
          min: String(input.min),
          max: String(input.max),
          step: String(input.step),
        })
        .value(String(at))
        .on('input', ({ value }) => changed(input.name, Number(value))),
      h.output.attr('for', id).children(String(at)),
    );
  }
  if (input.style === 'select') {
    return h.div.class('control').children(
      h.label.attr('for', id).children(input.label),
      h.select
        .id(id)
        .value(indexOf(input, value))
        .on('change', ({ value: index }) =>
          changed(input.name, input.choices[Number(index)] ?? null),
        )
        .children(
          options(input).map((option) =>
            h.option
              .attr('value', option.index)
              .selected(option.index === indexOf(input, value))
              .children(option.text),
          ),
        ),
    );
  }
  return h.fieldset.class('control').children(
    h.legend.children(input.label),
    options(input).map((option) =>
      h.label.children(
        h.input
          .attrs({ type: 'radio', name: id, value: option.index })
          .checked(option.index === indexOf(input, value))
          .on('change', () => changed(input.name, option.value)),
        option.text,
      ),
    ),
  );
}

const note = (h: Html.H<Message>, line: number, message: string) =>
  h.p.class('problem').attr('role', 'note').children(`Chart at line ${line}: ${message}`);

/** Capture stays with the chart until release, including a drag outside its bounds. */
const ForwardPointer = Mount.makeStream(
  'ForwardDashChartPointer',
  { args: { line: Schema.Int, width: Schema.Number, height: Schema.Number } },
  (element: HTMLElement, _args, changes) =>
    Stream.switchMap(changes, ({ line, width, height }) =>
      Stream.callback<Message>((queue) => {
        const listen = Effect.sync(() => {
          const draw =
            (phase: Extract<Message, { _tag: 'ObservedPointer' }>['phase']) =>
            (event: PointerEvent) => {
              if (phase === 'down' && event.button !== 0) return;
              const svg = element.querySelector('svg');
              if (!svg) return;
              const point = pointerToPlot(
                { x: event.clientX, y: event.clientY },
                svg.getBoundingClientRect(),
                { width, height },
              );
              const hit =
                event.target instanceof Element ? event.target.closest('.plot-legend li') : null;
              if (phase === 'down') element.setPointerCapture(event.pointerId);
              Queue.offerUnsafe(
                queue,
                Message.ObservedPointer({
                  line,
                  phase,
                  x: point.x,
                  y: point.y,
                  legend: hit?.textContent?.trim() ?? null,
                }),
              );
            };
          const listeners = {
            pointerdown: draw('down'),
            pointermove: draw('move'),
            pointerup: draw('up'),
            pointercancel: draw('cancel'),
            pointerleave: () => Queue.offerUnsafe(queue, Message.LeftChart()),
          };
          const types = [
            'pointerdown',
            'pointermove',
            'pointerup',
            'pointercancel',
            'pointerleave',
          ] as const;
          for (const type of types) element.addEventListener(type, listeners[type]);
          return () => {
            for (const type of types) element.removeEventListener(type, listeners[type]);
          };
        });
        return Effect.acquireRelease(listen, Effect.sync);
      }),
    ),
);

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
  h: Html.H<Message>,
  model: Model,
  data: ReadonlyMap<string, Rows>,
  section: Extract<Section, { readonly _tag: 'Chart' }>,
): View.Content<Message> =>
  Result.match(drawSpec(section.spec, data, model.values), {
    onFailure: (problem) => note(h, section.line, problem.message),
    onSuccess: (drawn) => {
      const targets = targetsOf(drawn, section.spec);
      const index = model.pointed?.line === section.line ? model.pointed.index : undefined;
      const target = index === undefined ? undefined : targets[index];
      const band = bandOf(model, drawn, section.line);
      const overlay = {
        ...(target === undefined ? undefined : { ring: { x: target.x, y: target.y, r: 6 } }),
        ...(band === undefined ? undefined : { brush: band }),
      };
      const hint = [
        'Arrow keys read values',
        'Shift with Up or Down changes series',
        ...(drawn.selects === null ? [] : [`Enter chooses ${drawn.selects.input}`]),
        ...(drawn.brushes === null ? [] : [`drag across to choose ${drawn.brushes}`]),
      ].join('; ');
      const readout = target?.text ?? (model.focused === section.line ? `${hint}.` : '');
      return h.figure
        .class('chart', drawn.selects !== null && 'selects', drawn.brushes !== null && 'brushes')
        .attr('tabindex', '0')
        .attr('aria-roledescription', 'interactive chart')
        .attr('aria-label', `Chart: ${hint}`)
        .on('focus', Message.FocusedChart({ line: section.line }))
        .on('blur', Message.FocusedChart({ line: null }))
        .onMount(
          ForwardPointer({
            line: section.line,
            width: drawn.geometry.width,
            height: drawn.geometry.height,
          }),
        )
        .on(
          'keydown',
          ({ key, shift, alt, ctrl, meta }) =>
            Option.getOrUndefined(
              chartKeys(section.line)(key, {
                shiftKey: shift,
                altKey: alt,
                ctrlKey: ctrl,
                metaKey: meta,
              }),
            ),
          { preventDefault: true },
        )
        .children(
          plotChart(h, drawn.geometry, {
            tables: plotTables(drawn.plot, drawn.geometry),
            summary: true,
            overlay,
          }),
          h.p.class('readout').attr('aria-live', 'polite').children(readout),
        );
    },
  });

function pointerUpdated(
  model: Model,
  { line, phase, x, y, legend }: Extract<Message, { _tag: 'ObservedPointer' }>,
): Return<Model, Message> {
  if (phase === 'cancel')
    return { model: model.drag?.line === line ? { ...model, drag: null } : model };
  const found = drawnAt(model, line);
  if (!found) return { model };
  const { drawn, spec } = found;
  const brush =
    drawn.brushes !== null && (phase !== 'move' || model.drag?.line === line)
      ? dragged(model, line, phase, x)
      : undefined;
  if (phase === 'down' && drawn.selects !== null) {
    const input = inputsOf(model.sections).find((entry) => entry.name === drawn.selects?.input);
    const category = legend ?? Option.getOrUndefined(pressedChoice(drawn, x, y));
    const choice =
      input?._tag === 'Choose'
        ? input.choices.find((entry) => String(entry) === category)
        : undefined;
    if (input?._tag === 'Choose' && choice !== undefined) {
      const current = model.values[input.name] ?? null;
      return choose(
        brush?.model ?? model,
        input.name,
        current === choice && input.all !== null ? null : choice,
      );
    }
  }
  if (brush) return brush;
  const index = pointedAt(drawn, targetsOf(drawn, spec), x, y);
  return { model: { ...model, pointed: index === undefined ? null : { line, index } } };
}

function view(h: Html.H<Message>, model: Model) {
  const data = new Map(Object.entries(model.data));
  return h.div.class('dash-app').children(
    model.sections.map((section) => {
      if (section._tag === 'Prose')
        return h.div.class('prose').children(section.nodes.map((node) => renderProse(h, node)));
      if (section._tag === 'Control')
        return control(h, section.input, model.values[section.input.name] ?? null, model.draft);
      if (section._tag === 'Broken') return note(h, section.line, section.message);
      return chart(h, model, data, section);
    }),
  );
}

const interactionOf = ({ values, pointed, drag, focused, draft }: Model) => ({
  values,
  pointed,
  drag,
  focused,
  draft,
});

export const Dash = Html.component({
  name: 'Dash',
  props: Flags,
  model: Interaction,
  message: Message,
}).make({
  init: ({ props, set }) => {
    const next = init(props);
    return set(interactionOf(next.model)).run(...(next.commands ?? []));
  },
  update: ($, message) => {
    const next = update({ ...$.props, ...$.model }, message);
    return $.set(interactionOf(next.model)).run(...(next.commands ?? []));
  },
  view: (h, model) => view(h, { ...h.props, ...model }),
});

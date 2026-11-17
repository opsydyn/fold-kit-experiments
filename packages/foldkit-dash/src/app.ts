/**
 * An interactive page as a Foldkit app (ADR 0110): its Flags are the page (prose, inputs,
 * chart specs and the rows those charts use), its Model adds each input's value, and a
 * reader changing an input is its one Message. The build renders it to HTML; the page's
 * script hydrates that HTML with the same `init`, `update` and `view`.
 * @module App
 */
import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
import { plotTable } from '@opsydyn/foldkit-viz/plot';
import { Result, Schema } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';

import { drawSpec } from './chart';
import { defaultsOf, Input, InputValue, Values } from './inputs';
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

export const Model = Schema.Struct({ ...Flags.fields, values: Values });
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  /** A reader chose a value for an input (`null`: a select's or radio's `all`). */
  ChangedInput: { name: Schema.String, value: InputValue },
});
export type Message = typeof Message.Type;

const isNumber = Schema.is(Schema.Finite);

const inputsOf = (sections: ReadonlyArray<Section>): ReadonlyArray<Input> =>
  sections.flatMap((section) => (section._tag === 'Control' ? [section.input] : []));

export const init = (flags: Flags) => ({
  model: { ...flags, values: defaultsOf(inputsOf(flags.sections)) },
});

export const update = (model: Model, message: Message) =>
  Message.match(message, {
    ChangedInput: ({ name, value }) => ({
      model: { ...model, values: { ...model.values, [name]: value } },
    }),
  });

/** A select's or radio's option value: the choice's index, `-1` for `all`. */
const indexOf = (input: Extract<Input, { readonly _tag: 'Choose' }>, value: InputValue): string =>
  value === null ? '-1' : String(input.choices.indexOf(value));

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

const chart = (
  h: HtmlBuilder<Message>,
  model: Model,
  data: ReadonlyMap<string, Rows>,
  section: Extract<Section, { readonly _tag: 'Chart' }>,
): Html =>
  Result.match(drawSpec(section.spec, data, model.values), {
    onFailure: (problem) => note(h, section.line, problem.message),
    onSuccess: ({ plot, geometry }) =>
      h.figure(
        [h.Class('chart')],
        [plotChart(h, geometry, { table: plotTable(plot), summary: true })],
      ),
  });

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

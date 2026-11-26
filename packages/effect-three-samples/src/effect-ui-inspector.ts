import type { Html } from '@effect/ui/html';
import type { FieldPath, FieldValue, InspectedField } from '@opsydyn/effect-three';
import { Match, Schema } from 'effect';

type OnEdit<Message> = (path: FieldPath, value: FieldValue) => Message;

const axisNames = ['x', 'y', 'z'] as const;

const nameOf = (field: InspectedField): string =>
  field.path.filter(Schema.is(Schema.String)).join(' ') || field.label;

const numberInput = <Message>(
  h: Html.H<Message>,
  label: string,
  value: number,
  report: (value: number) => Message,
) =>
  h.input
    .attr('type', 'number')
    .attr('step', 'any')
    .attr('aria-label', label)
    .value(String(value))
    .on('change', ({ value }) => report(Number(value)));

const controlOf = <Message>(h: Html.H<Message>, field: InspectedField, onEdit: OnEdit<Message>) => {
  const name = nameOf(field);
  return Match.value(field).pipe(
    Match.tagsExhaustive({
      Number: ({ path, value }) => numberInput(h, name, value, (number) => onEdit(path, number)),
      Text: ({ path, value }) =>
        h.input
          .attr('type', 'text')
          .attr('aria-label', name)
          .value(value)
          .on('change', ({ value }) => onEdit(path, value)),
      Toggle: ({ path, value }) =>
        h.input
          .attr('type', 'checkbox')
          .attr('aria-label', name)
          .checked(value)
          .on('click', onEdit(path, !value)),
      Choice: ({ path, value, options }) =>
        h.select
          .attr('aria-label', name)
          .on('change', ({ value }) => onEdit(path, value))
          .children(
            ...options.map((option) =>
              h.option
                .attr('value', option)
                .selected(option === value)
                .children(option),
            ),
          ),
      Colour: ({ path, value }) =>
        h.input
          .attr('type', 'color')
          .attr('aria-label', name)
          .value(`#${value.toString(16).padStart(6, '0')}`)
          .on('input', ({ value }) => onEdit(path, Number.parseInt(value.slice(1), 16))),
      Vector: ({ path, value }) =>
        h.span
          .class('e3-inspector-vector')
          .children(
            ...value.map((component, index) =>
              numberInput(h, `${name} ${axisNames[index] ?? index}`, component, (number) =>
                onEdit([...path, index], number),
              ),
            ),
          ),
      Fixed: ({ text }) => h.span.class('e3-inspector-fixed').children(text),
    }),
  );
};

export const inspectorView = <Message>(
  h: Html.H<Message>,
  fields: ReadonlyArray<InspectedField>,
  onEdit: OnEdit<Message>,
) =>
  h.div.class('e3-inspector').children(
    ...fields.map((field) =>
      h.label
        .key(field.path.join('.'))
        .class('e3-inspector-row')
        .children(
          h.span.class('e3-inspector-name').children(nameOf(field)),
          controlOf(h, field, onEdit),
        ),
    ),
  );

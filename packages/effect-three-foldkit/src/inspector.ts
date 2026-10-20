/**
 * An inspector panel for Foldkit views (roadmap, "Beyond parity" 4): the fields the
 * core's `Inspector.fields` reads from a schema, drawn as a form. Each control reports
 * an edit as the app's own Message, with the field's path and the new value; the app
 * applies it with `Inspector.edit`, which the schema checks, and keeps the result (or
 * shows why it was refused).
 *
 * Numbers, text and choices report when they change (on Enter or leaving the field),
 * colours as they are picked, switches when clicked, and each of a vector's three
 * numbers on its own. Kinds, absent parts and lists are shown, not edited.
 *
 * @module
 */
import type { FieldPath, FieldValue, InspectedField } from '@opsydyn/effect-three';
import type { Html, HtmlBuilder } from 'foldkit/html';

/** Turns an edit (where, and the new value) into the app's Message. */
export type OnEdit<Message> = (path: FieldPath, value: FieldValue) => Message;

const axisNames = ['x', 'y', 'z'] as const;

/** The field's name for people: its property names, without list indices. */
const nameOf = (field: InspectedField): string =>
  field.path.filter((part) => typeof part === 'string').join(' ') || field.label;

const hex = (colour: number): string => `#${colour.toString(16).padStart(6, '0')}`;

const numberInput = <Message>(
  h: HtmlBuilder<Message>,
  label: string,
  value: number,
  report: (raw: string) => Message,
): Html =>
  h.input([
    h.Type('number'),
    h.Step('any'),
    h.Value(String(value)),
    h.AriaLabel(label),
    h.OnChange(report),
  ]);

const controlOf = <Message>(
  h: HtmlBuilder<Message>,
  field: InspectedField,
  onEdit: OnEdit<Message>,
): Html => {
  const name = nameOf(field);
  switch (field._tag) {
    case 'Number':
      return numberInput(h, name, field.value, (raw) => onEdit(field.path, Number(raw)));
    case 'Text':
      return h.input([
        h.Type('text'),
        h.Value(field.value),
        h.AriaLabel(name),
        h.OnChange((raw) => onEdit(field.path, raw)),
      ]);
    case 'Toggle':
      return h.input([
        h.Type('checkbox'),
        h.Checked(field.value),
        h.AriaLabel(name),
        h.OnClick(onEdit(field.path, !field.value)),
      ]);
    case 'Choice':
      return h.select(
        [h.AriaLabel(name), h.OnChange((raw) => onEdit(field.path, raw))],
        field.options.map((option) =>
          h.option([h.Value(option), h.Selected(option === field.value)], [option]),
        ),
      );
    case 'Colour':
      return h.input([
        h.Type('color'),
        h.Value(hex(field.value)),
        h.AriaLabel(name),
        h.OnInput((raw) => onEdit(field.path, Number.parseInt(raw.slice(1), 16))),
      ]);
    case 'Vector':
      return h.span(
        [h.Class('e3-inspector-vector')],
        field.value.map((component, index) =>
          numberInput(h, `${name} ${axisNames[index] ?? index}`, component, (raw) =>
            onEdit([...field.path, index], Number(raw)),
          ),
        ),
      );
    case 'Fixed':
      return h.span([h.Class('e3-inspector-fixed')], [field.text]);
  }
};

/**
 * The fields as a form: a row each, its name and its control, keyed by path. Style it
 * with the classes `e3-inspector`, `e3-inspector-row`, `e3-inspector-name`,
 * `e3-inspector-vector` and `e3-inspector-fixed`.
 */
export const inspectorView = <Message>(
  h: HtmlBuilder<Message>,
  fields: ReadonlyArray<InspectedField>,
  onEdit: OnEdit<Message>,
): Html =>
  h.div(
    [h.Class('e3-inspector')],
    fields.map((field) =>
      h.keyed('label')(
        field.path.join('.'),
        [h.Class('e3-inspector-row')],
        [h.span([h.Class('e3-inspector-name')], [nameOf(field)]), controlOf(h, field, onEdit)],
      ),
    ),
  );

import { Schema } from 'effect';

/** Preserve extensions without parsing known fields again through an Unknown JSON codec. */
export const structWithExtensions = <Fields extends Schema.Struct.Fields>(fields: Fields) =>
  Schema.StructWithRest(Schema.Struct(fields), [
    Schema.Record(
      Schema.String.pipe(Schema.check(Schema.makeFilter((key) => !Object.hasOwn(fields, key)))),
      Schema.Unknown,
    ),
  ]).pipe(
    Schema.check(
      Schema.makeFilter((value) => {
        const prototype = Object.getPrototypeOf(value);
        return (
          prototype === null ||
          prototype === Object.prototype ||
          Object.getPrototypeOf(prototype) === null
        );
      }),
    ),
  );

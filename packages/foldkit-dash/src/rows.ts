/**
 * Rows, as data holds them: arrays of objects of plain values. Browser-safe, shared by
 * the build and the page's script.
 * @module Rows
 */
import { Schema } from 'effect';

/** One value in a row. */
export const Value = Schema.Union([Schema.Number, Schema.String, Schema.Boolean, Schema.Null]);
export type Value = typeof Value.Type;

/** What data holds: rows of plain values, by field name. */
export const Rows = Schema.Array(Schema.Record(Schema.String, Value));
export type Rows = typeof Rows.Type;

/** JSON, as fences hold it. */
export type Json =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<Json>
  | { readonly [key: string]: Json };

/** A JSON object, such as a plot spec. */
export type JsonObject = { readonly [key: string]: Json };

/** JSON, checked: what `JSON.parse` gives, as a type. */
export const JsonValue: Schema.Codec<Json> = Schema.suspend(() =>
  Schema.Union([
    Schema.String,
    Schema.Number,
    Schema.Boolean,
    Schema.Null,
    Schema.Array(JsonValue),
    Schema.Record(Schema.String, JsonValue),
  ]),
);

export const JsonRecord = Schema.Record(Schema.String, JsonValue);

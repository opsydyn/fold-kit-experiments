/**
 * CSV and TSV as rows (ADR 0111): a header row, then records, quoted as RFC 4180 quotes
 * them (a field in double quotes may hold the delimiter, line breaks and `""` for a
 * quote). Each value is typed as d3-dsv's `autoType` types it: an empty value is `null`,
 * `true` and `false` are booleans, and a value that reads as a number is one; anything
 * else, dates included, stays a string, which the plot grammar reads as time when it is
 * ISO.
 * @module Csv
 */
import type { Rows, Value } from './rows';

/** One value, typed: d3-dsv's `autoType`, without its dates. */
export const typed = (text: string): Value => {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  // `NaN` is a number to d3; it is not a value JSON can hold, so it is a missing one.
  if (trimmed === 'NaN') return null;
  const number = Number(trimmed);
  return Number.isNaN(number) ? text : number;
};

/** The records of `text`, each a list of raw fields, quotes removed. */
const records = (text: string, delimiter: string): ReadonlyArray<ReadonlyArray<string>> => {
  const rows: Array<Array<string>> = [];
  let row: Array<string> = [];
  let field = '';
  let quoted = false;
  let at = 0;
  const source = text.startsWith('﻿') ? text.slice(1) : text;
  const endField = (): void => {
    row.push(field);
    field = '';
  };
  const endRow = (): void => {
    endField();
    rows.push(row);
    row = [];
  };
  while (at < source.length) {
    const char = source[at] ?? '';
    if (quoted) {
      if (char === '"' && source[at + 1] === '"') {
        field += '"';
        at += 2;
        continue;
      }
      if (char === '"') quoted = false;
      else field += char;
      at += 1;
      continue;
    }
    if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) endField();
    else if (char === '\n') endRow();
    else if (char === '\r' && source[at + 1] === '\n') {
      endRow();
      at += 1;
    } else field += char;
    at += 1;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
};

/** Rows from CSV (`delimiter` `,`) or TSV (`\t`): the first record names the fields. */
export const parseDelimited = (text: string, delimiter: string): Rows => {
  const [header = [], ...body] = records(text, delimiter);
  return body
    .filter((fields) => !(fields.length === 1 && fields[0] === ''))
    .map((fields) => Object.fromEntries(header.map((name, i) => [name, typed(fields[i] ?? '')])));
};

/** The delimiter a data name's extension calls for, if it is CSV or TSV. */
export const delimiterOf = (name: string): string | undefined =>
  name.endsWith('.csv') ? ',' : name.endsWith('.tsv') ? '\t' : undefined;

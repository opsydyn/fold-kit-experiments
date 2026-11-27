import type { Html } from '@effect/ui/html';

/** The fields this adapter reads from an Effect UI keydown payload. */
export type ChartKeyEvent = Pick<
  Html.KeyPayload,
  'key' | 'ctrl' | 'alt' | 'meta' | 'composing' | 'editable'
>;

export const chartKey = ({ key, ctrl, alt, meta, composing, editable }: ChartKeyEvent) =>
  ctrl || alt || meta || composing || editable ? undefined : key;

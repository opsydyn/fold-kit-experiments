import { Component } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Data } from 'effect';

export class IslandRendererError extends Data.TaggedError('IslandRendererError')<{
  readonly message: string;
}> {}

export type IslandProps = object;

export type IslandComponent = Component.Members<
  string,
  IslandProps,
  unknown,
  never,
  never,
  Html.Host,
  Html.Elements
>;

export function asIslandComponent(value: Component.Any): IslandComponent {
  if (!Component.isComponent(value)) {
    throw new IslandRendererError({ message: 'Expected an Effect UI component.' });
  }
  // SAFETY: Astro hands the renderer its detected component and serialized props.
  // The HTML host checks the vocabulary when it renders the component.
  return value as Component.Any & IslandComponent;
}

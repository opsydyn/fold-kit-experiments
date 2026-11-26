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

/** Describes the props Astro passes while preserving the component the renderer detects. */
export function astroComponent<C extends Component.Any>(
  component: C,
): (props: Component.Props<C>) => void {
  // SAFETY: Astro dispatches to the Effect UI renderer with these props. Only the
  // renderer calls the original view with Effect UI's host helpers.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- The two hosts expose different call signatures.
  return component as unknown as (props: Component.Props<C>) => void;
}

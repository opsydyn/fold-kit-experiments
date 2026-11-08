import { Option } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';

import type {
  ZlozEndpointChoices,
  ZlozEndpointSearchContext,
  ZlozEndpointChoiceGroup,
} from './endpoint-search';

export type ZlozEndpointSearchViewOptions = Readonly<{
  /** Use distinct prefixes for simultaneous controls; pair input and feedback with the same prefix. */
  idPrefix?: string;
  label?: string;
}>;
const identity = (options: ZlozEndpointSearchViewOptions) => options.idPrefix ?? 'flow-port-search';

/** Controlled query input. Escape clears only this query and retains focus. */
export function zlozEndpointSearchInput<M>(
  h: HtmlBuilder<M>,
  context: ZlozEndpointSearchContext,
  onQueryChanged: (query: string) => M,
  attributes: Parameters<HtmlBuilder<M>['input']>[0] = [],
  options: ZlozEndpointSearchViewOptions = {},
): Html {
  return h.input([
    ...attributes,
    h.Key(identity(options)),
    h.Id(`${identity(options)}-search`),
    h.Type('search'),
    h.AriaLabel(options.label ?? 'Search ports'),
    h.Value(context.query),
    h.OnInput(onQueryChanged),
    ...(context.emptyReason ? [h.AriaDescribedBy(`${identity(options)}-search-feedback`)] : []),
    h.OnKeyDownPreventDefault((key) =>
      key === 'Escape' && context.query !== '' ? Option.some(onQueryChanged('')) : Option.none(),
    ),
  ]);
}

/** Remains focusable after clearing; clearing an empty query is an idempotent host message. */
export function zlozEndpointSearchClear<M>(
  h: HtmlBuilder<M>,
  onQueryChanged: (query: string) => M,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children: Parameters<HtmlBuilder<M>['button']>[1] = ['Clear search'],
): Html {
  return h.button([...attributes, h.Type('button'), h.OnClick(onQueryChanged(''))], children);
}

/** Native feedback region; also supply the same query to the endpoint select and reasons. */
export function zlozEndpointSearchFeedback<M>(
  h: HtmlBuilder<M>,
  context: ZlozEndpointSearchContext,
  attributes: Parameters<HtmlBuilder<M>['div']>[0] = [],
  options: ZlozEndpointSearchViewOptions = {},
): Html {
  return h.div(
    [
      ...attributes,
      h.Id(`${identity(options)}-search-feedback`),
      h.Role('status'),
      h.AriaLive('polite'),
    ],
    context.emptyReason ? [context.emptyReason] : [],
  );
}

/** Internal shared native option layout; option semantics stay with the operation-specific primitives. */
export function endpointChoiceOptions<M, T>(
  h: HtmlBuilder<M>,
  choices: ZlozEndpointChoices<T>,
  grouped: boolean | undefined,
  option: (entry: T) => Html,
  groupLabel?: (group: ZlozEndpointChoiceGroup<T>) => string,
): readonly Html[] {
  return grouped
    ? choices.groups.map((group) =>
        h.optgroup(
          [h.Key(group.id), h.LabelAttr(groupLabel?.(group) ?? group.label)],
          group.entries.map(option),
        ),
      )
    : choices.entries.map(option);
}

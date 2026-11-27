import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type { Message } from './message';

export function architectureNativePanel<A>(
  render: <M>(h: Html.H<M>, snapshot: A, request: (message: Message) => M) => View.Content<M>,
) {
  return function panel<M>(
    h: Html.H<M>,
    snapshot: A,
    attribute: string,
    id: string,
    send: (message: Message) => M,
    inline = false,
  ) {
    const key = `native:${attribute}:${id}`;
    const field = `data-${attribute}`;
    const content = render(h, snapshot, send);
    return inline
      ? h.span.key(key).attr(field, id).style({ display: 'contents' }).children(content)
      : h.div.key(key).attr(field, id).children(content);
  };
}

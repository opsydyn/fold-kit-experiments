import { Html } from '@effect/ui/html';
import { Schema } from 'effect';

import { Message } from './message';
import { initModel, Model } from './model';
import { SharedSession } from './share';
import { subscriptions } from './subscription';
import { update, withSession } from './update';
import { view } from './view';

/** The session a shared link carries, decoded from the Astro request URL. */
const Props = Schema.Struct({ session: Schema.NullOr(SharedSession) });

export const Stateflow = Html.component({
  name: 'StateflowObservatory',
  model: Model,
  message: Message,
  props: Props,
}).make({
  init: ({ props }) => withSession(initModel, props.session),
  update: ($, message) => {
    const result = update($.model, message);
    return $.set(result.model).run(...(result.commands ?? []));
  },
  subscriptions,
  view,
});

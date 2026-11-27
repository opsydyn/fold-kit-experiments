import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type {
  ZlozEventStormingRelationshipControlsContext,
  ZlozEventStormingRelationshipRequest,
} from './relationship-controls';

type Context = ZlozEventStormingRelationshipControlsContext;
type Request<M> = (request: ZlozEventStormingRelationshipRequest) => M;
type Slot<M> = View.Content<M> | null | undefined;
export type ZlozRelationshipTextOptions = Readonly<{ label?: string }>;
export type ZlozEventStormingRelationshipControlsParts<M> = Readonly<{
  select: View.Content<M> | null;
  inference: View.Content<M> | null;
  status: View.Content<M> | null;
  reasons: View.Content<M> | null;
}>;
export type ZlozEventStormingRelationshipControlsViewOptions<M> = Readonly<{
  fieldClass?: string;
  statusPrefix?: string;
  renderSelect?: (context: Context, h: Html.H<M>, request: Request<M>) => Slot<M>;
  renderInference?: (action: Context['inference'], h: Html.H<M>, request: Request<M>) => Slot<M>;
  renderStatus?: (context: Context, h: Html.H<M>) => Slot<M>;
  renderReasons?: (context: Context, h: Html.H<M>) => Slot<M>;
  renderLayout?: (
    parts: ZlozEventStormingRelationshipControlsParts<M>,
    context: Context,
    h: Html.H<M>,
  ) => View.Input<M>;
}>;

export function eventStormingRelationshipSelect<M>(
  h: Html.H<M>,
  context: Context,
  onRequest: Request<M>,
  className?: string,
) {
  const { edge } = context;
  return h.select
    .class(className)
    .attr('aria-label', context.label)
    .attr('aria-description', context.reason ?? undefined)
    .attr('title', context.reason ?? undefined)
    .disabled(context.reason !== null || edge === null)
    .on('change', ({ value }) =>
      edge && context.reason === null
        ? onRequest({ type: 'RelationshipSelected', edgeId: edge.id, key: value || null })
        : undefined,
    )
    .children(
      ...context.choices.map((choice) =>
        h.option
          .key(choice.key ?? 'untyped')
          .attr('value', choice.key ?? '')
          .attr('title', choice.reason ?? undefined)
          .selected(choice.key === context.value)
          .disabled(choice.reason !== null)
          .children(choice.label),
      ),
    );
}

export function eventStormingRelationshipInference<M>(
  h: Html.H<M>,
  inference: Context['inference'],
  onRequest: Request<M>,
  children: View.Children<M, never> = [inference.label],
) {
  const inferenceRequest = inference.request;
  return h.button
    .attr('type', 'button')
    .attr('aria-label', inference.label)
    .attr('aria-description', inference.reason ?? undefined)
    .attr('title', inference.reason ?? undefined)
    .disabled(inference.reason !== null || inferenceRequest === null)
    .style({ padding: '8px' })
    .on('click', () => (inferenceRequest ? onRequest(inferenceRequest) : undefined))
    .children(children);
}

export function eventStormingRelationshipStatus<M>(
  h: Html.H<M>,
  context: Context,
  children: View.Children<M, never> = [context.statusText],
  options: ZlozRelationshipTextOptions = {},
) {
  return h.p
    .attr('role', 'status')
    .attr('aria-live', 'polite')
    .attr('aria-label', options.label?.trim() || 'Causal relationship status')
    .children(children);
}

export function eventStormingRelationshipReasons<M>(h: Html.H<M>, context: Context) {
  const reasons = [...new Set([context.reason, context.inference.reason])].filter(
    (reason) => reason !== null,
  );
  return reasons.length || context.choices.length
    ? h.div
        .attr('role', 'group')
        .attr('aria-label', 'Relationship compatibility')
        .children(
          ...reasons.map((reason) => h.p.key(reason).children(reason)),
          context.choices.length
            ? h.ul.children(
                ...context.choices.map((choice) =>
                  h.li
                    .key(choice.key ?? 'untyped')
                    .children(
                      `${choice.label}: ${choice.reason ?? choice.compatibilityReason ?? 'compatible'}`,
                    ),
                ),
              )
            : null,
        )
    : null;
}

export function eventStormingRelationshipControls<M>(
  h: Html.H<M>,
  context: Context,
  onRequest: Request<M>,
  options: ZlozEventStormingRelationshipControlsViewOptions<M> = {},
) {
  const select = options.renderSelect?.(context, h, onRequest);
  const inference = options.renderInference?.(context.inference, h, onRequest);
  const status = options.renderStatus?.(context, h);
  const reasons = options.renderReasons?.(context, h);
  const parts = {
    select:
      select === undefined
        ? h.label
            .class(options.fieldClass)
            .children(context.label, eventStormingRelationshipSelect(h, context, onRequest))
        : select,
    inference:
      inference === undefined
        ? eventStormingRelationshipInference(h, context.inference, onRequest)
        : inference,
    status:
      status === undefined
        ? eventStormingRelationshipStatus(h, context, [
            options.statusPrefix ? h.strong(options.statusPrefix) : null,
            context.statusText,
          ])
        : status,
    reasons: reasons === undefined ? eventStormingRelationshipReasons(h, context) : reasons,
  };
  return h.div
    .attr('role', 'group')
    .attr('aria-label', 'Causal relationship controls')
    .children(
      options.renderLayout
        ? options.renderLayout(parts, context, h)
        : [parts.select, parts.inference, parts.status, parts.reasons],
    );
}

import { Subscription } from '@effect/ui';

import { activeRun, type Model } from './model';
import { agentStream, type AgentTransportOptions } from './transport';

export const subscriptionsFor =
  (options?: AgentTransportOptions) =>
  ({ model }: { readonly model: Model }) => {
    const request = activeRun(model);
    return [
      request !== null &&
        Subscription.make(
          'AgentAnalysisStream',
          [request.runId, request.scenario] as const,
          ([runId, scenario]) => agentStream({ runId, scenario }, options),
        ),
    ];
  };

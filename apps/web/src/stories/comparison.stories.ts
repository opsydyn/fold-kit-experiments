import { BrowserHost } from '@effect/ui/html';
import type { Meta, StoryObj } from '@storybook/html';

import { Comparison } from '../apps/comparison/workbench';
import { mountEffectUi } from './mount-effect-ui';

export default {
  title: 'Charts/Comparison',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export const Workbench = {
  render: () =>
    mountEffectUi((host) => BrowserHost.mountEffect(Comparison, {}, host, { head: false })),
} satisfies StoryObj;

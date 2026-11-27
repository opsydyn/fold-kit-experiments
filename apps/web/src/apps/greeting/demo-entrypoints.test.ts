import { Component } from '@effect/ui';
import { expect, it } from 'vitest';

import profile from '../profile/app';
import timestamp from '../timestamp/app';
import welcome from '../welcome/app';
import greeting from './app';

it.each([
  ['Greeting', greeting],
  ['Profile', profile],
  ['Timestamp', timestamp],
  ['Welcome', welcome],
])('%s uses an Effect UI Astro entry point', (_name, app) => {
  expect(Component.isComponent(app)).toBe(true);
});

import { Component } from '@effect/ui';
import { expect, it } from 'vitest';

import animatedBar from '../animated-bar/app';
import counter from '../counter/app';
import health from '../health/app';
import histogramBrush from '../histogram-brush/app';
import profile from '../profile/app';
import timestamp from '../timestamp/app';
import welcome from '../welcome/app';
import zoomableLine from '../zoomable-line/app';
import greeting from './app';

it.each([
  ['Animated Bar', animatedBar],
  ['Counter', counter],
  ['Greeting', greeting],
  ['Health', health],
  ['Histogram Brush', histogramBrush],
  ['Profile', profile],
  ['Timestamp', timestamp],
  ['Welcome', welcome],
  ['Zoomable Line', zoomableLine],
])('%s uses an Effect UI Astro entry point', (_name, app) => {
  expect(Component.isComponent(app)).toBe(true);
});

import { Component } from '@effect/ui';
import { expect, it } from 'vitest';

import animatedBar from '../animated-bar/app';
import colorSpaces from '../color-spaces/app';
import counter from '../counter/app';
import easingCurves from '../easing-curves/app';
import health from '../health/app';
import histogramBrush from '../histogram-brush/app';
import phyllotaxis from '../phyllotaxis/app';
import profile from '../profile/app';
import timestamp from '../timestamp/app';
import welcome from '../welcome/app';
import zoomableChoropleth from '../zoomable-choropleth/app';
import zoomableLine from '../zoomable-line/app';
import greeting from './app';

it.each([
  ['Animated Bar', animatedBar],
  ['Color Spaces', colorSpaces],
  ['Counter', counter],
  ['Easing Curves', easingCurves],
  ['Greeting', greeting],
  ['Health', health],
  ['Histogram Brush', histogramBrush],
  ['Phyllotaxis', phyllotaxis],
  ['Profile', profile],
  ['Timestamp', timestamp],
  ['Welcome', welcome],
  ['Zoomable Choropleth', zoomableChoropleth],
  ['Zoomable Line', zoomableLine],
])('%s uses an Effect UI Astro entry point', (_name, app) => {
  expect(Component.isComponent(app)).toBe(true);
});

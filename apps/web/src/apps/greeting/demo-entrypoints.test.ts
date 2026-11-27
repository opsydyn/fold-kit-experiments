import { Component } from '@effect/ui';
import { expect, it } from 'vitest';

import agentAnalysis from '../agent-analysis/app';
import animatedBar from '../animated-bar/app';
import carousel from '../carousel/app';
import colorSpaces from '../color-spaces/app';
import complexityField from '../complexity-field/app';
import counter from '../counter/app';
import dataScience from '../data-science/app';
import earthquakeGlobe from '../earthquake-globe/app';
import easingCurves from '../easing-curves/app';
import evolution from '../evolution/app';
import functionalAiRadar from '../functional-ai-radar/app';
import health from '../health/app';
import histogramBrush from '../histogram-brush/app';
import phyllotaxis from '../phyllotaxis/app';
import profile from '../profile/app';
import timestamp from '../timestamp/app';
import welcome from '../welcome/app';
import zloz from '../zloz/app';
import zoomableChoropleth from '../zoomable-choropleth/app';
import zoomableLine from '../zoomable-line/app';
import greeting from './app';

it.each([
  ['Agent Analysis', agentAnalysis],
  ['Animated Bar', animatedBar],
  ['Carousel', carousel],
  ['Color Spaces', colorSpaces],
  ['Complexity Field', complexityField],
  ['Counter', counter],
  ['Data Science', dataScience],
  ['Earthquake Globe', earthquakeGlobe],
  ['Easing Curves', easingCurves],
  ['Evolution', evolution],
  ['Functional AI Radar', functionalAiRadar],
  ['Greeting', greeting],
  ['Health', health],
  ['Histogram Brush', histogramBrush],
  ['Phyllotaxis', phyllotaxis],
  ['Profile', profile],
  ['Timestamp', timestamp],
  ['Welcome', welcome],
  ['Zoomable Choropleth', zoomableChoropleth],
  ['Zoomable Line', zoomableLine],
  ['ZLOZ', zloz],
])('%s uses an Effect UI Astro entry point', (_name, app) => {
  expect(Component.isComponent(app)).toBe(true);
});

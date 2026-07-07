import { Effect, Result } from 'effect';
import { Command } from 'foldkit';

import { SettledSlides } from './message';
import type { Slide } from './model';

const SLIDES: ReadonlyArray<Slide> = [
  { title: 'Adventure', caption: 'Into the unknown', bg: 'linear-gradient(135deg,#dbeafe,#93c5fd)' },
  { title: 'Discovery', caption: 'Find what matters', bg: 'linear-gradient(135deg,#fce7f3,#f9a8d4)' },
  { title: 'Journey', caption: 'Every step counts', bg: 'linear-gradient(135deg,#fef3c7,#fde68a)' },
  { title: 'Wonder', caption: 'Stay curious', bg: 'linear-gradient(135deg,#d1fae5,#6ee7b7)' },
  { title: 'Dream', caption: 'Make it real', bg: 'linear-gradient(135deg,#ede9fe,#c4b5fd)' },
];

// In a real app this would be an HTTP fetch; the 600ms delay makes the
// Loading state visible in the demo.
export const LoadSlides = Command.define('LoadSlides', SettledSlides)(
  Effect.gen(function* () {
    yield* Effect.sleep('600 millis');
    const result: Result.Result<ReadonlyArray<Slide>, string> = Result.succeed(SLIDES);
    return SettledSlides({ result });
  }),
);

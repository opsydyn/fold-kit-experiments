import { Data, Effect, Option, Schema } from 'effect';
import { Command } from 'foldkit';

import { fontFamily, Settings, Word } from './domain';
import { Message } from './message';
class TextMeasurementError extends Data.TaggedError('TextMeasurementError')<{}> {}

function measureWord(
  context: CanvasRenderingContext2D,
  word: typeof Word.Type,
  size: number,
  family: string,
): typeof import('./domain').Metric.Type {
  context.font = `600 ${size}px ${family}`;
  context.textAlign = 'center';
  const metric = context.measureText(word.text);
  const width = Math.max(
    metric.width,
    metric.actualBoundingBoxLeft + metric.actualBoundingBoxRight,
  );
  const height = Math.max(
    size * 0.5,
    metric.actualBoundingBoxAscent + metric.actualBoundingBoxDescent,
  );
  return {
    ...word,
    size,
    width,
    height,
    xOffset: (metric.actualBoundingBoxLeft - metric.actualBoundingBoxRight) / 2,
    yOffset: (metric.actualBoundingBoxAscent - metric.actualBoundingBoxDescent) / 2,
  };
}
export const MeasureWords = Command.define('MeasureWords', {
  args: { revision: Schema.Number, words: Schema.Array(Word), settings: Settings },
  messages: [Message.SucceededMeasurement, Message.FailedMeasurement],
  execute: ({ revision, words, settings }) =>
    Effect.tryPromise({
      try: async () => {
        const family = fontFamily(settings.font);
        await document.fonts.load(`600 ${settings.size}px ${family}`);
        await document.fonts.ready;
        const context = Option.getOrThrowWith(
          Option.fromNullishOr(document.createElement('canvas').getContext('2d')),
          () => new TextMeasurementError(),
        );
        const max = Math.max(1, ...words.map((d) => d.value));
        const measurements = words.map((word) =>
          measureWord(
            context,
            word,
            12 + Math.sqrt(Math.max(0, word.value) / max) * (settings.size - 12),
            family,
          ),
        );
        return Message.SucceededMeasurement({ revision, measurements });
      },
      catch: () => 'Could not measure this font. Retry or choose another font.',
    }).pipe(
      Effect.catch((error) => Effect.succeed(Message.FailedMeasurement({ revision, error }))),
    ),
});

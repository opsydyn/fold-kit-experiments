import { Data } from 'effect';

class LocalOnlyStack extends Data.TaggedError('LocalOnlyStack') {}

export const requireLocalDevelopment = () => {
  if (process.env.ALCHEMY_DEV !== 'true') throw new LocalOnlyStack();
};

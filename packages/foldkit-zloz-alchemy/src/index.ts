/** Portable data validation and projection; no SDK or Effect runtime imports. @module AlchemyProjection */
export type * from './types';
export { supportedAlchemyDomainVersion } from './types';
export {
  decodeAlchemyDescriptor,
  serializeAlchemyDescriptor,
  alchemySourceId,
  AlchemyAdapterError,
} from './descriptor';
export { projectAlchemyDescriptor } from './projection';

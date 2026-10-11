import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { Service, Wire } from './contract';

const service = { id: 'api', name: 'API', series: 'Core', volume: 0, latency: 12 };

describe('validated remote data', () => {
  it('accepts zero measurements and duplicate display names with distinct IDs', () => {
    expect(
      Schema.decodeUnknownSync(Wire)({ services: [service, { ...service, id: 'worker' }] })
        .services,
    ).toHaveLength(2);
  });

  it('rejects duplicate stable IDs', () => {
    expect(() => Schema.decodeUnknownSync(Wire)({ services: [service, service] })).toThrow();
  });

  it.each(['', ' ', '\t\n'])('rejects blank IDs and names: %j', (blank) => {
    expect(() => Schema.decodeUnknownSync(Service)({ ...service, id: blank })).toThrow();
    expect(() => Schema.decodeUnknownSync(Service)({ ...service, name: blank })).toThrow();
  });

  it.each([-1, NaN, Infinity, -Infinity])('rejects invalid measurements: %s', (number) => {
    expect(() => Schema.decodeUnknownSync(Service)({ ...service, volume: number })).toThrow();
    expect(() => Schema.decodeUnknownSync(Service)({ ...service, latency: number })).toThrow();
  });

  it('rejects unsupported series and incomplete records', () => {
    expect(() => Schema.decodeUnknownSync(Service)({ ...service, series: 'Other' })).toThrow();
    expect(() => Schema.decodeUnknownSync(Wire)({ services: [{ id: 'api' }] })).toThrow();
  });
});

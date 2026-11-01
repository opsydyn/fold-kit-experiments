/** Every machine the observatory can watch, the first opening the page. */
import { Option } from 'effect';

import type { Specimen } from '../specimen';
import { checkoutSpecimen } from './checkout';
import { diagnosticsSpecimen } from './diagnostics';

export const specimens: ReadonlyArray<Specimen> = [diagnosticsSpecimen, checkoutSpecimen];

export const defaultSpecimen: Specimen = diagnosticsSpecimen;

/** The specimen with this id, or the default for one the page no longer has. */
export const specimenOf = (id: string): Specimen =>
  Option.getOrElse(
    Option.fromNullishOr(specimens.find((specimen) => specimen.id === id)),
    () => defaultSpecimen,
  );

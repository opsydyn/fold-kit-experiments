import { canonicalOperationValue } from '@opsydyn/foldkit-zloz';
import type { ZlozOperationRequest } from '@opsydyn/foldkit-zloz';

import { sha256Text } from './digest';
/** Same canonical bytes in browser and Worker. Never hash cookies or sessions. */
export const operationHash = (request: ZlozOperationRequest) =>
  sha256Text(canonicalOperationValue(request));

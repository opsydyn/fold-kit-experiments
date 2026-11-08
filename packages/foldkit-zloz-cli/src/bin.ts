#!/usr/bin/env node
import { NodeRuntime, NodeServices } from '@effect/platform-node';
import { Effect } from 'effect';

import { program } from './index';
// Sole runtime boundary: expected command errors have already been framed.
NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));

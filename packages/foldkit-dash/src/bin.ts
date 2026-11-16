#!/usr/bin/env bun
import { BunRuntime, BunServices } from '@effect/platform-bun';
import { Effect } from 'effect';

import { program } from './index';

// The process's one runtime boundary: problems and invocation errors carry their exit codes.
BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)));

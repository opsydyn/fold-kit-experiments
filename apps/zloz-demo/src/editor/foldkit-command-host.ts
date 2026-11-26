import type { Command } from '@effect/ui';
import { Schema } from 'effect';
import { Command as FoldKitCommand } from 'foldkit';

import { Message } from './message';
import type { Return, WorkbenchCommand } from './transition';

const RunWorkbenchCommand = FoldKitCommand.define('RunWorkbenchCommand', {
  args: { address: Schema.String, command: Schema.Unknown },
  interrupt: { keyFields: ['address'], toKey: ({ address }) => address },
  messages: [Message],
  execute: ({ command }) => {
    // SAFETY: this private definition accepts only commands from the typed workbench adapter.
    return (command as WorkbenchCommand<Message>).effect;
  },
});

function commandAddress(command: Pick<Command.Interrupt, 'name' | 'groupKey'>) {
  return JSON.stringify([command.name, command.groupKey ?? null]);
}

/** Lets the existing island own interruption and cleanup until the Effect UI host takes over. */
export function runWorkbenchCommand(
  command: WorkbenchCommand<Message>,
): FoldKitCommand.Command<Message> {
  const running = RunWorkbenchCommand({ address: commandAddress(command), command });
  return {
    name: command.name,
    // SAFETY: All workbench definitions declare their arguments as named fields.
    args: command.args as NonNullable<FoldKitCommand.Command<Message>['args']>,
    key: running.key,
    effect: running.effect,
  };
}

export function interruptWorkbenchCommand(
  command: Command.Interrupt,
): FoldKitCommand.Command<Message> {
  return RunWorkbenchCommand.Interrupt({ address: commandAddress(command) }, () =>
    Message.CompletedWorkbenchInterrupt({ name: command.name }),
  );
}

export function workbenchTransitionCommands<Model>(transition: Return<Model, Message>) {
  return [
    ...(transition.interrupts ?? []).map(interruptWorkbenchCommand),
    ...(transition.commands ?? []).map(runWorkbenchCommand),
  ];
}

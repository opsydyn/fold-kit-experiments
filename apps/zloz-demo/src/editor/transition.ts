import type { Command } from '@effect/ui';

export type WorkbenchCommand<Message> = Command.Issued<Message, never, never, 'Effect'>;

export type Return<Model, Message> = Readonly<{
  model: Model;
  commands?: readonly WorkbenchCommand<Message>[];
  interrupts?: readonly Command.Interrupt[];
}>;

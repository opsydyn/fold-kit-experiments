import { Match as M, Schema as S } from "effect";
import type { Command, Runtime } from "foldkit";
import { type Document, html } from "foldkit/html";
import { m } from "foldkit/message";

import * as styles from "./counter.css";

// MODEL

export const Model = S.Struct({ count: S.Number });
export type Model = typeof Model.Type;

// MESSAGE

const ClickedDecrement = m("ClickedDecrement");
const ClickedIncrement = m("ClickedIncrement");
const ClickedReset = m("ClickedReset");

export const Message = S.Union([
	ClickedDecrement,
	ClickedIncrement,
	ClickedReset,
]);
export type Message = typeof Message.Type;

// UPDATE

export const update = (
	model: Model,
	message: Message,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] =>
	M.value(message).pipe(
		M.withReturnType<
			readonly [Model, ReadonlyArray<Command.Command<Message>>]
		>(),
		M.tagsExhaustive({
			ClickedDecrement: () => [{ count: model.count - 1 }, []],
			ClickedIncrement: () => [{ count: model.count + 1 }, []],
			ClickedReset: () => [{ count: 0 }, []],
		}),
	);

// INIT

export const init: Runtime.ProgramInit<Model, Message> = () => [
	{ count: 0 },
	[],
];

// VIEW

const { div, button, Class, OnClick } = html<Message>();

export const view = (model: Model): Document => ({
	title: `Counter: ${model.count}`,
	body: div(
		[Class(styles.container)],
		[
			div([Class(styles.count)], [model.count.toString()]),
			div(
				[Class(styles.controls)],
				[
					button([OnClick(ClickedDecrement()), Class(styles.button)], ["−"]),
					button([OnClick(ClickedReset()), Class(styles.button)], ["Reset"]),
					button([OnClick(ClickedIncrement()), Class(styles.button)], ["+"]),
				],
			),
		],
	),
});

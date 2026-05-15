import { Runtime } from "foldkit";

import { Model, init, update, view } from "./main";

const program = Runtime.makeProgram({
	Model,
	init,
	update,
	view,
	container: document.getElementById("foldkit-counter"),
	devTools: {
		position: "BottomLeft",
	},
});

Runtime.run(program);

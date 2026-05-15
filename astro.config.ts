import { defineConfig } from "astro/config";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import foldkit from "./src/integration/index";

export default defineConfig({
	devToolbar: { enabled: false },
	integrations: [foldkit()],
	vite: {
		plugins: [vanillaExtractPlugin()],
	},
});

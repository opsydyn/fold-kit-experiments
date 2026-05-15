import { defineConfig } from "astro/config";
import { foldkit } from "@foldkit/vite-plugin";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";

export default defineConfig({
	devToolbar: { enabled: false },
	vite: {
		plugins: [foldkit(), vanillaExtractPlugin({ unstable_mode: 'transform' })],
	},
});

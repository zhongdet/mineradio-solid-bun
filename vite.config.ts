import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
	plugins: [solid()],
	root: "src/mainview",
	publicDir: "../../public",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
	},
	server: {
		port: 5173,
		strictPort: true,
		proxy: {
			"/api": {
				target: "http://127.0.0.1:3001",
				changeOrigin: true,
			},
		},
	},
});

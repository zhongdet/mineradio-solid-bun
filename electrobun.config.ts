import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "Mineradio",
		identifier: "com.mineradio.desktop",
		version: "1.0.0",
	},
	runtime: {
		exitOnLastWindowClosed: true,
	},
	build: {
		bun: {
			entrypoint: "src/bun/index.ts",
			external: ["NeteaseCloudMusicApi"],
		},
		views: {
			mainview: {
				entrypoint: "src/mainview/electrobun-entry.js",
			},
		},
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
			"public/vendor": "views/vendor",
			"public/legacy": "views/legacy",
		},
		watchIgnore: ["dist/**"],
		mac: { bundleCEF: false },
		linux: { bundleCEF: false },
		win: { bundleCEF: false },
	},
} satisfies ElectrobunConfig;

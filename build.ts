import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "bun";

await build({
	entrypoints: ["src/extension.ts"],
	outdir: "dist",
	format: "esm",
	minify: true,
	target: "node",
	external: ["vscode"],
});

const filesToCopy = [
	"tree-sitter-vie/tree-sitter-vie.wasm",
	"tree-sitter-vie/queries/highlights.scm",
	"web-tree-sitter/tree-sitter.wasm",
];

for (const file of filesToCopy) {
	const srcPath = resolve("node_modules", file);
	const destPath = resolve("dist", file.split("/").pop() as string);
	await copyFile(srcPath, destPath);
}

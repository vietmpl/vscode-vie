import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Language, Parser } from "web-tree-sitter";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function activate() {
	await Parser.init();
	const parser = new Parser();

	const Vie = await Language.load(join(__dirname, "tree-sitter-vie.wasm"));
	parser.setLanguage(Vie);
	const sourceCode = "{{ Test }}";
	const tree = parser.parse(sourceCode);
	if (!tree) {
		process.exit(1);
	}
	console.log(tree.rootNode.toString());
}

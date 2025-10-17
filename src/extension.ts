import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as vsc from "vscode";
import { Language, Parser, Query } from "web-tree-sitter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VieSemanticTokensProvider implements vsc.DocumentSemanticTokensProvider {
	public constructor(
		private readonly parser: Parser,
		private readonly highlightsQuery: Query,
		private readonly legend: vsc.SemanticTokensLegend,
	) {}

	async provideDocumentSemanticTokens(
		document: vsc.TextDocument,
		_: vsc.CancellationToken,
	): Promise<vsc.SemanticTokens> {
		const builder = new vsc.SemanticTokensBuilder(this.legend);
		const tree = this.parser.parse(document.getText());
		if (!tree) {
			throw new Error("Parse error.");
		}

		const captures = this.highlightsQuery.captures(tree.rootNode);
		for (const { name, node } of captures) {
			// TODO(skewb1k): replace current O(n) indexOf lookup with a trie for token strings.
			// This will allow early exit and O(length-of-string) lookup.
			const tokenTypeIndex = this.legend.tokenTypes.indexOf(name);
			if (tokenTypeIndex === -1) {
				tree.delete();
				throw new Error(`Token type "${name}" not found in legend.tokenTypes.`);
			}

			builder.push(
				node.startPosition.row,
				node.startPosition.column,
				node.endPosition.column - node.startPosition.column,
				tokenTypeIndex,
				0,
			);
		}
		tree.delete();
		return builder.build();
	}

	public dispose() {
		this.parser.delete();
		this.highlightsQuery.delete();
	}
}

export async function activate(extensionContext: vsc.ExtensionContext) {
	await Parser.init();

	const vieLanguage = await Language.load(
		join(__dirname, "tree-sitter-vie.wasm"),
	);
	const parser = new Parser();
	parser.setLanguage(vieLanguage);

	const highlightsScm = await readFile(
		join(__dirname, "highlights.scm"),
		"utf8",
	);
	const highlightsQuery = new Query(vieLanguage, highlightsScm);

	// TODO(skewb1k): Avoid hardcoding tokens here. Extract them from highlightsQuery instead.
	const tokenTypes = [
		"keyword",
		"string",
		"string.escape",
		"variable",
		"boolean",
		"operator",
		"punctuation",
		"comment",
		"function.call",
		"punctuation.bracket",
		"punctuation.delimiter",
	];
	// TODO(skewb1k): currently only tokenTypes are used. Consider adding tokenModifiers.
	const legend = new vsc.SemanticTokensLegend(tokenTypes);

	const provider = new VieSemanticTokensProvider(
		parser,
		highlightsQuery,
		legend,
	);
	extensionContext.subscriptions.push(
		vsc.languages.registerDocumentSemanticTokensProvider(
			{ language: "vie" },
			provider,
			legend,
		),
		provider, // Pass provider to dispose it on deactivation.
	);
}

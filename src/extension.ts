import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as vsc from "vscode";
import { Language, Parser, Query } from "web-tree-sitter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Global extension context.
// Must be initialized with initContext() during extension activation
// before any other code accesses it. Must not be modified after.
let _globalContext: {
	vieLanguage: Language;
	highlightsQuery: Query;
	legend: vsc.SemanticTokensLegend;
} | null = null;

// Initializes the global extension context.
// Should be called once during extension activation.
export async function initContext() {
	if (!_globalContext) {
		await Parser.init();

		const vieLanguage = await Language.load(
			join(__dirname, "tree-sitter-vie.wasm"),
		);
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

		_globalContext = { vieLanguage, highlightsQuery, legend };
	}
	return _globalContext;
}

// Returns the global extension context.
// Throws an error if the context has not been initialized.
export function getContext() {
	if (!_globalContext)
		throw new Error("Global context accessed before initialization.");
	return _globalContext;
}

class VieSemanticTokensProvider implements vsc.DocumentSemanticTokensProvider {
	public constructor(private readonly parser: Parser) {}

	async provideDocumentSemanticTokens(
		document: vsc.TextDocument,
		_: vsc.CancellationToken,
	): Promise<vsc.SemanticTokens> {
		const ctx = getContext();

		const builder = new vsc.SemanticTokensBuilder(ctx.legend);
		const tree = this.parser.parse(document.getText());
		if (!tree) {
			throw new Error("Parse error.");
		}

		const captures = ctx.highlightsQuery.captures(tree.rootNode);
		for (const { name, node } of captures) {
			// TODO(skewb1k): replace current O(n) indexOf lookup with a trie for token strings.
			// This will allow early exit and O(length-of-string) lookup.
			const tokenTypeIndex = ctx.legend.tokenTypes.indexOf(name);
			if (tokenTypeIndex === -1) {
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

		return builder.build();
	}
}

export async function activate(extensionContext: vsc.ExtensionContext) {
	const ctx = await initContext();

	const parser = new Parser();
	parser.setLanguage(ctx.vieLanguage);

	extensionContext.subscriptions.push(
		vsc.languages.registerDocumentSemanticTokensProvider(
			{ language: "vie" },
			new VieSemanticTokensProvider(parser),
			ctx.legend,
		),
	);
}

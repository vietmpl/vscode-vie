import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as vsc from "vscode";
import { Language, Parser, Query } from "web-tree-sitter";

class VieSemanticTokensProvider implements vsc.DocumentSemanticTokensProvider {
	private tokenTypeMap: Map<string, number>;

	constructor(
		private readonly parser: Parser,
		private readonly highlightsQuery: Query,
		private readonly legend: vsc.SemanticTokensLegend,
	) {
		this.tokenTypeMap = new Map(
			this.legend.tokenTypes.map((type, i) => [type, i]),
		);
	}

	async provideDocumentSemanticTokens(
		document: vsc.TextDocument,
	): Promise<vsc.SemanticTokens> {
		const builder = new vsc.SemanticTokensBuilder(this.legend);
		const tree = this.parser.parse(document.getText());

		if (!tree) {
			throw new Error("Parse error");
		}

		const captures = this.highlightsQuery.captures(tree.rootNode);
		for (const { name, node } of captures) {
			const tokenTypeIndex = this.tokenTypeMap.get(name);

			if (tokenTypeIndex === undefined) {
				tree.delete();
				throw new Error(`Token type "${name}" not found in legend.tokenTypes`);
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

	dispose() {
		this.parser.delete();
		this.highlightsQuery.delete();
	}
}

async function initVieLanguage(ctx: vsc.ExtensionContext): Promise<void> {
	await Parser.init();

	const vieLanguage = await Language.load(
		join(ctx.extensionPath, "dist", "tree-sitter-vie.wasm"),
	);
	const parser = new Parser();
	parser.setLanguage(vieLanguage);

	const highlightsScm = await readFile(
		join(ctx.extensionPath, "dist", "highlights.scm"),
		"utf8",
	);
	const highlightsQuery = new Query(vieLanguage, highlightsScm);

	// Parsing a unique array of tokens from highlights.scm
	const tokenTypes = [
		...new Set(
			(highlightsScm.match(/@([\w.-]+)/g) || []).map((x) => x.slice(1)),
		),
	];

	// TODO(skewb1k): currently only tokenTypes are used. Consider adding tokenModifiers.
	const legend = new vsc.SemanticTokensLegend(tokenTypes);

	const provider = new VieSemanticTokensProvider(
		parser,
		highlightsQuery,
		legend,
	);

	ctx.subscriptions.push(
		vsc.languages.registerDocumentSemanticTokensProvider(
			{ language: "vie" },
			provider,
			legend,
		),
		provider, // Pass provider to dispose it on deactivation.
	);
}

export async function activate(ctx: vsc.ExtensionContext) {
	await initVieLanguage(ctx);
}

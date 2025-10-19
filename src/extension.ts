import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as vsc from "vscode";
import { Language, Parser, Query, type Tree } from "web-tree-sitter";
import { vscChangeToTSEdit } from "./vscChangeToTSEdit";

class VieSemanticTokensProvider implements vsc.DocumentSemanticTokensProvider {
	private readonly trees: Map<vsc.TextDocument, Tree>;

	constructor(
		private readonly parser: Parser,
		private readonly highlightsQuery: Query,
		private readonly legend: vsc.SemanticTokensLegend,
	) {
		this.trees = new Map();
		vsc.workspace.onDidChangeTextDocument((event) => {
			const tree = this.trees.get(event.document);
			if (!tree) return;

			for (const change of event.contentChanges) {
				tree.edit(vscChangeToTSEdit(change));
			}

			const newTree = this.parser.parse(event.document.getText(), tree);
			tree.delete();
			if (!newTree) throw new Error("Parse error");
			this.trees.set(event.document, newTree);
		});

		vsc.workspace.onDidCloseTextDocument((document) => {
			const tree = this.trees.get(document);
			if (!tree) return;
			tree.delete();
			this.trees.delete(document);
		});
	}

	async provideDocumentSemanticTokens(
		document: vsc.TextDocument,
	): Promise<vsc.SemanticTokens> {
		const builder = new vsc.SemanticTokensBuilder(this.legend);

		let tree = this.trees.get(document) ?? null;
		if (!tree) {
			tree = this.parser.parse(document.getText());
			if (!tree) throw new Error("Parse error");
			this.trees.set(document, tree);
		}

		const captures = this.highlightsQuery.captures(tree.rootNode);
		for (const capture of captures) {
			const node = capture.node;
			builder.push(
				node.startPosition.row,
				node.startPosition.column,
				node.endPosition.column - node.startPosition.column,
				capture.patternIndex,
				0,
			);
		}
		return builder.build();
	}

	dispose() {
		for (const tree of this.trees.values()) {
			tree.delete();
		}
		this.parser.delete();
		this.highlightsQuery.delete();
	}
}

async function initSemanticTokensProvider(
	ctx: vsc.ExtensionContext,
): Promise<void> {
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

	const legend = new vsc.SemanticTokensLegend(highlightsQuery.captureNames);

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
	await initSemanticTokensProvider(ctx);
}

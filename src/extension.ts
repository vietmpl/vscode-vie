import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as vsc from "vscode";
import { Language, Parser, Query } from "web-tree-sitter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function initVieLanguage(): Promise<{
	parser: Parser;
	language: Language;
}> {
	await Parser.init();
	const parser = new Parser();
	const language = await Language.load(join(__dirname, "tree-sitter-vie.wasm"));
	parser.setLanguage(language);

	return { parser, language };
}

async function initLegend(): Promise<vsc.SemanticTokensLegend> {
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
	const legend = new vsc.SemanticTokensLegend(tokenTypes);

	return legend;
}

export async function getHighlightsScm(): Promise<string> {
	const uri = vsc.Uri.file(join(__dirname, "highlights.scm"));
	const buf = await vsc.workspace.fs.readFile(uri);

	return buf.toString();
}

class VieSemanticTokensProvider implements vsc.DocumentSemanticTokensProvider {
	constructor(
		private readonly parser: Parser,
		private readonly language: Language,
		private readonly legend: vsc.SemanticTokensLegend,
		private readonly highlights: string,
	) {}

	private lastTokens?: vsc.SemanticTokens;
	private lastVersion?: number;

	async provideDocumentSemanticTokens(
		document: vsc.TextDocument,
	): Promise<vsc.SemanticTokens> {
		const tokens = await this.computeTokens(document);
		this.lastTokens = tokens;
		this.lastVersion = document.version;

		return new vsc.SemanticTokens(tokens.data, `ver-${document.version}`);
	}

	async provideDocumentSemanticTokensEdits(
		document: vsc.TextDocument,
	): Promise<vsc.SemanticTokensEdits | vsc.SemanticTokens> {
		const prevVersion = this.lastVersion;
		const prevTokens = this.lastTokens;

		if (!prevTokens || !prevVersion || document.version !== prevVersion + 1) {
			const tokens = await this.computeTokens(document);
			this.lastTokens = tokens;
			this.lastVersion = document.version;

			return new vsc.SemanticTokens(tokens.data, `ver-${document.version}`);
		}

		const newTokens = await this.computeTokens(document);

		if (prevTokens.data.length !== newTokens.data.length) {
			this.lastTokens = newTokens;
			this.lastVersion = document.version;

			return new vsc.SemanticTokens(newTokens.data, `ver-${document.version}`);
		}

		return {
			edits: [],
			resultId: `ver-${document.version}`,
		};
	}

	private async computeTokens(
		document: vsc.TextDocument,
	): Promise<vsc.SemanticTokens> {
		const builder = new vsc.SemanticTokensBuilder(this.legend);
		const tree = this.parser.parse(document.getText());

		if (!tree) {
			throw new Error("Tree parse error");
		}

		const query = new Query(this.language, this.highlights);
		const captures = query.captures(tree.rootNode);

		for (const { name, node } of captures) {
			const tokenTypeIndex = this.legend.tokenTypes.indexOf(name);
			if (tokenTypeIndex === -1) continue;

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

function registerTokenProvider(
	context: vsc.ExtensionContext,
	parser: Parser,
	language: Language,
	legend: vsc.SemanticTokensLegend,
	highlights: string,
) {
	context.subscriptions.push(
		vsc.languages.registerDocumentSemanticTokensProvider(
			{ language: "vie" },
			new VieSemanticTokensProvider(parser, language, legend, highlights),
			legend,
		),
	);
}

export async function activate(context: vsc.ExtensionContext) {
	const { parser, language } = await initVieLanguage();
	const legend = await initLegend();
	const highlights = await getHighlightsScm();

	registerTokenProvider(context, parser, language, legend, highlights);
}

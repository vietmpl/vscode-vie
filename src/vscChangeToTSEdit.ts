import type { TextDocumentContentChangeEvent } from "vscode";
import type { Edit } from "web-tree-sitter";

export function vscChangeToTSEdit(
	changeEvent: TextDocumentContentChangeEvent,
): Edit {
	const textLines = changeEvent.text.split("\n");
	const startPosRow = changeEvent.range.start.line;
	const newEndPosRow = startPosRow + textLines.length - 1;
	return {
		startPosition: {
			row: startPosRow,
			column: changeEvent.range.start.character,
		},
		oldEndPosition: {
			row: changeEvent.range.end.line,
			column: changeEvent.range.end.character,
		},
		newEndPosition: {
			row: newEndPosRow,
			column:
				textLines.length === 1
					? changeEvent.range.start.character + changeEvent.text.length
					: (textLines.at(-1) as string).length,
		},
		startIndex: changeEvent.rangeOffset,
		oldEndIndex: changeEvent.rangeOffset + changeEvent.rangeLength,
		newEndIndex: changeEvent.rangeOffset + changeEvent.text.length,
	};
}

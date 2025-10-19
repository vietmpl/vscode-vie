import { describe, expect, it } from "bun:test";
import type { TextDocumentContentChangeEvent as VSCTextDocumentContentChangeEvent } from "vscode";
import type { Edit } from "web-tree-sitter";
import { vscChangeToTSEdit } from "./vscChangeToTSEdit";

// Mocked VSCode-types for testing
interface Position {
	line: number;
	character: number;
}

interface Range {
	start: Position;
	end: Position;
}

interface TextDocumentContentChangeEvent {
	range: Range;
	rangeOffset: number;
	rangeLength: number;
	text: string;
}

describe("VSCode -> TreeSitter edit conversion", () => {
	const cases: Array<[string, TextDocumentContentChangeEvent, Edit]> = [
		[
			"insert first char",
			{
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 0 },
				},
				rangeOffset: 0,
				rangeLength: 0,
				text: "a",
			},
			{
				startPosition: { row: 0, column: 0 },
				oldEndPosition: { row: 0, column: 0 },
				newEndPosition: { row: 0, column: 1 },
				startIndex: 0,
				oldEndIndex: 0,
				newEndIndex: 1,
			},
		],
		[
			"insert after first char",
			{
				range: {
					start: { line: 0, character: 1 },
					end: { line: 0, character: 1 },
				},
				rangeOffset: 1,
				rangeLength: 0,
				text: "a",
			},
			{
				startPosition: { row: 0, column: 1 },
				oldEndPosition: { row: 0, column: 1 },
				newEndPosition: { row: 0, column: 2 },
				startIndex: 1,
				oldEndIndex: 1,
				newEndIndex: 2,
			},
		],
		[
			"insert first char on second line",
			{
				range: {
					start: { line: 1, character: 0 },
					end: { line: 1, character: 0 },
				},
				rangeOffset: 14,
				rangeLength: 0,
				text: "a",
			},
			{
				startPosition: { row: 1, column: 0 },
				oldEndPosition: { row: 1, column: 0 },
				newEndPosition: { row: 1, column: 1 },
				startIndex: 14,
				oldEndIndex: 14,
				newEndIndex: 15,
			},
		],
		[
			"delete first char",
			{
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 1 },
				},
				rangeOffset: 0,
				rangeLength: 1,
				text: "",
			},
			{
				startPosition: { row: 0, column: 0 },
				oldEndPosition: { row: 0, column: 1 },
				newEndPosition: { row: 0, column: 0 },
				startIndex: 0,
				oldEndIndex: 1,
				newEndIndex: 0,
			},
		],
		[
			"delete word on some line",
			{
				range: {
					start: { line: 1, character: 3 },
					end: { line: 1, character: 6 },
				},
				rangeOffset: 17,
				rangeLength: 3,
				text: "",
			},
			{
				startPosition: { row: 1, column: 3 },
				oldEndPosition: { row: 1, column: 6 },
				newEndPosition: { row: 1, column: 3 },
				startIndex: 17,
				oldEndIndex: 20,
				newEndIndex: 17,
			},
		],
		[
			"delete multiple lines",
			{
				range: {
					start: { line: 1, character: 0 },
					end: { line: 3, character: 0 },
				},
				rangeOffset: 14,
				rangeLength: 14,
				text: "",
			},
			{
				startPosition: { row: 1, column: 0 },
				oldEndPosition: { row: 3, column: 0 },
				newEndPosition: { row: 1, column: 0 },
				startIndex: 14,
				oldEndIndex: 28,
				newEndIndex: 14,
			},
		],
		[
			"insert newline",
			{
				range: {
					start: { line: 0, character: 13 },
					end: { line: 0, character: 13 },
				},
				rangeOffset: 13,
				rangeLength: 0,
				text: "\n",
			},
			{
				startPosition: { row: 0, column: 13 },
				oldEndPosition: { row: 0, column: 13 },
				newEndPosition: { row: 1, column: 0 },
				startIndex: 13,
				oldEndIndex: 13,
				newEndIndex: 14,
			},
		],
	];

	for (const [name, vscodeEdit, expected] of cases) {
		it(name, () => {
			const tsEdit = vscChangeToTSEdit(
				vscodeEdit as VSCTextDocumentContentChangeEvent,
			);
			expect(tsEdit).toEqual(expected);
		});
	}
});

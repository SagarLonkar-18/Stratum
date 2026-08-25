import { chunkTextFixedSize } from "../src/lib/chunking/fixedSizeChunker";
import { chunkTextStructureAware } from "../src/lib/chunking/structureAwareChunker";
import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";

async function main() {
	// Point this at one of your already-uploaded resume files
	const filePath = path.join(
		process.cwd(),
		"uploads",
		"ace27d6a-51fa-47cd-9464-4b299371828f",
		"af4607b8-b7fa-494f-b0e3-4271812d5072-Resume - Sagar Lonkar.pdf",
	);

	const fileBuffer = await fs.readFile(filePath);
	const parser = new PDFParse({ data: fileBuffer });
	const result = await parser.getText();
	await parser.destroy();

	const fixedChunks = chunkTextFixedSize(result.text);
	const structureChunks = chunkTextStructureAware(result.text);

	console.log(`\n=== FIXED-SIZE: ${fixedChunks.length} chunks ===`);
	fixedChunks.forEach((c) => {
		console.log(
			`\n--- Chunk ${c.chunkIndex} (${c.content.length} chars) ---`,
		);
		console.log(`START: "${c.content.slice(0, 60)}..."`);
		console.log(`END:   "...${c.content.slice(-60)}"`);
	});

	console.log(
		`\n\n=== STRUCTURE-AWARE: ${structureChunks.length} chunks ===`,
	);
	structureChunks.forEach((c) => {
		console.log(
			`\n--- Chunk ${c.chunkIndex} (${c.content.length} chars) ---`,
		);
		console.log(`START: "${c.content.slice(0, 60)}..."`);
		console.log(`END:   "...${c.content.slice(-60)}"`);
	});
}

main().catch(console.error);

import type { TextChunk } from "./fixedSizeChunker";

const TARGET_CHUNK_SIZE = 2000; // same target size as fixed-size, for fair comparison
const MAX_CHUNK_SIZE = 2500; // hard ceiling before we force-split a paragraph

/**
 * Structure-aware chunker: splits on paragraph boundaries (double newlines)
 * first, merges small consecutive paragraphs together up to ~TARGET_CHUNK_SIZE,
 * and only falls back to sentence-boundary splitting when a single paragraph
 * exceeds MAX_CHUNK_SIZE on its own. Unlike the fixed-size chunker, this
 * never cuts through the middle of a word or sentence.
 */
export function chunkTextStructureAware(text: string): TextChunk[] {
	const paragraphs = text
		.split(/\n\s*\n/) // split on blank lines (one or more, with optional whitespace)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);

	const chunks: TextChunk[] = [];
	let currentChunk = "";
	let chunkIndex = 0;

	const flushCurrentChunk = () => {
		if (currentChunk.trim().length > 0) {
			chunks.push({ content: currentChunk.trim(), chunkIndex });
			chunkIndex++;
			currentChunk = "";
		}
	};

	for (const paragraph of paragraphs) {
		if (paragraph.length > MAX_CHUNK_SIZE) {
			// This single paragraph is too large on its own — flush whatever
			// we've accumulated so far, then split THIS paragraph on sentence
			// boundaries instead of blindly by character count.
			flushCurrentChunk();

			const sentences = paragraph.split(/(?<=[.!?])\s+/);
			let sentenceChunk = "";

			for (const sentence of sentences) {
				if (
					(sentenceChunk + " " + sentence).length >
						TARGET_CHUNK_SIZE &&
					sentenceChunk.length > 0
				) {
					chunks.push({ content: sentenceChunk.trim(), chunkIndex });
					chunkIndex++;
					sentenceChunk = sentence;
				} else {
					sentenceChunk = sentenceChunk
						? `${sentenceChunk} ${sentence}`
						: sentence;
				}
			}
			if (sentenceChunk.trim().length > 0) {
				chunks.push({ content: sentenceChunk.trim(), chunkIndex });
				chunkIndex++;
			}
			continue;
		}

		// Would adding this paragraph push us over the target size?
		if (
			(currentChunk + "\n\n" + paragraph).length > TARGET_CHUNK_SIZE &&
			currentChunk.length > 0
		) {
			flushCurrentChunk();
		}

		currentChunk = currentChunk
			? `${currentChunk}\n\n${paragraph}`
			: paragraph;
	}

	flushCurrentChunk();

	return chunks;
}

export interface TextChunk {
	content: string;
	chunkIndex: number;
}

const CHUNK_SIZE = 2000; // approx characters, ~500 tokens
const CHUNK_OVERLAP = 200;

/**
 * Naive fixed-size sliding-window chunker. Splits text into overlapping
 * windows without regard for sentence/paragraph boundaries — this is
 * intentional: it's our baseline strategy, to be compared later against a
 * structure-aware chunker that DOES respect natural text boundaries.
 */
export function chunkTextFixedSize(text: string): TextChunk[] {
	const chunks: TextChunk[] = [];
	const step = CHUNK_SIZE - CHUNK_OVERLAP;

	let start = 0;
	let chunkIndex = 0;

	while (start < text.length) {
		const end = Math.min(start + CHUNK_SIZE, text.length);
		const content = text.slice(start, end).trim();

		if (content.length > 0) {
			chunks.push({ content, chunkIndex });
			chunkIndex++;
		}

		if (end === text.length) break;
		start += step;
	}

	return chunks;
}

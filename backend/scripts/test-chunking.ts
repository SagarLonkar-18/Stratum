// backend/scripts/test-chunking.ts
import { chunkTextFixedSize } from "../src/lib/chunking/fixedSizeChunker";

const sampleText = `
Full Stack Developer with experience building production-grade web applications, real-time systems, and cloud deployments. Currently working on customer-facing products deployed in production environments.

Education
DBATU University
Nutan College of Engineering and Research - B.Tech in Computer Science
Nov 2022 - Present
CGPA: 7.80/10 (Aggregate up to 7th Semester), Expected Graduation: June 2026
`.repeat(20); // repeat to simulate a longer document

const chunks = chunkTextFixedSize(sampleText);

console.log(`Total chunks: ${chunks.length}\n`);
chunks.forEach((c) => {
	console.log(`--- Chunk ${c.chunkIndex} (${c.content.length} chars) ---`);
	console.log(c.content.slice(0, 100) + "...");
	console.log();
});

import { prisma } from "../src/db/client";
import { withWorkspace } from "../src/db/withWorkspace"; 

const WORKSPACE_ID = "ace27d6a-51fa-47cd-9464-4b299371828f";

const FIXED = {
	chunk0: "8e79197b-9461-4f20-81b6-f59d94c5eb20",
	chunk1: "4fc39022-a022-49b3-92ff-eb97a35150fe",
};
const STRUCT = {
	chunk0: "b59606ff-3d27-475f-a9c2-a2d6f71d2d03",
	chunk1: "07107419-527e-4516-a294-c9a4eaf955c7",
};

const questions = [
	{
		question: "What company does he currently work at?",
		fixed: [FIXED.chunk0],
		struct: [STRUCT.chunk0],
	},
	{
		question: "What is his CGPA?",
		fixed: [FIXED.chunk0],
		struct: [STRUCT.chunk0],
	},
	{
		question: "What did he build for print shops?",
		fixed: [FIXED.chunk0, FIXED.chunk1],
		struct: [STRUCT.chunk1],
	},
	{
		question: "What CI/CD tools did he use for PrintFlow?",
		fixed: [FIXED.chunk1],
		struct: [STRUCT.chunk1],
	},
	{
		question: "What did he build using the Gemini API?",
		fixed: [FIXED.chunk1],
		struct: [STRUCT.chunk1],
	},
	{
		question: "What Japanese language certifications does he have?",
		fixed: [FIXED.chunk0],
		struct: [STRUCT.chunk0],
	},
];

async function main() {
	await withWorkspace(WORKSPACE_ID, async (tx) => {
		for (const q of questions) {
			await tx.evalQuestion.create({
				data: {
					workspaceId: WORKSPACE_ID,
					question: q.question,
					expectedChunkIds: q.fixed,
					chunkingStrategy: "fixed",
				},
			});
			await tx.evalQuestion.create({
				data: {
					workspaceId: WORKSPACE_ID,
					question: q.question,
					expectedChunkIds: q.struct,
					chunkingStrategy: "structure_aware",
				},
			});
		}
	});
	console.log(`Seeded ${questions.length * 2} eval questions.`);
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());

import { prisma } from "../src/db/client";
import { withWorkspace } from "../src/db/withWorkspace";

const WORKSPACE_ID = "e8774480-7e08-4c4b-ba97-dc3a6b8d3944";

const questions = [
	{
		question: "What kind of performance does DynamoDB give you at scale?",
		fixed: [
			"b7e815ee-c8f1-4720-8e87-ad9812cf4b9a",
			"5a7ba799-8390-4f6d-9cfa-f6819cf74b0e",
		],
		struct: ["d3916200-3354-4db8-9d9b-e4496468aae3"],
	},
	{
		question: "What do EC2 security groups let you control?",
		fixed: [
			"4177562c-bfc7-4594-83c1-37f7a13c1961",
			"eb76e8ad-3340-427a-a803-38b8369aa4d6",
		],
		struct: ["5b3db219-b4e8-4e89-8b96-2484a3664774"],
	},
	{
		question: "What does S3 Object Lock protect against?",
		fixed: [
			"9eb98031-4ada-4912-ae84-a6a92d54788a",
			"4eec4252-be3d-4862-a4fc-fecc9c45d08e",
		],
		struct: ["e0f7043a-f58b-4c63-9add-11b8dfd8bf78"],
	},
	{
		question: "How do you connect two separate VPCs to talk to each other?",
		fixed: [
			"d42a35dc-826e-4b88-9c59-62a0b4bf6463",
			"d2947d16-ee15-4107-8c93-d9f64a6346aa",
		],
		struct: ["d67aac96-f9eb-433e-8435-f747146d4db0"],
	},
	{
		question:
			"What's the main selling point of Lambda vs. running your own servers?",
		fixed: ["805b3fea-62e0-4210-a4bb-1f3930e76312"],
		struct: ["3bd3a8c0-d23d-4e47-ac98-a7b2812890ba"],
	},
	{
		question:
			"What's the difference between a Lambda Function and a Lambda MicroVM?",
		fixed: [
			"805b3fea-62e0-4210-a4bb-1f3930e76312",
			"20027cc2-6e2e-4fce-b8a5-0ac71eb6529a",
		],
		struct: [
			"3bd3a8c0-d23d-4e47-ac98-a7b2812890ba",
			"8116a78a-a07d-4cbd-a551-eb0119327340",
		],
	},
	{
		question:
			"Does DynamoDB require you to patch or maintain servers yourself?",
		fixed: [
			"b7e815ee-c8f1-4720-8e87-ad9812cf4b9a",
			"5a7ba799-8390-4f6d-9cfa-f6819cf74b0e",
		],
		struct: ["df8fe39e-a1f1-453f-950d-27dd59a4d507"],
	},
	{
		question:
			"What's a simpler, cheaper alternative to EC2 for small web apps?",
		fixed: [
			"eb76e8ad-3340-427a-a803-38b8369aa4d6",
			"d3347b14-1436-4a6c-bae4-d4a2a4fec6a8",
		],
		struct: ["a27b1fa6-6468-48c7-a890-962bf93dc1c6"],
	},
	{
		question: "What does S3 Replication let you do with your objects?",
		fixed: [
			"9eb98031-4ada-4912-ae84-a6a92d54788a",
			"4eec4252-be3d-4862-a4fc-fecc9c45d08e",
		],
		struct: ["e0f7043a-f58b-4c63-9add-11b8dfd8bf78"],
	},
	{
		question:
			"How do you interact with VPC at the lowest, most direct level?",
		fixed: [
			"d2947d16-ee15-4107-8c93-d9f64a6346aa",
			"6450a2d9-0fe1-4b3b-9f33-4f6d07566cfc",
		],
		struct: ["e5b35e54-8c02-4804-a074-b3f5453d45c4"],
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

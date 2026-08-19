import { prisma } from "../src/db/client";
import { withWorkspace } from "../src/db/withWorkspace";
import bcrypt from "bcrypt";

async function main() {
	console.log("Seeding a test user and two workspaces...\n");

	const passwordHash = await bcrypt.hash("testpassword123", 12);
	const user = await prisma.user.create({
		data: {
			email: `isolation-test-${Date.now()}@example.com`,
			passwordHash,
		},
	});

	const wsA = await prisma.workspace.create({
		data: { ownerId: user.id, name: "Personal", type: "personal" },
	});
	const wsB = await prisma.workspace.create({
		data: { ownerId: user.id, name: "Company", type: "company" },
	});

	// Creating Documents also goes through RLS (FORCE RLS applies the USING
	// clause to INSERT too, since no separate WITH CHECK was defined), so
	// even these seed writes must run inside withWorkspace.
	const docA = await withWorkspace(wsA.id, (tx) =>
		tx.document.create({
			data: {
				workspaceId: wsA.id,
				filename: "personal-notes.pdf",
				fileType: "pdf",
				status: "ready",
			},
		}),
	);
	const docB = await withWorkspace(wsB.id, (tx) =>
		tx.document.create({
			data: {
				workspaceId: wsB.id,
				filename: "company-handbook.pdf",
				fileType: "pdf",
				status: "ready",
			},
		}),
	);

	console.log(`Workspace A (Personal): ${wsA.id}`);
	console.log(`Workspace B (Company):  ${wsB.id}\n`);

	// --- Test 1: scoped to A, deliberately query with NO workspace filter ---
	console.log(
		"Test 1: query Document with no WHERE clause, scoped to workspace A...",
	);
	const resultsAsA = await withWorkspace(wsA.id, (tx) =>
		tx.document.findMany(),
	);

	const leaked = resultsAsA.some((d) => d.workspaceId === wsB.id);
	console.log(`  Rows returned: ${resultsAsA.length}`);
	console.log(`  Contains workspace B data: ${leaked}`);
	if (leaked || resultsAsA.length !== 1) {
		throw new Error(
			"ISOLATION FAILURE: workspace A query leaked workspace B data",
		);
	}
	console.log("  PASS — only workspace A's document returned\n");

	// --- Test 2: no workspace scoping at all — should fail closed ---
	console.log("Test 2: raw query with app.workspace_id never set...");
	const rawResults = await prisma.$queryRawUnsafe<any[]>(
		`SELECT * FROM "Document"`,
	);
	console.log(`  Rows returned: ${rawResults.length}`);
	if (rawResults.length !== 0) {
		throw new Error(
			"ISOLATION FAILURE: unscoped query returned rows — RLS is failing OPEN",
		);
	}
	console.log("  PASS — zero rows returned, RLS fails closed as expected\n");

	console.log("Cleaning up test data...");
	await withWorkspace(wsA.id, (tx) =>
		tx.document.deleteMany({ where: { workspaceId: wsA.id } }),
	);
	await withWorkspace(wsB.id, (tx) =>
		tx.document.deleteMany({ where: { workspaceId: wsB.id } }),
	);
	await prisma.workspace.deleteMany({
		where: { id: { in: [wsA.id, wsB.id] } },
	});
	await prisma.user.delete({ where: { id: user.id } });

	console.log("\nAll isolation tests passed.");
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());

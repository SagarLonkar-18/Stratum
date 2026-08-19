import { prisma } from "./client";

/**
 * Runs `fn` with the Postgres connection scoped to a single workspace.
 *
 * `SET LOCAL app.workspace_id` only takes effect within the current
 * transaction, so this must run inside `prisma.$transaction`. Every query
 * issued through `tx` inside `fn` is then filtered by the RLS policies on
 * Document/Chunk — a developer forgetting a `WHERE workspaceId = ...`
 * clause cannot leak rows across workspaces, because the database itself
 * won't return them.
 *
 * If this wrapper isn't used, or workspaceId is wrong, RLS's fail-closed
 * behavior means queries return zero rows, not all rows.
 */
export async function withWorkspace<T>(
	workspaceId: string,
	fn: (
		tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
	) => Promise<T>,
): Promise<T> {
	return prisma.$transaction(async (tx) => {
		// set_config with is_local=true is equivalent to SET LOCAL, scoped
		// to this transaction only — it doesn't leak to other connections
		// or persist after the transaction ends.
		await tx.$executeRawUnsafe(
			`SELECT set_config('app.workspace_id', $1, true)`,
			workspaceId,
		);
		return fn(tx);
	});
}

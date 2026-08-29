import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogOut, Pencil, Trash2, Check, X } from "lucide-react";
import { api, type Workspace } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Combobox } from "../components/Combobox";

export function WorkspacesPage() {
	const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [newType, setNewType] = useState("");

	// Which workspace is currently being renamed (null = none), and its
	// in-progress edited value.
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");

	// Which workspace the user has asked to delete but not yet confirmed —
	// deletion is destructive (cascades to documents/chunks/files), so it
	// requires an explicit second step rather than firing on first click.
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
		null,
	);

	const navigate = useNavigate();
	const { logout } = useAuth();

	useEffect(() => {
		api.listWorkspaces().then(setWorkspaces);
	}, []);

	// Previously-used types, de-duplicated — offered as suggestions in the
	// combobox rather than a hardcoded, limited list.
	const typeSuggestions = workspaces
		? Array.from(new Set(workspaces.map((w) => w.type)))
		: [];

	async function handleCreate(e: FormEvent) {
		e.preventDefault();
		if (!newName.trim() || !newType.trim()) return;
		const created = await api.createWorkspace(
			newName.trim(),
			newType.trim(),
		);
		setWorkspaces((prev) => (prev ? [created, ...prev] : [created]));
		setNewName("");
		setNewType("");
		setIsCreating(false);
	}

	function startEditing(ws: Workspace) {
		setEditingId(ws.id);
		setEditName(ws.name);
	}

	async function saveRename(id: string) {
		if (!editName.trim()) return;
		const updated = await api.updateWorkspace(id, {
			name: editName.trim(),
		});
		setWorkspaces(
			(prev) => prev?.map((w) => (w.id === id ? updated : w)) ?? null,
		);
		setEditingId(null);
	}

	async function confirmDelete(id: string) {
		await api.deleteWorkspace(id);
		setWorkspaces((prev) => prev?.filter((w) => w.id !== id) ?? null);
		setConfirmingDeleteId(null);
	}

	return (
		<div className="min-h-screen bg-base-900">
			<header className="border-b border-base-700 px-6 py-4 flex items-center justify-between">
				<span className="font-display text-sm tracking-tight text-ink-100">
					STRATUM
				</span>
				<button
					onClick={logout}
					className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-300 transition-colors"
				>
					<LogOut size={14} />
					Sign out
				</button>
			</header>

			<main className="max-w-3xl mx-auto px-6 py-12">
				<div className="flex items-center justify-between mb-8">
					<div>
						<h1 className="text-lg text-ink-100 font-medium">
							Workspaces
						</h1>
						<p className="text-sm text-ink-500 mt-1">
							Each workspace's documents are isolated from every
							other workspace at the database layer.
						</p>
					</div>
					<button
						onClick={() => setIsCreating((v) => !v)}
						className="flex items-center gap-1.5 bg-base-800 border border-base-600 hover:border-verified-500 rounded-md px-3 py-1.5 text-sm text-ink-100 transition-colors whitespace-nowrap shrink-0"
					>
						<Plus size={14} />
						New workspace
					</button>
				</div>

				{isCreating && (
					<form
						onSubmit={handleCreate}
						className="mb-6 bg-base-850 border border-base-700 rounded-lg p-4 flex items-start gap-3"
					>
						<input
							autoFocus
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="Workspace name"
							className="flex-1 bg-base-900 border border-base-600 rounded-md px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-verified-500"
						/>
						<Combobox
							value={newType}
							onChange={setNewType}
							suggestions={typeSuggestions}
							placeholder="Type (e.g. Personal, Client Work)"
						/>
						<button
							type="submit"
							disabled={!newName.trim() || !newType.trim()}
							className="bg-verified-500 hover:bg-verified-400 disabled:opacity-40 text-base-950 text-sm font-medium rounded-md px-4 py-1.5 transition-colors shrink-0"
						>
							Create
						</button>
					</form>
				)}

				{workspaces === null && (
					<p className="text-sm text-ink-500">Loading…</p>
				)}

				{workspaces?.length === 0 && (
					<div className="border border-dashed border-base-600 rounded-lg py-16 text-center">
						<p className="text-sm text-ink-500">
							No workspaces yet. Create one to upload documents
							and start asking questions.
						</p>
					</div>
				)}

				<div className="flex flex-col gap-2">
					{workspaces?.map((ws) => {
						const isEditing = editingId === ws.id;
						const isConfirmingDelete = confirmingDeleteId === ws.id;

						return (
							<div
								key={ws.id}
								className="bg-base-850 border border-base-700 hover:border-base-600 rounded-lg px-4 py-3 flex items-center justify-between transition-colors gap-3"
							>
								{isEditing ? (
									<div className="flex-1 flex items-center gap-2">
										<input
											autoFocus
											value={editName}
											onChange={(e) =>
												setEditName(e.target.value)
											}
											onKeyDown={(e) => {
												if (e.key === "Enter")
													saveRename(ws.id);
												if (e.key === "Escape")
													setEditingId(null);
											}}
											className="flex-1 bg-base-900 border border-base-600 rounded-md px-2 py-1 text-sm text-ink-100 outline-none focus:border-verified-500"
										/>
										<button
											onClick={() => saveRename(ws.id)}
											className="text-verified-500 hover:text-verified-400 transition-colors"
											aria-label="Save"
										>
											<Check size={16} />
										</button>
										<button
											onClick={() => setEditingId(null)}
											className="text-ink-500 hover:text-ink-300 transition-colors"
											aria-label="Cancel"
										>
											<X size={16} />
										</button>
									</div>
								) : (
									<button
										onClick={() =>
											navigate(`/workspaces/${ws.id}`)
										}
										className="flex-1 text-left"
									>
										<p className="text-sm text-ink-100">
											{ws.name}
										</p>
										<p className="text-xs text-ink-500 mt-0.5">
											{ws.type} · created{" "}
											{new Date(
												ws.createdAt,
											).toLocaleDateString()}
										</p>
									</button>
								)}

								{!isEditing && !isConfirmingDelete && (
									<div className="flex items-center gap-3 shrink-0">
										<button
											onClick={() => startEditing(ws)}
											className="text-ink-500 hover:text-ink-300 transition-colors"
											aria-label="Rename workspace"
										>
											<Pencil size={14} />
										</button>
										<button
											onClick={() =>
												setConfirmingDeleteId(ws.id)
											}
											className="text-ink-500 hover:text-danger-500 transition-colors"
											aria-label="Delete workspace"
										>
											<Trash2 size={14} />
										</button>
										<span className="text-xs font-display text-ink-700">
											→
										</span>
									</div>
								)}

								{isConfirmingDelete && (
									<div className="flex items-center gap-2 shrink-0">
										<span className="text-xs text-danger-500">
											Delete permanently?
										</span>
										<button
											onClick={() => confirmDelete(ws.id)}
											className="text-xs bg-danger-500/20 border border-danger-500/50 text-danger-500 rounded px-2 py-1 hover:bg-danger-500/30 transition-colors"
										>
											Delete
										</button>
										<button
											onClick={() =>
												setConfirmingDeleteId(null)
											}
											className="text-xs text-ink-500 hover:text-ink-300 transition-colors px-1"
										>
											Cancel
										</button>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</main>
		</div>
	);
}

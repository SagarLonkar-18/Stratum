import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogOut } from "lucide-react";
import { api, type Workspace } from "../lib/api";
import { useAuth } from "../lib/auth";

export function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("personal");
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    api.listWorkspaces().then(setWorkspaces);
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const created = await api.createWorkspace(newName.trim(), newType);
    setWorkspaces((prev) => (prev ? [created, ...prev] : [created]));
    setNewName("");
    setIsCreating(false);
  }

  return (
    <div className="min-h-screen bg-base-900">
      <header className="border-b border-base-700 px-6 py-4 flex items-center justify-between">
        <span className="font-display text-sm tracking-tight text-ink-100">STRATUM</span>
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
            <h1 className="text-lg text-ink-100 font-medium">Workspaces</h1>
            <p className="text-sm text-ink-500 mt-1">
              Each workspace's documents are isolated from every other workspace at the database
              layer.
            </p>
          </div>
          <button
            onClick={() => setIsCreating((v) => !v)}
            className="flex items-center gap-1.5 bg-base-800 border border-base-600 hover:border-verified-500 rounded-md px-3 py-1.5 text-sm text-ink-100 transition-colors"
          >
            <Plus size={14} />
            New workspace
          </button>
        </div>

        {isCreating && (
          <form
            onSubmit={handleCreate}
            className="mb-6 bg-base-850 border border-base-700 rounded-lg p-4 flex gap-3"
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Workspace name"
              className="flex-1 bg-base-900 border border-base-600 rounded-md px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-verified-500"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="bg-base-900 border border-base-600 rounded-md px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-verified-500"
            >
              <option value="personal">Personal</option>
              <option value="company">Company</option>
            </select>
            <button
              type="submit"
              className="bg-verified-500 hover:bg-verified-400 text-base-950 text-sm font-medium rounded-md px-4 transition-colors"
            >
              Create
            </button>
          </form>
        )}

        {workspaces === null && <p className="text-sm text-ink-500">Loading…</p>}

        {workspaces?.length === 0 && (
          <div className="border border-dashed border-base-600 rounded-lg py-16 text-center">
            <p className="text-sm text-ink-500">No workspaces yet. Create one to upload documents and start asking questions.</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {workspaces?.map((ws) => (
            <button
              key={ws.id}
              onClick={() => navigate(`/workspaces/${ws.id}`)}
              className="text-left bg-base-850 border border-base-700 hover:border-base-600 rounded-lg px-4 py-3 flex items-center justify-between transition-colors"
            >
              <div>
                <p className="text-sm text-ink-100">{ws.name}</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  {ws.type} · created {new Date(ws.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className="text-xs font-display text-ink-700">→</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

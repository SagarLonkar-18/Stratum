export interface Workspace {
	id: string;
	name: string;
	type: string;
	createdAt: string;
}

export interface Document {
	id: string;
	filename: string;
	fileType: string;
	status: "processing" | "ready" | "failed";
	uploadedAt: string;
}

export interface ChatSource {
	chunkNumber: number;
	id: string;
	chunkIndex: number;
	content: string;
}

export interface ChatResponse {
	question: string;
	answer: string;
	sources: ChatSource[];
	conversationId: string;
}

class ApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export interface Conversation {
	id: string;
	workspaceId: string;
	title: string | null;
	createdAt: string;
}

export interface Message {
	id: string;
	conversationId: string;
	role: "user" | "assistant";
	content: string;
	sources: ChatSource[] | null;
	createdAt: string;
}

export interface ConversationWithMessages extends Conversation {
	messages: Message[];
}

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
	authToken = token;
	if (token) {
		localStorage.setItem("stratum_token", token);
	} else {
		localStorage.removeItem("stratum_token");
	}
}

export function loadStoredToken(): string | null {
	const stored = localStorage.getItem("stratum_token");
	authToken = stored;
	return stored;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...((options.headers as Record<string, string>) ?? {}),
	};
	if (authToken) {
		headers.Authorization = `Bearer ${authToken}`;
	}

	const res = await fetch(path, { ...options, headers });

	if (!res.ok) {
		let message = `Request failed (${res.status})`;
		try {
			const body = await res.json();
			if (body.error) message = body.error;
		} catch {
			// response wasn't JSON — keep the generic message
		}
		throw new ApiError(res.status, message);
	}

	return res.json();
}

export const api = {
	register: (email: string, password: string) =>
		request<{ id: string; email: string }>("/auth/register", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		}),

	login: (email: string, password: string) =>
		request<{ token: string }>("/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		}),

	listWorkspaces: () => request<Workspace[]>("/workspaces"),

	updateWorkspace: (id: string, data: { name?: string; type?: string }) =>
		request<Workspace>(`/workspaces/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	deleteWorkspace: async (id: string): Promise<void> => {
		const headers: Record<string, string> = {};
		if (authToken) headers.Authorization = `Bearer ${authToken}`;
		const res = await fetch(`/workspaces/${id}`, {
			method: "DELETE",
			headers,
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new ApiError(res.status, body.error ?? "Delete failed");
		}
	},

	listDocuments: (workspaceId: string) =>
		request<Document[]>(`/workspaces/${workspaceId}/documents`),

	createWorkspace: (name: string, type: string) =>
		request<Workspace>("/workspaces", {
			method: "POST",
			body: JSON.stringify({ name, type }),
		}),

	getWorkspace: (id: string) => request<Workspace>(`/workspaces/${id}`),

	uploadDocument: async (
		workspaceId: string,
		file: File,
	): Promise<Document> => {
		const formData = new FormData();
		formData.append("file", file);

		const headers: Record<string, string> = {};
		if (authToken) headers.Authorization = `Bearer ${authToken}`;

		const res = await fetch(`/workspaces/${workspaceId}/documents`, {
			method: "POST",
			headers,
			body: formData,
		});

		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new ApiError(res.status, body.error ?? "Upload failed");
		}
		return res.json();
	},

	chat: (
		workspaceId: string,
		question: string,
		chunkingStrategy: "fixed" | "structure_aware",
		conversationId?: string,
	) =>
		request<ChatResponse>(`/workspaces/${workspaceId}/chat`, {
			method: "POST",
			body: JSON.stringify({
				question,
				chunkingStrategy,
				conversationId,
			}),
		}),

	listConversations: (workspaceId: string) =>
		request<Conversation[]>(`/workspaces/${workspaceId}/conversations`),

	getConversation: (workspaceId: string, conversationId: string) =>
		request<ConversationWithMessages>(
			`/workspaces/${workspaceId}/conversations/${conversationId}`,
		),
};

export { ApiError };

import axios, { AxiosError } from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

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

export class ApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
	const token = localStorage.getItem("stratum_token");
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

client.interceptors.response.use(
	(res) => res,
	(err: AxiosError<{ error?: string }>) => {
		const status = err.response?.status ?? 0;
		const message =
			err.response?.data?.error ?? err.message ?? "Request failed";
		return Promise.reject(new ApiError(status, message));
	},
);

export function setAuthToken(token: string | null) {
	if (token) {
		localStorage.setItem("stratum_token", token);
	} else {
		localStorage.removeItem("stratum_token");
	}
}

export function loadStoredToken(): string | null {
	return localStorage.getItem("stratum_token");
}

export const api = {
	register: (email: string, password: string) =>
		client
			.post<{
				id: string;
				email: string;
			}>("/auth/register", { email, password })
			.then((r) => r.data),

	login: (email: string, password: string) =>
		client
			.post<{ token: string }>("/auth/login", { email, password })
			.then((r) => r.data),

	listWorkspaces: () =>
		client.get<Workspace[]>("/workspaces").then((r) => r.data),

	createWorkspace: (name: string, type: string) =>
		client
			.post<Workspace>("/workspaces", { name, type })
			.then((r) => r.data),

	getWorkspace: (id: string) =>
		client.get<Workspace>(`/workspaces/${id}`).then((r) => r.data),

	updateWorkspace: (id: string, data: { name?: string; type?: string }) =>
		client.patch<Workspace>(`/workspaces/${id}`, data).then((r) => r.data),

	deleteWorkspace: (id: string) =>
		client.delete(`/workspaces/${id}`).then(() => undefined),

	listDocuments: (workspaceId: string) =>
		client
			.get<Document[]>(`/workspaces/${workspaceId}/documents`)
			.then((r) => r.data),

	uploadDocument: (workspaceId: string, file: File) => {
		const formData = new FormData();
		formData.append("file", file);
		return client
			.post<Document>(`/workspaces/${workspaceId}/documents`, formData, {
				headers: { "Content-Type": "multipart/form-data" },
			})
			.then((r) => r.data);
	},

	deleteDocument: (workspaceId: string, documentId: string) =>
		client
			.delete(`/workspaces/${workspaceId}/documents/${documentId}`)
			.then(() => undefined),

	chat: (
		workspaceId: string,
		question: string,
		chunkingStrategy: "fixed" | "structure_aware",
		conversationId?: string,
	) =>
		client
			.post<ChatResponse>(`/workspaces/${workspaceId}/chat`, {
				question,
				chunkingStrategy,
				conversationId,
			})
			.then((r) => r.data),

	listConversations: (workspaceId: string) =>
		client
			.get<Conversation[]>(`/workspaces/${workspaceId}/conversations`)
			.then((r) => r.data),

	getConversation: (workspaceId: string, conversationId: string) =>
		client
			.get<ConversationWithMessages>(
				`/workspaces/${workspaceId}/conversations/${conversationId}`,
			)
			.then((r) => r.data),

	updateConversation: (
		workspaceId: string,
		conversationId: string,
		title: string,
	) =>
		client
			.patch<Conversation>(
				`/workspaces/${workspaceId}/conversations/${conversationId}`,
				{ title },
			)
			.then((r) => r.data),

	deleteConversation: (workspaceId: string, conversationId: string) =>
		client
			.delete(
				`/workspaces/${workspaceId}/conversations/${conversationId}`,
			)
			.then(() => undefined),
};

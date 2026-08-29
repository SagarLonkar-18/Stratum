import { useState, useRef, type FormEvent, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
	Upload,
	FileText,
	Send,
	Loader2,
	MessageSquare,
	ArrowLeft,
} from "lucide-react";
import {
	api,
	type Workspace,
	type Document,
	type ChatSource,
} from "../lib/api";
import { AnswerText } from "../components/AnswerText";
import { SourcePanel } from "../components/SourcePanel";

interface Exchange {
	question: string;
	answer: string;
	sources: ChatSource[];
}

type Strategy = "fixed" | "structure_aware";

export function ChatPage() {
	const { workspaceId } = useParams<{ workspaceId: string }>();
	const navigate = useNavigate();
	const [workspace, setWorkspace] = useState<Workspace | null>(null);
	const [documents, setDocuments] = useState<Document[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [strategy, setStrategy] = useState<Strategy>("fixed");
	const [question, setQuestion] = useState("");
	const [exchanges, setExchanges] = useState<Exchange[]>([]);
	// The question the user just submitted, shown immediately while the
	// answer is still in flight — without this, the question only appears
	// once the full response arrives, which reads as if input was silently
	// dropped.
	const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
	const [activeChunk, setActiveChunk] = useState<number | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!workspaceId) return;
		api.getWorkspace(workspaceId).then(setWorkspace);
		api.listDocuments(workspaceId).then(setDocuments);
	}, [workspaceId]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [exchanges, pendingQuestion]);

	async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file || !workspaceId) return;
		setIsUploading(true);
		try {
			const doc = await api.uploadDocument(workspaceId, file);
			setDocuments((prev) => [doc, ...prev]);
		} finally {
			setIsUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	}

	async function handleAsk(e: FormEvent) {
		e.preventDefault();
		if (!question.trim() || !workspaceId || pendingQuestion) return;
		const q = question.trim();
		setQuestion("");
		setPendingQuestion(q);
		setActiveChunk(null);
		try {
			const res = await api.chat(workspaceId, q, strategy);
			setExchanges((prev) => [
				...prev,
				{ question: q, answer: res.answer, sources: res.sources },
			]);
		} finally {
			setPendingQuestion(null);
		}
	}

	const lastSources =
		exchanges.length > 0 ? exchanges[exchanges.length - 1].sources : null;

	return (
		<div className="h-screen bg-base-900 flex flex-col overflow-hidden">
			<header className="border-b border-base-700 px-6 py-4 flex items-center gap-4 shrink-0">
				<button
					onClick={() => navigate("/")}
					className="flex items-center gap-1.5 text-ink-500 hover:text-ink-300 transition-colors"
				>
					<ArrowLeft size={15} />
					<span className="text-xs">Workspaces</span>
				</button>
				<span className="text-base-600">|</span>
				<span className="font-display text-sm tracking-tight text-ink-100">
					STRATUM
				</span>
			</header>

			<div className="flex flex-1 overflow-hidden">
				{/* Left: workspace context (name/type) + conversation history.
            Conversation history is a placeholder — chat is not yet
            persisted server-side, so there is genuinely nothing to list
            here beyond the current session; the empty state says so
            rather than implying a feature that doesn't exist yet. */}
				<aside className="w-56 shrink-0 border-r border-base-700 bg-base-850 flex-col overflow-hidden hidden lg:flex">
					<div className="px-4 py-3 border-b border-base-700">
						<p className="text-sm text-ink-100 leading-none">
							{workspace?.name ?? "…"}
						</p>
						<p className="text-[11px] text-ink-700 mt-1">
							{workspace?.type}
						</p>
					</div>
					<div className="px-4 py-3 border-b border-base-700">
						<p className="text-xs uppercase tracking-wide text-ink-500">
							Conversations
						</p>
					</div>
					<div className="flex-1 flex items-center justify-center px-5 text-center">
						<p className="text-xs text-ink-700 leading-relaxed">
							<MessageSquare
								size={16}
								className="mx-auto mb-2 text-ink-700"
							/>
							Conversation history isn't persisted yet — this
							session's messages are below.
						</p>
					</div>
				</aside>

				{/* Center: chat thread */}
				<main className="flex-1 flex flex-col overflow-hidden">
					<div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
						{exchanges.length === 0 && !pendingQuestion && (
							<div className="flex-1 flex items-center justify-center">
								<p className="text-sm text-ink-700 max-w-xs text-center">
									Upload a document, then ask a question.
									Every claim in the answer traces back to a
									specific retrieved chunk - click a citation
									to see its source.
								</p>
							</div>
						)}

						{exchanges.map((ex, i) => (
							<div key={i} className="flex flex-col gap-3">
								<div className="self-end max-w-lg bg-base-800 rounded-lg px-4 py-2.5">
									<p className="text-sm text-ink-100">
										{ex.question}
									</p>
								</div>
								<div className="max-w-lg bg-base-850 border border-base-700 rounded-lg px-4 py-3">
									<AnswerText
										text={ex.answer}
										activeChunk={
											i === exchanges.length - 1
												? activeChunk
												: null
										}
										onCiteClick={(n) =>
											setActiveChunk((cur) =>
												cur === n ? null : n,
											)
										}
									/>
								</div>
							</div>
						))}

						{pendingQuestion && (
							<div className="flex flex-col gap-3">
								<div className="self-end max-w-lg bg-base-800 rounded-lg px-4 py-2.5">
									<p className="text-sm text-ink-100">
										{pendingQuestion}
									</p>
								</div>
								<div className="max-w-lg bg-base-850 border border-base-700 rounded-lg px-4 py-3 flex items-center gap-2">
									<Loader2
										size={13}
										className="animate-spin text-verified-500"
									/>
									<p className="text-sm text-ink-500">
										Retrieving and generating…
									</p>
								</div>
							</div>
						)}
						<div ref={bottomRef} />
					</div>

					<form
						onSubmit={handleAsk}
						className="border-t border-base-700 p-4 flex gap-2 shrink-0"
					>
						<input
							value={question}
							onChange={(e) => setQuestion(e.target.value)}
							placeholder="Ask a question about the uploaded documents…"
							disabled={!!pendingQuestion}
							className="flex-1 bg-base-850 border border-base-600 rounded-md px-3 py-2 text-sm text-ink-100 outline-none focus:border-verified-500 transition-colors disabled:opacity-50"
						/>
						<button
							type="submit"
							disabled={!!pendingQuestion || !question.trim()}
							className="bg-verified-500 hover:bg-verified-400 disabled:opacity-40 text-base-950 rounded-md px-3.5 transition-colors flex items-center justify-center"
						>
							{pendingQuestion ? (
								<Loader2 size={15} className="animate-spin" />
							) : (
								<Send size={15} />
							)}
						</button>
					</form>
				</main>

				{/* Right: documents + strategy, stacked above retrieved sources */}
				<aside className="w-80 shrink-0 border-l border-base-700 bg-base-850 flex-col overflow-hidden hidden md:flex">
					<div className="p-4 border-b border-base-700">
						<input
							ref={fileInputRef}
							type="file"
							accept=".pdf"
							onChange={handleUpload}
							className="hidden"
						/>
						<button
							onClick={() => fileInputRef.current?.click()}
							disabled={isUploading}
							className="w-full flex items-center justify-center gap-2 border border-dashed border-base-600 hover:border-verified-500 rounded-md py-2.5 text-xs text-ink-300 transition-colors disabled:opacity-50"
						>
							{isUploading ? (
								<>
									<Loader2
										size={13}
										className="animate-spin"
									/>{" "}
									Processing…
								</>
							) : (
								<>
									<Upload size={13} /> Upload PDF
								</>
							)}
						</button>

						{documents.length > 0 && (
							<div className="mt-3 flex flex-col gap-1 max-h-56 overflow-y-auto">
								{documents.map((d) => (
									<div
										key={d.id}
										className="flex items-center gap-2 px-1 py-1 rounded text-xs text-ink-300"
									>
										<FileText
											size={12}
											className="text-ink-700 shrink-0"
										/>
										<span className="truncate">
											{d.filename}
										</span>
									</div>
								))}
							</div>
						)}

						<div className="mt-3 pt-3 border-t border-base-700">
							<p className="text-[10px] uppercase tracking-wide text-ink-700 mb-2">
								Chunking strategy
							</p>
							<div className="flex gap-1 bg-base-900 rounded-md p-1">
								{(
									["fixed", "structure_aware"] as Strategy[]
								).map((s) => (
									<button
										key={s}
										onClick={() => setStrategy(s)}
										className={`flex-1 py-1 text-[11px] rounded transition-colors ${
											strategy === s
												? "bg-base-700 text-ink-100"
												: "text-ink-700 hover:text-ink-500"
										}`}
									>
										{s === "fixed" ? "Fixed" : "Structure"}
									</button>
								))}
							</div>
						</div>
					</div>

					<div className="flex-1 overflow-hidden">
						<SourcePanel
							sources={lastSources}
							activeChunk={activeChunk}
							onSelect={setActiveChunk}
						/>
					</div>
				</aside>
			</div>
		</div>
	);
}

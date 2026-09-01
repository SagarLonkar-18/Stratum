const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const LLM_MODEL = process.env.OLLAMA_LLM_MODEL ?? "qwen2.5:7b-instruct-q4_K_M";

export async function generateCompletion(prompt: string): Promise<string> {
	const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: LLM_MODEL,
			prompt,
			stream: false,
			options: { temperature: 0.2 },
		}),
	});

	if (!res.ok) {
		throw new Error(
			`Ollama generate request failed: ${res.status} ${await res.text()}`,
		);
	}

	const data = (await res.json()) as { response: string };
	return data.response;
}

export async function* generateCompletionStream(
	prompt: string,
): AsyncGenerator<string> {
	const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: LLM_MODEL,
			prompt,
			stream: true,
			options: { temperature: 0.2 },
		}),
	});

	if (!res.ok || !res.body) {
		throw new Error(
			`Ollama generate request failed: ${res.status} ${await res.text()}`,
		);
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? ""; // keep the last, possibly incomplete line

		for (const line of lines) {
			if (!line.trim()) continue;
			const parsed = JSON.parse(line) as {
				response: string;
				done: boolean;
			};
			if (parsed.response) yield parsed.response;
		}
	}
}

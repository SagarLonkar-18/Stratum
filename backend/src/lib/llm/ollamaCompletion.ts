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

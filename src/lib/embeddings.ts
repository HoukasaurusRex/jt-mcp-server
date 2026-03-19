/**
 * Embedding provider with graceful degradation.
 * Tries Ollama (local, free), falls back to disabled.
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const EMBEDDING_MODEL = process.env.JT_MEMORY_EMBEDDING_MODEL ?? "all-minilm";
const PROVIDER = process.env.JT_MEMORY_EMBEDDING_PROVIDER ?? "ollama";

let _available: boolean | null = null;

async function isOllamaAvailable(): Promise<boolean> {
  if (_available !== null) return _available;
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    _available = res.ok;
  } catch {
    _available = false;
  }
  return _available;
}

export async function embed(text: string): Promise<number[] | null> {
  if (PROVIDER === "none") return null;

  if (!(await isOllamaAvailable())) return null;

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { embeddings?: number[][] };
    return data.embeddings?.[0] ?? null;
  } catch {
    return null;
  }
}

export function isEmbeddingEnabled(): boolean {
  return PROVIDER !== "none";
}

/** Reset availability cache (for testing). */
export function _resetAvailability(): void {
  _available = null;
}

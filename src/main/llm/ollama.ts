export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function* chatStream(
  baseUrl: string,
  model: string,
  messages: OllamaMessage[]
): AsyncGenerator<string> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Ollama error ${response.status}: ${text}`);
  }

  if (!response.body) throw new Error('No response body from Ollama');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.message?.content) yield data.message.content as string;
        if (data.done) return;
      } catch {
        // skip malformed lines
      }
    }
  }
}

export async function checkConnection(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

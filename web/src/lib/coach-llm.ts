// Cliente mínimo do Groq (OpenAI-compat) pro painel web.
// A bot tem o rate-limiter pesado (bot/llm.py); aqui as chamadas são manuais
// e raras (a pessoa toca 1 dia da trilha), então basta 1 retry em 429.

const BASE = process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
const KEY = process.env.GROQ_API_KEY || "";
const MODEL = process.env.LLM_MODEL || "openai/gpt-oss-120b";

type Msg = { role: "system" | "user"; content: string };

async function chat(messages: Msg[], maxTokens: number): Promise<string> {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    temperature: 0.4,
    max_tokens: maxTokens,
  };
  if (MODEL.includes("gpt-oss")) body.reasoning_effort = "low";

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && attempt === 0) {
      const wait = Number(res.headers.get("retry-after")) || 6;
      await new Promise((r) => setTimeout(r, Math.min(wait, 20) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`groq ${res.status}: ${await res.text().catch(() => "")}`);
    const json = await res.json();
    return (json.choices?.[0]?.message?.content ?? "").trim();
  }
  throw new Error("groq rate limit persistente");
}

/** Extrai o primeiro objeto JSON de um texto (o modelo às vezes embrulha em ```). */
function parseJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("sem JSON na resposta");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function groqJson<T>(system: string, user: string, maxTokens = 1400): Promise<T> {
  const raw = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: user + "\n\nResponda SÓ com JSON válido, sem markdown." },
    ],
    maxTokens,
  );
  return parseJson(raw) as T;
}

// Cliente mínimo de LLM (OpenAI-compat) com cadeia Groq → Gemini.
// Espelha web/src/lib/coach-llm.ts, mas SEM banco e SEM telemetria — a landing
// é standalone (Vercel). Sem chave nenhuma, quem chama trata o throw.

type Provider = { name: string; base: string; key: string; model: string };

const CHAIN: Provider[] = [
  {
    name: "groq",
    base: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
    key: process.env.GROQ_API_KEY || "",
    model: process.env.LLM_MODEL || "openai/gpt-oss-120b",
  },
  {
    name: "gemini",
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    key: process.env.GEMINI_API_KEY || "",
    model: "gemini-2.0-flash",
  },
].filter((p) => p.key);

export const llmConfigured = () => CHAIN.length > 0;

type Msg = { role: "system" | "user"; content: string };

async function callOne(p: Provider, messages: Msg[], maxTokens: number): Promise<string> {
  const body: Record<string, unknown> = {
    model: p.model,
    messages,
    temperature: 0.5,
    max_tokens: maxTokens,
  };
  if (p.model.includes("gpt-oss")) body.reasoning_effort = "low";

  const res = await fetch(`${p.base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${p.name} ${res.status}`);
  const json = await res.json();
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

/** Primeiro objeto JSON de um texto (o modelo às vezes embrulha em ```). */
function parseJson(raw: string): unknown {
  const s = raw.indexOf("{");
  const e = raw.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("sem JSON na resposta");
  return JSON.parse(raw.slice(s, e + 1));
}

export async function askJson<T>(system: string, user: string, maxTokens = 700): Promise<T> {
  if (!CHAIN.length) throw new Error("nenhum provedor de LLM configurado");
  let last: unknown;
  for (const p of CHAIN) {
    try {
      const raw = await callOne(
        p,
        [
          { role: "system", content: system },
          { role: "user", content: user + "\n\nResponda SÓ com JSON válido, sem markdown." },
        ],
        maxTokens,
      );
      return parseJson(raw) as T;
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`LLM falhou: ${last}`);
}

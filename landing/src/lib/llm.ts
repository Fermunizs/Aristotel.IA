// Cliente mínimo de LLM (OpenAI-compat) com cadeia Groq → Gemini.
// Espelha web/src/lib/coach-llm.ts, mas SEM banco e SEM telemetria — a landing
// é standalone (Vercel). Sem chave nenhuma, quem chama trata o throw.

type Provider = { name: string; base: string; key: string; model: string };

// Espelha bot/config.py::_PROVIDER_SPECS. Todos OpenAI-compat.
// Ordem: LLM_PROVIDER (csv). Modelo por provedor: <PROVEDOR>_MODEL.
const SPECS: Record<string, { base: string; keyEnv: string; modelEnv: string; model: string }> = {
  gemini: {
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY", modelEnv: "GEMINI_MODEL", model: "gemini-flash-lite-latest",
  },
  groq: {
    base: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY", modelEnv: "GROQ_MODEL", model: "openai/gpt-oss-120b",
  },
  cerebras: {
    base: "https://api.cerebras.ai/v1",
    keyEnv: "CEREBRAS_API_KEY", modelEnv: "CEREBRAS_MODEL", model: "gpt-oss-120b",
  },
  sambanova: {
    base: "https://api.sambanova.ai/v1",
    keyEnv: "SAMBANOVA_API_KEY", modelEnv: "SAMBANOVA_MODEL", model: "DeepSeek-V3-0324",
  },
  mistral: {
    base: "https://api.mistral.ai/v1",
    keyEnv: "MISTRAL_API_KEY", modelEnv: "MISTRAL_MODEL", model: "mistral-small-latest",
  },
  github: {
    base: "https://models.github.ai/inference",
    keyEnv: "GITHUB_MODELS_TOKEN", modelEnv: "GITHUB_MODELS_MODEL", model: "openai/gpt-4o-mini",
  },
  openrouter: {
    base: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY", modelEnv: "OPENROUTER_MODEL",
    model: "meta-llama/llama-3.3-70b-instruct:free",
  },
};

const ORDER = (process.env.LLM_PROVIDER || "groq,gemini,mistral")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const CHAIN: Provider[] = ORDER.flatMap((name, i) => {
  const s = SPECS[name];
  const key = s ? (process.env[s.keyEnv] || "") : "";
  if (!s || !key) return [];
  const model =
    (process.env[s.modelEnv] || "").trim() ||
    (i === 0 && process.env.LLM_MODEL ? process.env.LLM_MODEL : s.model);
  return [{ name, base: s.base, key, model }];
});

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
    signal: AbortSignal.timeout(14_000), // rápido: cai pro próximo provedor sem estourar o maxDuration
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
      console.error(`[llm] ${p.name} (${p.model}) falhou:`, String(e).slice(0, 300));
    }
  }
  throw new Error(`LLM falhou: ${last}`);
}

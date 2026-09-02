// Cliente mínimo de LLM (OpenAI-compat) pro painel web, com fallback Groq → Gemini.
// A bot tem o rate-limiter pesado (bot/llm.py); aqui as chamadas são manuais e
// raras (a pessoa toca 1 dia da trilha), então basta 1 retry + cair pro Gemini.

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

const ORDER = (process.env.LLM_PROVIDER || "groq,mistral,gemini,openrouter")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const CHAIN: Provider[] = ORDER.flatMap((name, i) => {
  const s = SPECS[name];
  const key = s ? (process.env[s.keyEnv] || "") : "";
  if (!s || !key) return [];
  let model =
    (process.env[s.modelEnv] || "").trim() ||
    (i === 0 && process.env.LLM_MODEL ? process.env.LLM_MODEL : s.model);
  if (name === "openrouter" && !model.includes(":")) model += ":free";
  return [{ name, base: s.base, key, model }];
});

/** Cadeia de provedores configurada (com key), em ordem de prioridade. Usada pelo /admin/consumo. */
export function llmChain(): { name: string; model: string }[] {
  return CHAIN.map((p) => ({ name: p.name, model: p.model }));
}

/** '9.7s' | '1m30s' | '2.5' -> segundos (espelha bot/llm.py::_seconds). */
function resetSeconds(v: string | null): number | null {
  if (!v) return null;
  const m = String(v).trim().match(/(?:(\d+)m)?([\d.]+)s?/);
  if (!m) return null;
  return Number(m[1] || 0) * 60 + Number(m[2] || 0);
}

type RlSnapshot = {
  rlRemainingRequests: number | null;
  rlRemainingTokens: number | null;
  rlLimitRequests: number | null;
  rlLimitTokens: number | null;
  rlResetSeconds: number | null;
};

function rlSnapshot(h: Headers): RlSnapshot {
  const num = (...keys: string[]): number | null => {
    for (const k of keys) {
      const v = h.get(k);
      if (v == null) continue;
      const f = parseFloat(v);
      if (Number.isFinite(f)) return f;
    }
    return null;
  };
  return {
    rlRemainingRequests: num("x-ratelimit-remaining-requests", "x-ratelimit-remaining"),
    rlRemainingTokens: num("x-ratelimit-remaining-tokens"),
    rlLimitRequests: num("x-ratelimit-limit-requests", "x-ratelimit-limit"),
    rlLimitTokens: num("x-ratelimit-limit-tokens"),
    rlResetSeconds: resetSeconds(
      h.get("x-ratelimit-reset-tokens") ||
        h.get("x-ratelimit-reset-requests") ||
        h.get("x-ratelimit-reset"),
    ),
  };
}

const NO_RL: RlSnapshot = {
  rlRemainingRequests: null, rlRemainingTokens: null,
  rlLimitRequests: null, rlLimitTokens: null, rlResetSeconds: null,
};

type Msg = { role: "system" | "user" | "assistant"; content: string };
type Meta = { userId?: string; tag?: string };

async function record(row: {
  userId?: string; tag?: string; provider: string; model: string | null;
  prompt: number; completion: number; fallback: boolean; ok: boolean; status: string;
  rl?: RlSnapshot;
}) {
  try {
    const { db } = await import("./db");
    const { llmUsage } = await import("./schema");
    const rl = row.rl ?? NO_RL;
    await db.insert(llmUsage).values({
      userId: row.userId ?? null,
      source: "web",
      tag: row.tag ?? null,
      provider: row.provider,
      model: row.model,
      promptTokens: row.prompt,
      completionTokens: row.completion,
      fallback: row.fallback,
      ok: row.ok,
      status: row.status,
      rlRemainingRequests: rl.rlRemainingRequests,
      rlRemainingTokens: rl.rlRemainingTokens,
      rlLimitRequests: rl.rlLimitRequests,
      rlLimitTokens: rl.rlLimitTokens,
      rlResetSeconds: rl.rlResetSeconds,
      createdAt: new Date(),
    });
  } catch {
    /* telemetria nunca quebra a resposta */
  }
}

async function callOne(p: Provider, messages: Msg[], maxTokens: number): Promise<{ text: string; usage: { prompt_tokens?: number; completion_tokens?: number }; rl: RlSnapshot }> {
  const body: Record<string, unknown> = {
    model: p.model,
    messages,
    temperature: 0.4,
    max_tokens: maxTokens,
  };
  if (p.model.includes("gpt-oss")) body.reasoning_effort = "low";

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${p.base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && attempt === 0) {
      const wait = Number(res.headers.get("retry-after")) || 6;
      await new Promise((r) => setTimeout(r, Math.min(wait, 20) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`${p.name} ${res.status}: ${await res.text().catch(() => "")}`);
    const json = await res.json();
    return {
      text: (json.choices?.[0]?.message?.content ?? "").trim(),
      usage: json.usage ?? {},
      rl: rlSnapshot(res.headers),
    };
  }
  throw new Error(`${p.name} rate limit persistente`);
}

async function chat(messages: Msg[], maxTokens: number, meta: Meta): Promise<string> {
  if (!CHAIN.length) throw new Error("nenhum provedor de LLM configurado");
  let last: unknown;
  for (let i = 0; i < CHAIN.length; i++) {
    const p = CHAIN[i];
    try {
      const { text, usage, rl } = await callOne(p, messages, maxTokens);
      await record({
        ...meta, provider: p.name, model: p.model,
        prompt: usage.prompt_tokens ?? 0, completion: usage.completion_tokens ?? 0,
        fallback: i > 0, ok: true, status: "ok", rl,
      });
      return text;
    } catch (e) {
      last = e;
      await record({
        ...meta, provider: p.name, model: p.model, prompt: 0, completion: 0,
        fallback: i > 0, ok: false, status: String(e).includes("429") ? "429" : "error",
      });
    }
  }
  throw new Error(`todos os provedores falharam: ${last}`);
}

/** Extrai o primeiro objeto JSON de um texto (o modelo às vezes embrulha em ```). */
function parseJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("sem JSON na resposta");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function groqJson<T>(
  system: string,
  user: string,
  maxTokens = 1400,
  meta: Meta = {},
): Promise<T> {
  const raw = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: user + "\n\nResponda SÓ com JSON válido, sem markdown." },
    ],
    maxTokens,
    meta,
  );
  return parseJson(raw) as T;
}

/** Chat livre (conversa no painel) — mesma cadeia de provedores + telemetria. */
export async function coachChat(
  system: string,
  turns: { role: "user" | "assistant"; content: string }[],
  maxTokens = 500,
  meta: Meta = {},
): Promise<string> {
  return chat(
    [{ role: "system", content: system }, ...(turns as Msg[])],
    maxTokens,
    meta,
  );
}

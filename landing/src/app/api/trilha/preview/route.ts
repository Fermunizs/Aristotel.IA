import { NextResponse } from "next/server";
import { askJson, llmConfigured } from "@/lib/llm";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // geração da trilha pode passar dos 10s padrão da Vercel

type Dia = { d: number; titulo: string; objetivo: string };
type Semana = { tema: string; dias: Dia[] };

// cache por objetivo normalizado — mata o custo de repetição (é onde abuso concentra)
const cache = new Map<string, { at: number; data: Semana }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim();

const SYSTEM =
  "Você é a Aristótel.IA, treinadora de alta performance de quem tem dificuldade de foco. " +
  "Monte a SEMANA 1 (5 dias úteis) de uma trilha de aprendizado para o objetivo da pessoa. " +
  "Cada dia: um passo concreto e acionável (não 'estude X' — 'escreva/faça X'). Progressão real do dia 1 ao 5. " +
  "Português do Brasil, direto, sem textão. " +
  'Retorne SOMENTE JSON: {"tema":"<tema da semana 1>","dias":[{"d":1,"titulo":"<3-6 palavras>","objetivo":"<1 frase: o que a pessoa faz nesse dia>"}, ... 5 dias]}';

function validate(x: unknown): Semana | null {
  const s = x as Semana;
  if (!s || typeof s.tema !== "string" || !Array.isArray(s.dias) || s.dias.length < 4) return null;
  const dias = s.dias.slice(0, 5).map((d, i) => ({
    d: i + 1,
    titulo: String(d?.titulo ?? "").slice(0, 80),
    objetivo: String(d?.objetivo ?? "").slice(0, 200),
  }));
  if (dias.some((d) => !d.titulo || !d.objetivo)) return null;
  return { tema: s.tema.slice(0, 120), dias };
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";

  if (!rateLimit(`prev:${ip}`, 6, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Você já montou algumas trilhas por aqui. Continua no Telegram — lá é sem limite." },
      { status: 429 },
    );
  }

  const goal = String((await req.json().catch(() => ({}))).goal ?? "").trim().slice(0, 90);
  if (goal.length < 3) {
    return NextResponse.json({ error: "Escreve um pouco mais sobre o que quer aprender." }, { status: 400 });
  }
  if (!llmConfigured()) {
    return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  }

  const key = norm(goal);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return NextResponse.json({ ...hit.data, cached: true });
  }

  try {
    const raw = await askJson<Semana>(SYSTEM, `Objetivo da pessoa: ${goal}`, 700);
    const clean = validate(raw);
    if (!clean) throw new Error("json inválido");
    cache.set(key, { at: Date.now(), data: clean });
    if (cache.size > 800) cache.delete(cache.keys().next().value as string);
    return NextResponse.json(clean);
  } catch {
    return NextResponse.json(
      { error: "A treinadora não respondeu agora. Começa direto no Telegram que ela monta lá." },
      { status: 502 },
    );
  }
}

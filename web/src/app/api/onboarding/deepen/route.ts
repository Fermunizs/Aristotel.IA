import { NextResponse } from "next/server";
import { buildPersona } from "@/lib/persona";
import { groqJson } from "@/lib/coach-llm";
import { getSession } from "@/lib/session";

export const maxDuration = 30;

// espelha bot/prompts.py::ONB_DEEPEN
const ONB_DEEPEN =
  "A pessoa disse o que quer aprender (abaixo). Antes de montar a trilha, faça 2 a 3 perguntas " +
  "curtas pra afinar — como uma consultora faria numa primeira conversa. " +
  "As perguntas têm que ser ESPECÍFICAS desse objetivo (nada de genérico tipo 'qual seu nível'), " +
  "respondíveis em 1 linha cada, e no conjunto cobrir: pra que ela vai usar isso na prática · " +
  "o que ela já conhece de parecido · qual o primeiro resultado concreto que ela quer. " +
  "Se o objetivo cita uma ferramenta ou produto, pergunte sobre o uso real dela. " +
  'Retorne SOMENTE JSON: {"perguntas":["...","..."]}';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const goal = String(b.goal ?? "").trim().slice(0, 400);
  if (goal.length < 3) return NextResponse.json({ perguntas: [] });

  try {
    const persona = await buildPersona({ name: session.viewing.name });
    const data = await groqJson<{ perguntas?: unknown[] }>(persona + "\n\n" + ONB_DEEPEN, goal, 400, {
      userId: session.viewing.id,
      tag: "onboarding",
    });
    const qs = (Array.isArray(data?.perguntas) ? data.perguntas : [])
      .map((q) => String(q).trim())
      .filter(Boolean)
      .slice(0, 3);
    return NextResponse.json({ perguntas: qs.length >= 2 ? qs : [] });
  } catch (e) {
    console.error("onboarding/deepen", e);
    return NextResponse.json({ perguntas: [] });
  }
}

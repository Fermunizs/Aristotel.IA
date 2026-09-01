import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getOrMakeDetail, toggleChecklistItem } from "@/lib/trilha-detail";

export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { week, day } = await req.json().catch(() => ({}));
  if (!Number.isInteger(week) || !Number.isInteger(day)) {
    return NextResponse.json({ error: "week/day inválidos" }, { status: 400 });
  }

  try {
    const detail = await getOrMakeDetail(session.viewing.id, week, day);
    if (!detail) return NextResponse.json({ error: "não deu pra montar agora" }, { status: 502 });
    return NextResponse.json({ detail });
  } catch (e) {
    console.error("trilha/detail", e);
    return NextResponse.json({ error: "não deu pra montar agora" }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { week, day, index, done } = await req.json().catch(() => ({}));
  if (!Number.isInteger(week) || !Number.isInteger(day) || !Number.isInteger(index) || typeof done !== "boolean") {
    return NextResponse.json({ error: "parâmetros inválidos" }, { status: 400 });
  }

  const detail = await toggleChecklistItem(session.viewing.id, week, day, index, done);
  if (!detail) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json({ detail });
}

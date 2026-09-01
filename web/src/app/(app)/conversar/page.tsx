import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { botState } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { ChatPanel } from "@/components/ChatPanel";
import { TelegramNotice } from "@/components/TelegramNotice";

export const dynamic = "force-dynamic";

type Turn = { role: "user" | "assistant"; content: string };

export default async function Conversar() {
  const { viewing } = (await getSession())!;
  const [state] = await db.select().from(botState).where(eq(botState.userId, viewing.id)).limit(1);
  const history = (Array.isArray(state?.history) ? state!.history : []) as Turn[];

  return (
    <div className="space-y-5">
      <header>
        <p className="label">Conversar</p>
        <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.4rem)]">Fala com a treinadora</h1>
        <p className="mt-2 max-w-lg text-sm text-ink-soft">
          Mesma conversa do Telegram — o que você fala aqui ela lembra lá, e o contrário também.
        </p>
      </header>

      <ChatPanel initial={history.filter((t) => t.role === "user" || t.role === "assistant")} />

      <TelegramNotice />
    </div>
  );
}

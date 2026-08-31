import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { preferences } from "@/lib/schema";
import { AjustesForm } from "@/components/AjustesForm";

export const dynamic = "force-dynamic";

export default async function Ajustes() {
  const { viewing, account } = (await getSession())!;
  const readOnly = account.id !== viewing.id;
  const [p] = await db
    .select({ coachTone: preferences.coachTone, coachNote: preferences.coachNote })
    .from(preferences)
    .where(eq(preferences.userId, viewing.id));

  return (
    <div className="space-y-6">
      <header>
        <p className="label">Ajustes</p>
        <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.4rem)]">A treinadora, do seu jeito</h1>
        <p className="mt-2 max-w-lg text-sm text-ink-soft">
          Como ela fala com você. Aplica em toda mensagem, em até 2 minutos.
        </p>
      </header>

      <AjustesForm
        tone={p?.coachTone ?? "equilibrada"}
        note={p?.coachNote ?? ""}
        readOnly={readOnly}
      />
    </div>
  );
}

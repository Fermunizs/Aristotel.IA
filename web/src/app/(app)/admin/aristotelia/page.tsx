import { db } from "@/lib/db";
import { appSettings } from "@/lib/schema";
import { requireSuperadmin } from "@/lib/guards";
import { CoachForm } from "@/components/CoachForm";

export const dynamic = "force-dynamic";

export default async function EditarIA() {
  await requireSuperadmin();

  const rows = await db.select().from(appSettings);
  const cur: Record<string, string> = {};
  for (const r of rows) cur[r.key] = r.value;

  return (
    <div className="space-y-6">
      <header>
        <p className="label">Admin</p>
        <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.4rem)]">Ajustar a Aristótel.IA</h1>
        <p className="mt-2 max-w-lg text-sm text-ink-soft">
          Isto vai no começo de toda resposta que a treinadora gera. Muda como ela fala com todo
          mundo. Ela aplica em até 2 minutos.
        </p>
      </header>

      <CoachForm
        initial={{
          identidade: cur.identidade ?? "",
          objetivo: cur.objetivo ?? "",
          tom: cur.tom ?? "",
          sempre: cur.sempre ?? "",
          nunca: cur.nunca ?? "",
          teto_tokens: cur.teto_tokens ?? "600",
        }}
      />
    </div>
  );
}

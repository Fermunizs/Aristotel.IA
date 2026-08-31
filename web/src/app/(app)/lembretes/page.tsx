import { getSession } from "@/lib/session";
import { getReminders } from "@/lib/reminders";
import { RemindersEditor } from "@/components/RemindersEditor";
import { PushToggle } from "@/components/PushToggle";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Lembretes() {
  const { viewing, account } = (await getSession())!;
  const readOnly = account.id !== viewing.id;
  const list = await getReminders(viewing.id);

  return (
    <div className="space-y-6">
      <header>
        <p className="label">Lembretes</p>
        <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.4rem)]">Como a treinadora te cobra</h1>
        <p className="mt-2 max-w-lg text-sm text-ink-soft">
          A Aristótel.IA montou esse acompanhamento pra você. Muda os horários, desliga o que
          atrapalha, adiciona um lembrete seu. Ela se ajusta na hora.{" "}
          <Link href="/ajustes" className="text-clay">
            ajustar como ela fala →
          </Link>
        </p>
      </header>

      {!readOnly && (
        <div>
          <p className="label mb-2">Onde receber</p>
          <PushToggle />
        </div>
      )}

      <div>
        <p className="label mb-2">Seus lembretes</p>
        <RemindersEditor
          initial={list.map((r) => ({
            id: r.id,
            kind: r.kind,
            customText: r.customText,
            scheduleType: r.scheduleType,
            atTime: r.atTime ? r.atTime.slice(0, 5) : null,
            period: r.period,
            days: r.days,
            channel: r.channel,
            enabled: r.enabled,
          }))}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}

import { getSession } from "@/lib/session";
import { getReminders } from "@/lib/reminders";
import { RemindersEditor } from "@/components/RemindersEditor";

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
          A Aristótel.IA montou esse acompanhamento pra você. Mude os horários, desligue o que
          atrapalha, adicione um lembrete seu. Ela se ajusta na hora.
        </p>
      </header>

      <RemindersEditor
        initial={list.map((r) => ({
          id: r.id,
          kind: r.kind,
          customText: r.customText,
          scheduleType: r.scheduleType,
          atTime: r.atTime ? r.atTime.slice(0, 5) : null,
          period: r.period,
          days: r.days,
          enabled: r.enabled,
        }))}
        readOnly={readOnly}
      />
    </div>
  );
}

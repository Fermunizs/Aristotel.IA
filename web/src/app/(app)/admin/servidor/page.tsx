import { serverVitals } from "@/lib/queries";
import { requireSuperadmin } from "@/lib/guards";

export const dynamic = "force-dynamic";

const gb = (bytes: number | null) =>
  bytes == null ? "—" : bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${(bytes / 1e6).toFixed(0)} MB`;

const dur = (s: number | null) => {
  if (s == null) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}min` : `${m}min`;
};

const ago = (iso: Date | string | null) => {
  if (!iso) return "—";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "agora há pouco";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return `há ${Math.round(s / 86400)} d`;
};

export default async function Servidor() {
  await requireSuperadmin();
  const v = await serverVitals();

  if (!v) {
    return (
      <div className="space-y-6">
        <Header stale={null} />
        <div className="card p-5 text-sm text-ink-soft">
          Sem dados ainda. O bot reporta os vitais a cada 60s — se isto não sair depois de
          alguns minutos, o job <span className="num">vitals</span> não está rodando (ou o deploy
          com a migration 0012 ainda não subiu).
        </div>
      </div>
    );
  }

  const memUsed = v.memTotalMb != null && v.memAvailableMb != null ? v.memTotalMb - v.memAvailableMb : null;
  const swapUsed = v.swapTotalMb != null && v.swapFreeMb != null ? v.swapTotalMb - v.swapFreeMb : null;
  const diskUsed = v.diskTotalGb != null && v.diskFreeGb != null ? v.diskTotalGb - v.diskFreeGb : null;

  const ramCrit = v.memAvailableMb != null && v.memAvailableMb < 100;
  const load1 = v.cpuLoad1 ?? 0;
  const loadTone = load1 > 1.5 ? "red" : load1 > 0.9 ? "amber" : "ok";
  const diskTone = v.diskFreeGb != null && v.diskFreeGb < 2 ? "amber" : "ok";

  const services = (v.services ?? {}) as Record<string, boolean>;
  const svcEntries = Object.entries(services);
  const anyDown = svcEntries.some(([, up]) => !up);

  const backupStale =
    !v.lastBackupAt || Date.now() - new Date(v.lastBackupAt).getTime() > 36 * 3600 * 1000;
  const staleSecs = Math.round((Date.now() - new Date(v.updatedAt).getTime()) / 1000);

  return (
    <div className="space-y-8">
      <Header stale={staleSecs} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          title="CPU load"
          tone={loadTone}
          big={`${load1.toFixed(2)}`}
          sub={`1m · 5m ${(v.cpuLoad5 ?? 0).toFixed(2)} · 15m ${(v.cpuLoad15 ?? 0).toFixed(2)} — 1 OCPU`}
        />
        <Card
          title="RAM"
          tone={ramCrit ? "red" : "ok"}
          big={memUsed != null ? `${memUsed} MB` : "—"}
          sub={
            v.memTotalMb != null
              ? `usada de ${v.memTotalMb} MB · ${v.memAvailableMb} MB livres`
              : "sem leitura"
          }
        />
        <Card
          title="Swap"
          tone={swapUsed != null && v.swapTotalMb ? (swapUsed / v.swapTotalMb > 0.6 ? "amber" : "ok") : "ok"}
          big={swapUsed != null ? `${swapUsed} MB` : "—"}
          sub={v.swapTotalMb != null ? `usada de ${v.swapTotalMb} MB` : "sem leitura"}
        />
        <Card
          title="Disco"
          tone={diskTone}
          big={diskUsed != null ? `${diskUsed.toFixed(1)} GB` : "—"}
          sub={
            v.diskTotalGb != null
              ? `usado de ${v.diskTotalGb.toFixed(0)} GB · ${v.diskFreeGb?.toFixed(1)} GB livres`
              : "sem leitura"
          }
        />
        <Card
          title="Postgres"
          tone="ok"
          big={gb(v.pgSizeBytes)}
          sub="tamanho do banco aristotelia"
        />
        <Card
          title="Bot no ar"
          tone="ok"
          big={dur(v.botUptimeSeconds)}
          sub="desde o último restart do serviço"
        />
      </div>

      <section>
        <h2 className="mb-3 text-base">Serviços</h2>
        <div className={`card divide-y divide-line ${anyDown ? "border-red-500/50" : ""}`}>
          {svcEntries.length === 0 && (
            <p className="p-4 text-sm text-ink-soft">
              Nenhum serviço reportado (o bot roda <span className="num">systemctl is-active</span> —
              em dev não existe).
            </p>
          )}
          {svcEntries.map(([name, up]) => (
            <div key={name} className="flex items-center justify-between p-3 text-sm">
              <span className="num">{name}</span>
              <span className={up ? "text-growth" : "text-red-600 dark:text-red-500"}>
                {up ? "no ar" : "fora"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base">Backup</h2>
        <div className={`card p-4 text-sm ${backupStale ? "border-clay/50" : ""}`}>
          {v.lastBackupAt ? (
            <p>
              Último: <span className={backupStale ? "text-clay" : ""}>{ago(v.lastBackupAt)}</span>{" "}
              <span className="text-ink-soft">
                ({new Date(v.lastBackupAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })})
              </span>{" "}
              · {gb(v.lastBackupBytes)}
            </p>
          ) : (
            <p className="text-clay">Nenhum backup encontrado em ~/backups.</p>
          )}
          {backupStale && v.lastBackupAt && (
            <p className="mt-1 text-xs text-ink-soft">
              Faz mais de 36h — o timer <span className="num">aristotelia-backup</span> roda 03:30.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Header({ stale }: { stale: number | null }) {
  const bad = stale != null && stale > 180;
  return (
    <header>
      <p className="label">Admin</p>
      <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.4rem)]">Servidor</h1>
      <p className="mt-2 max-w-lg text-sm text-ink-soft">
        Saúde da VM Oracle (1 OCPU · 1 GB RAM · 1 GB swap). O bot reporta a cada 60s.
        {stale != null && (
          <>
            {" "}
            Atualizado{" "}
            <span className={bad ? "text-red-600 dark:text-red-500" : ""}>
              há {stale < 60 ? `${stale}s` : `${Math.round(stale / 60)} min`}
            </span>
            {bad && " — o job de vitais pode ter parado."}
          </>
        )}
      </p>
    </header>
  );
}

const TONES: Record<string, string> = {
  ok: "text-ink",
  amber: "text-clay",
  red: "text-red-600 dark:text-red-500",
};

function Card({
  title,
  big,
  sub,
  tone = "ok",
}: {
  title: string;
  big: string;
  sub: string;
  tone?: "ok" | "amber" | "red";
}) {
  return (
    <div className={`card p-4 ${tone === "red" ? "border-red-500/50" : tone === "amber" ? "border-clay/50" : ""}`}>
      <p className="label">{title}</p>
      <p className={`num mt-1 text-2xl ${TONES[tone]}`}>{big}</p>
      <p className="mt-1 text-xs text-ink-soft">{sub}</p>
    </div>
  );
}

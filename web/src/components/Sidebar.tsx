"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mark, Wordmark } from "./art";

const NAV = [
  { href: "/", label: "Hoje", icon: HojeIcon },
  { href: "/trilha", label: "Trilha", icon: TrilhaIcon },
  { href: "/foco", label: "Foco", icon: FocoIcon },
  { href: "/lembretes", label: "Lembretes", icon: LembreteIcon },
  { href: "/evolucao", label: "Evolução", icon: EvolucaoIcon },
];

export function Sidebar({
  name,
  isAdmin,
  impersonating,
}: {
  name: string;
  isAdmin: boolean;
  impersonating: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  const items = isAdmin
    ? [
        ...NAV,
        { href: "/admin", label: "Pessoas", icon: AdminIcon },
        { href: "/admin/aristotelia", label: "Ajustar IA", icon: AjustarIcon },
      ]
    : NAV;
  const isActive = (href: string) =>
    href === "/" || href === "/admin" ? path === href : path.startsWith(href);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/entrar");
    router.refresh();
  }
  async function stopImpersonate() {
    await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: null }),
    });
    router.push("/admin");
    router.refresh();
  }

  return (
    <>
      {/* desktop */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
        <div className="flex items-center gap-2 px-2">
          <span className="text-ink">
            <Mark size={26} />
          </span>
          <Wordmark />
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                  active ? "bg-paper-2 font-medium text-ink" : "text-ink-soft hover:text-ink"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 h-6 w-[3px] rounded-full bg-clay" />
                )}
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-line pt-4 text-sm">
          {impersonating ? (
            <button onClick={stopImpersonate} className="text-clay">
              ← vendo {name}
            </button>
          ) : (
            <div className="flex items-center justify-between text-ink-soft">
              <span className="truncate">{name}</span>
              <button onClick={logout} className="hover:text-ink">
                sair
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* mobile: barra inferior */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-paper py-2 md:hidden">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-2 text-[0.65rem] ${
                active ? "text-clay" : "text-ink-soft"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

const S = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function HojeIcon() { return <svg {...S}><path d="M4 20c3-1 5-1 8 0s5 1 8 0" /><circle cx="12" cy="8" r="3.5" /><path d="M12 4v1M12 11v1M8 8H7M17 8h-1" /></svg>; }
function TrilhaIcon() { return <svg {...S}><path d="M7 20c0-4-4-4-4-8s5-3 5-6 4-3 6 0 3 5 0 8-4 3-4 6" /><circle cx="6" cy="14" r="1" /><circle cx="14" cy="9" r="1" /></svg>; }
function FocoIcon() { return <svg {...S}><circle cx="12" cy="13" r="7" /><path d="M12 6c-1-2-3-3-5-3 1 1 1 2 0 3M12 6c1-2 3-3 5-3-1 1-1 2 0 3" /></svg>; }
function LembreteIcon() { return <svg {...S}><path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0" /></svg>; }
function EvolucaoIcon() { return <svg {...S}><path d="M4 18h16M6 18v-4M11 18v-8M16 18v-6M21 18V8" /></svg>; }
function AdminIcon() { return <svg {...S}><circle cx="9" cy="8" r="3" /><circle cx="16" cy="10" r="2.5" /><path d="M4 19c0-3 2-5 5-5s5 2 5 5M14 19c0-2 1-3.5 2.5-3.5" /></svg>; }
function AjustarIcon() { return <svg {...S}><path d="M5 7h9M18 7h1M5 17h1M10 17h9" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>; }

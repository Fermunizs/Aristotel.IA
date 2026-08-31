import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/entrar");

  const impersonating = session.account.id !== session.viewing.id;

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl">
      <Sidebar
        name={session.viewing.name ?? "você"}
        isAdmin={session.account.role === "superadmin"}
        impersonating={impersonating}
      />
      <main className="fade-in flex-1 px-5 pb-24 pt-8 md:px-10 md:pb-10">{children}</main>
    </div>
  );
}

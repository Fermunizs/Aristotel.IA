import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { OnboardingFlow } from "@/components/OnboardingFlow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/entrar");
  if (session.viewing.status !== "onboarding") redirect("/");

  return <OnboardingFlow name={session.viewing.name ?? "você"} />;
}

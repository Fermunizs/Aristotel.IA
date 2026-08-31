"use client";

import { useEffect, useState } from "react";

const VAPID = process.env.NEXT_PUBLIC_VAPID_KEY ?? "";

function urlB64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "checking" | "unsupported" | "off" | "on" | "denied" | "working";

export function PushToggle() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID),
      });
      const j = sub.toJSON();
      await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys, label: navigator.userAgent.slice(0, 60) }),
      });
      setState("on");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  return (
    <div className="card flex items-center justify-between p-4">
      <div>
        <p className="font-medium">Notificação no navegador</p>
        <p className="text-xs text-ink-soft">
          {state === "unsupported" && "Seu navegador não suporta. No celular, instale o app primeiro."}
          {state === "denied" && "Você bloqueou as notificações. Libere nas configurações do site."}
          {(state === "off" || state === "checking" || state === "working") &&
            "Receba os lembretes aqui, mesmo com o app fechado."}
          {state === "on" && "Ativo neste aparelho. Nos lembretes, escolha o canal “navegador”."}
        </p>
      </div>
      {(state === "off" || state === "on" || state === "working") && (
        <button
          onClick={state === "on" ? disable : enable}
          disabled={state === "working"}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50 ${
            state === "on"
              ? "border border-line text-ink-soft"
              : "bg-clay text-paper"
          }`}
        >
          {state === "working" ? "..." : state === "on" ? "desativar" : "ativar"}
        </button>
      )}
    </div>
  );
}

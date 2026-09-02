"use client";

// Só dispara se o erro for no root layout em si (raro). Precisa do próprio
// <html>/<body> — o globals.css não carrega aqui, então tudo é inline.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#1b1e1c",
          color: "#e6e1d6",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 380 }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 600, margin: 0 }}>O painel caiu.</h1>
          <p style={{ fontSize: ".9rem", opacity: 0.7 }}>
            Recarrega a página. Se continuar, tenta de novo daqui a pouco.
          </p>
          {error.digest && (
            <p style={{ fontSize: "10px", opacity: 0.5, fontFamily: "monospace" }}>
              ref {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              border: 0,
              borderRadius: 999,
              background: "#d1794f",
              color: "#fff",
              padding: ".7rem 1.6rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}

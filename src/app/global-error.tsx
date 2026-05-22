"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem", fontFamily: "sans-serif" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Algo deu errado</h2>
          <p style={{ color: "#666" }}>Nosso time foi notificado automaticamente.</p>
          <button
            onClick={reset}
            style={{ padding: "0.5rem 1.5rem", background: "#f97316", color: "#fff", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 600 }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}

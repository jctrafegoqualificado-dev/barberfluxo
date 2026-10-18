"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import AuthShell, { AuthAlert, authInputCls } from "@/components/auth/AuthShell";

function Form() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar agora");
      setSentTo(email.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar agora");
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-5">
        <span className="w-12 h-12 rounded-full bg-positive-soft text-positive flex items-center justify-center"><MailCheck className="w-6 h-6" aria-hidden /></span>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[30px] font-bold tracking-[-0.02em] leading-tight">Confira seu e-mail</h1>
          <p className="text-[15px] text-ink-2 leading-relaxed">
            Se <strong className="font-semibold text-ink">{sentTo}</strong> tiver uma conta, enviamos um link para criar uma nova senha. Ele vale por 1 hora.
          </p>
        </div>
        <p className="text-[13px] text-ink-3 leading-relaxed">
          Não chegou em alguns minutos? Olhe a caixa de spam ou{" "}
          <button type="button" onClick={() => setSentTo(null)} className="font-semibold text-ink-2 underline">tente de novo</button>.
          Se você é profissional da barbearia, o dono também pode trocar sua senha.
        </p>
        <Link href="/login" className="h-[52px] rounded-xl border border-control bg-surface text-base font-semibold flex items-center justify-center hover:bg-surface-2">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} aria-labelledby="rec-t" className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-1.5">
        <h1 id="rec-t" className="font-display text-[34px] font-bold tracking-[-0.02em] leading-tight">Esqueci a senha</h1>
        <span className="text-[15px] text-ink-3">Digite o e-mail da sua conta. Mandamos um link para você criar uma nova senha.</span>
      </div>
      {error && <AuthAlert>{error}</AuthAlert>}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[13px] font-semibold">E-mail</label>
        <input id="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com" className={authInputCls} />
      </div>
      <button type="submit" disabled={loading}
        className="h-[52px] rounded-xl bg-primary text-white text-base font-semibold disabled:opacity-60 flex items-center justify-center">
        {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-label="Enviando" /> : "Enviar link"}
      </button>
      <Link href="/login" className="text-sm font-semibold text-ink-2 text-center hover:text-ink">Voltar para o login</Link>
    </form>
  );
}

export default function RecuperarSenhaPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}><Form /></Suspense>
    </AuthShell>
  );
}

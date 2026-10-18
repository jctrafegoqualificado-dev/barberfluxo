"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, LinkIcon } from "lucide-react";
import AuthShell, { AuthAlert, PasswordInput } from "@/components/auth/AuthShell";

const MIN = 6; // mesma regra do servidor (src/lib/passwordReset.ts)

function Form() {
  const token = useSearchParams().get("token") ?? "";
  const [check, setCheck] = useState<"loading" | "ok" | "invalid">(token ? "loading" : "invalid");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (r.ok && d?.ok) { setEmail(d.email); setCheck("ok"); } else setCheck("invalid");
      })
      .catch(() => setCheck("invalid"));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < MIN) return setError(`A senha precisa ter pelo menos ${MIN} caracteres.`);
    if (password !== confirm) return setError("As duas senhas estão diferentes.");
    setSaving(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 410) return setCheck("invalid");
      if (!res.ok) throw new Error(data.error || "Não foi possível trocar a senha");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível trocar a senha");
    } finally {
      setSaving(false);
    }
  }

  if (check === "loading") return <div className="h-64 rounded-2xl bg-surface border border-line animate-pulse" aria-label="Conferindo o link" />;

  if (done || check === "invalid") {
    return (
      <div className="flex flex-col gap-5">
        <span className={`w-12 h-12 rounded-full flex items-center justify-center ${done ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning"}`}>
          {done ? <CheckCircle2 className="w-6 h-6" aria-hidden /> : <LinkIcon className="w-6 h-6" aria-hidden />}
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[30px] font-bold tracking-[-0.02em] leading-tight">{done ? "Senha trocada" : "Este link não vale mais"}</h1>
          <p className="text-[15px] text-ink-2 leading-relaxed">
            {done
              ? "Pronto! Entre com o seu e-mail e a senha nova."
              : "O link já foi usado, passou de 1 hora ou foi trocado por um mais novo. Peça outro, é rapidinho."}
          </p>
        </div>
        <Link href={done ? "/login" : "/recuperar-senha"} className="h-[52px] rounded-xl bg-primary text-white text-base font-semibold flex items-center justify-center">
          {done ? "Entrar" : "Pedir um novo link"}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} aria-labelledby="red-t" className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-1.5">
        <h1 id="red-t" className="font-display text-[34px] font-bold tracking-[-0.02em] leading-tight">Criar nova senha</h1>
        <span className="text-[15px] text-ink-3">Para a conta {email}</span>
      </div>
      {error && <AuthAlert>{error}</AuthAlert>}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nova" className="text-[13px] font-semibold">Nova senha</label>
        <PasswordInput id="nova" autoComplete="new-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        <span className="text-xs text-ink-3">Pelo menos {MIN} caracteres.</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirma" className="text-[13px] font-semibold">Repita a nova senha</label>
        <PasswordInput id="confirma" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <button type="submit" disabled={saving}
        className="h-[52px] rounded-xl bg-primary text-white text-base font-semibold disabled:opacity-60 flex items-center justify-center">
        {saving ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-label="Salvando" /> : "Salvar nova senha"}
      </button>
    </form>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}><Form /></Suspense>
    </AuthShell>
  );
}

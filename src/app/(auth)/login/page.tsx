"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import AuthShell, { AuthAlert, PasswordInput, authInputCls } from "@/components/auth/AuthShell";

type Role = "owner" | "barber";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [role, setRole] = useState<Role>("owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(res.status === 401 ? "E-mail ou senha não conferem. Confira e tente de novo." : data.error || "Não foi possível entrar agora");
      }
      setAuth(data.user, data.token);
      // O destino depende da conta, não da aba escolhida
      if (data.user.role === "PLATFORM_ADMIN") router.push("/plataforma");
      else if (data.user.role === "BARBER" || data.user.isBarber) router.push("/barbeiro");
      else router.push("/painel");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar agora");
    } finally {
      setLoading(false);
    }
  }

  const isOwner = role === "owner";
  return (
    <AuthShell top={<>
      Ainda não usa?
      <Link href="/cadastro" className="h-10 px-3.5 rounded-[10px] border border-control bg-surface text-ink text-sm font-semibold inline-flex items-center hover:bg-surface-2">Criar conta</Link>
    </>}>
      <form onSubmit={handleLogin} aria-labelledby="login-t" className="flex flex-col gap-[22px]">
        <div className="flex flex-col gap-1.5">
          <h1 id="login-t" className="font-display text-[34px] font-bold tracking-[-0.02em] leading-tight">Entrar</h1>
          <span className="text-[15px] text-ink-3">Acesse o painel da sua barbearia</span>
        </div>

        <div className="flex flex-col gap-2">
          <span id="role-l" className="text-[13px] font-semibold">Você é</span>
          <div role="group" aria-labelledby="role-l" className="grid grid-cols-2 gap-0.5 p-1 rounded-[10px] bg-track">
            {([["owner", "Dono ou gerente"], ["barber", "Profissional"]] as [Role, string][]).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={role === k} onClick={() => { setRole(k); setError(""); }}
                className={cn("h-[38px] rounded-[7px] text-sm font-semibold", role === k ? "bg-surface text-ink shadow-[0_1px_2px_rgba(27,25,22,0.12)]" : "text-ink-2")}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[13px] font-semibold">E-mail</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com" className={authInputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline">
            <label htmlFor="senha" className="text-[13px] font-semibold">Senha</label>
            <Link href={`/recuperar-senha${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="text-[13px] font-semibold text-ink-2 hover:text-ink">
              Esqueci a senha
            </Link>
          </div>
          <PasswordInput id="senha" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <button type="submit" disabled={loading}
          className="h-[52px] rounded-xl bg-primary text-white text-base font-semibold disabled:opacity-60 flex items-center justify-center">
          {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-label="Entrando" /> : isOwner ? "Entrar no painel" : "Entrar na minha agenda"}
        </button>

        <span className="text-[13px] leading-normal text-ink-3 text-center">
          {isOwner
            ? "Dono ou gerente vê agenda, equipe, financeiro e configurações."
            : "O profissional usa o e-mail e a senha que o dono cadastrou para ele."}
        </span>
      </form>
    </AuthShell>
  );
}

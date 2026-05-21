"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Sparkles } from "lucide-react";

type Tab = "admin" | "barber";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [tab, setTab] = useState<Tab>("admin");
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
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAuth(data.user, data.token);
      if (data.user.role === "PLATFORM_ADMIN") router.push("/plataforma");
      else if (data.user.role === "BARBER") router.push("/barbeiro");
      else if (data.user.isBarber) router.push("/barbeiro");
      else router.push("/painel");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Lado esquerdo — foto + branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0f0f0f 0%, #171717 100%)" }}>
        
        {/* Glow de fundo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-[#FF5F00] opacity-[0.06] blur-[100px] pointer-events-none" />

        {/* Conteúdo */}
        <div className="relative z-10 text-center px-12">
          {/* Logo */}
          <div className="flex justify-center mb-10">
            <img 
              src="/IA de barbearia.png transparente.png" 
              alt="IA de Barbearia" 
              className="w-64 object-contain" 
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </div>

          <div className="space-y-4 text-left max-w-xs mx-auto">
            {[
              "Gestão completa do estabelecimento",
              "Agendamentos em tempo real",
              "Controle de comissões",
              "Relatórios e métricas",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-zinc-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <p className="absolute bottom-6 text-zinc-600 text-xs">© 2026 IA de Barbearia</p>
      </div>

      {/* Lado direito — formulário */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="flex items-center justify-center mb-8 lg:hidden">
            <img 
              src="/IA de barbearia.png transparente.png" 
              alt="IA de Barbearia" 
              className="w-40 object-contain" 
            />
          </div>

          <h2 className="text-3xl font-bold text-zinc-900 mb-1">
            Conecte-se à <span className="text-primary">sua conta</span>
          </h2>
          <p className="text-zinc-500 text-sm mb-8">Acesse o painel de gestão do estabelecimento</p>

          {/* Tabs */}
          <div className="flex rounded-xl border border-zinc-200 p-1 mb-6 bg-zinc-50">
            <button
              type="button"
              onClick={() => setTab("admin")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "admin" ? "bg-white shadow text-primary/90 border border-amber-200" : "text-zinc-500 hover:text-zinc-700"}`}>
              Administrador
            </button>
            <button
              type="button"
              onClick={() => setTab("barber")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "barber" ? "bg-white shadow text-primary/90 border border-amber-200" : "text-zinc-500 hover:text-zinc-700"}`}>
              Profissional
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                E-mail <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/80 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Senha <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/80 focus:border-transparent transition"
              />
              <div className="flex justify-end mt-1.5">
                <a href="/recuperar-senha" className="text-xs text-zinc-400 hover:text-primary transition-colors">
                  Esqueceu sua senha?
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors text-sm shadow-sm flex items-center justify-center gap-2 mt-2">
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : `Entrar como ${tab === "admin" ? "Administrador" : "Profissional"}`}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-6">
            Não tem uma conta?{" "}
            <a href="/cadastro" className="font-semibold text-primary hover:underline transition-all">
              Cadastre-se grátis
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

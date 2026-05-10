"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Scissors } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function CadastroPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", shopName: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, role: "OWNER" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAuth(data.user, data.token);
      router.push("/painel");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 mb-4">
            <Scissors className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Crie sua conta</h1>
          <p className="text-zinc-400 text-sm mt-1">Comece a gerir sua barbearia</p>
        </div>

        <form onSubmit={handleRegister} className="bg-zinc-900 rounded-2xl p-6 space-y-4 border border-zinc-800">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          <Input label="Nome completo" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="João Silva" required className="bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500" />
          <Input label="Nome da barbearia" value={form.shopName} onChange={(e) => set("shopName", e.target.value)} placeholder="Barbearia do João" required className="bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500" />
          <Input label="E-mail" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="seu@email.com" required className="bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500" />
          <Input label="WhatsApp" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(41) 99999-9999" className="bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500" />
          <Input label="Senha" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••••" required className="bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500" />
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Criar conta grátis
          </Button>
        </form>

        <p className="text-center text-zinc-500 text-sm mt-4">
          Já tem conta?{" "}
          <Link href="/login" className="text-amber-500 hover:text-amber-400 font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
